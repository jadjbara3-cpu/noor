// Move USDC across chains with Circle CCTP V2 + the Forwarding Service.
//
//   node scripts/bridge-to-arc.mjs                                  # Base → Arc (default)
//   node scripts/bridge-to-arc.mjs --yes                            # execute
//   node scripts/bridge-to-arc.mjs --from arc-testnet --to base-sepolia --yes
//                                                                   # dress rehearsal
//
// Why forwarding: Circle submits the destination-side `receiveMessage` itself,
// so the destination wallet needs no gas before the transfer lands. That matters
// on Arc, where gas is USDC and the wallet starts empty.
//
// The same code runs the testnet rehearsal and the real launch — only the
// network keys change, so a proven rehearsal proves the production path.

import {
  Contract,
  JsonRpcProvider,
  Wallet,
  formatUnits,
  zeroPadValue,
} from "ethers";
import { network, walletRecord, assertRealMoneyAllowed, CCTP_FORWARD_HOOK } from "./lib/arc.mjs";

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
];

const TOKEN_MESSENGER = [
  "function depositForBurnWithHook(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold, bytes hookData) returns (uint64)",
];

const FAST = 1000;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function providerFor(net) {
  return new JsonRpcProvider(net.rpc, net.chainId, { staticNetwork: true });
}

async function quoteForwardFees(irisApi, srcDomain, dstDomain) {
  const url = `${irisApi}/v2/burn/USDC/fees/${srcDomain}/${dstDomain}?forward=true`;
  const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`Fee quote failed HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const quotes = await r.json();
  const fast = quotes.find((q) => q.finalityThreshold === FAST);
  if (!fast) throw new Error(`No fast-transfer quote: ${JSON.stringify(quotes)}`);
  return fast;
}

async function pollForwardedMint(irisApi, srcDomain, burnTxHash, timeoutMs = 25 * 60 * 1000) {
  const url = `${irisApi}/v2/messages/${srcDomain}?transactionHash=${burnTxHash}`;
  const started = Date.now();
  let last = "";
  while (Date.now() - started < timeoutMs) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (r.ok) {
        const data = await r.json();
        const msg = data?.messages?.[0];
        if (msg?.forwardTxHash) return msg;
        const status = msg?.status ?? "pending";
        if (status !== last) {
          console.log(`        attestation: ${status}`);
          last = status;
        }
      }
    } catch {
      /* transient */
    }
    await new Promise((res) => setTimeout(res, 5000));
  }
  throw new Error("timed out waiting for the forwarded mint");
}

async function main() {
  const srcKey = arg("from", "base");
  const dstKey = arg("to", "arc-mainnet");
  const src = network(srcKey);
  const dst = network(dstKey);
  const confirm = process.argv.includes("--yes");
  const realMoney = Boolean(src.realMoney || dst.realMoney);

  const srcProv = providerFor(src);
  const dstProv = providerFor(dst);
  const record = walletRecord(realMoney ? dst : src); // same key on both chains
  const wallet = new Wallet(record.privateKey, srcProv);

  console.log(`\n════════════════════════════════════════════════════════════`);
  console.log(`  CCTP BRIDGE   ${src.name} (${src.chainId}, domain ${src.cctpDomain})`);
  console.log(`             →  ${dst.name} (${dst.chainId}, domain ${dst.cctpDomain})`);
  console.log(`  mode          ${realMoney ? "⚠  REAL MONEY" : "testnet rehearsal"}`);
  console.log(`════════════════════════════════════════════════════════════\n`);
  console.log(`  wallet        : ${wallet.address}`);
  console.log(`  iris api      : ${src.irisApi}\n`);

  const usdc = new Contract(src.usdcErc20, ERC20, wallet);
  const decimals = Number(await usdc.decimals());
  const dstUsdc = new Contract(dst.usdcErc20, ERC20, dstProv);

  const [native, usdcBal, dstBal] = await Promise.all([
    srcProv.getBalance(wallet.address),
    usdc.balanceOf(wallet.address),
    dstUsdc.balanceOf(wallet.address),
  ]);

  console.log(`  ${src.name.padEnd(13)} native : ${formatUnits(native, 18)} ${src.currency}  (gas)`);
  console.log(`  ${src.name.padEnd(13)} USDC   : ${formatUnits(usdcBal, decimals)}`);
  console.log(`  ${dst.name.padEnd(13)} USDC   : ${formatUnits(dstBal, 6)}\n`);

  if (usdcBal === 0n) {
    console.log(`  Nothing to bridge — no USDC on ${src.name}.\n`);
    return;
  }
  if (native === 0n) {
    throw new Error(`No ${src.currency} on ${src.name} for gas at ${wallet.address}`);
  }

  const quote = await quoteForwardFees(src.irisApi, src.cctpDomain, dst.cctpDomain);
  const forwardFee = BigInt(quote.forwardFee.med);
  const protocolFee = (usdcBal * BigInt(Math.round(quote.minimumFee * 100))) / 1_000_000n;
  const maxFee = forwardFee + protocolFee + 1000n;
  const est = (v) => formatUnits(v, decimals);

  console.log(`  CCTP fast transfer (threshold ${FAST})`);
  console.log(`    forwarding fee : ${est(forwardFee)} USDC`);
  console.log(`    protocol fee   : ${est(protocolFee)} USDC (${quote.minimumFee}%)`);
  console.log(`    maxFee         : ${est(maxFee)} USDC`);
  console.log(`    burning        : ${est(usdcBal)} USDC`);
  console.log(`    expected on ${dst.name}: ~${est(usdcBal - forwardFee - protocolFee)} USDC\n`);

  if (maxFee >= usdcBal) throw new Error(`Amount too small: fee ${est(maxFee)} >= balance ${est(usdcBal)}`);
  if (!confirm) {
    console.log("  DRY RUN — add --yes to execute.\n");
    return;
  }
  assertRealMoneyAllowed(dst);

  const allowance = await usdc.allowance(wallet.address, src.tokenMessengerV2);
  if (allowance < usdcBal) {
    console.log("  [1/3] approving USDC to TokenMessengerV2…");
    const tx = await usdc.approve(src.tokenMessengerV2, usdcBal);
    console.log(`        ${tx.hash}`);
    await tx.wait(1);
  } else {
    console.log("  [1/3] allowance already sufficient");
  }

  const messenger = new Contract(src.tokenMessengerV2, TOKEN_MESSENGER, wallet);
  const mintRecipient = zeroPadValue(wallet.address, 32);
  const destinationCaller = zeroPadValue("0x", 32);

  // On Arc the gas token IS USDC and it shares one balance with the ERC-20
  // interface, so every transaction we send shrinks the amount available to
  // burn. Re-read the balance after the approve and hold back enough for the
  // burn itself. On chains where gas is a separate asset (Base, Base Sepolia)
  // no reserve is needed.
  let burnAmount = (await usdc.balanceOf(wallet.address));
  let reserve = 0n;
  if (String(src.currency).toUpperCase() === "USDC") {
    const gasUnits = await messenger.depositForBurnWithHook.estimateGas(
      burnAmount, dst.cctpDomain, mintRecipient, src.usdcErc20, destinationCaller, maxFee, FAST, CCTP_FORWARD_HOOK
    );
    const feeData = await srcProv.getFeeData();
    const maxGasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
    // native gas is 18-dec, the USDC ERC-20 interface is 6-dec
    const gasWei = gasUnits * maxGasPrice * 2n;
    reserve = gasWei / 10n ** 12n + 10_000n; // +0.01 USDC safety margin
    burnAmount -= reserve;
    console.log(`  [2/3] gas reserve held back: ${est(reserve)} USDC (Arc pays gas in USDC)`);
  } else {
    console.log("  [2/3] gas is a separate asset — no reserve needed");
  }

  if (burnAmount <= maxFee) {
    throw new Error(`After the gas reserve only ${est(burnAmount)} USDC remains — too little to bridge.`);
  }

  console.log(`  [3/4] depositForBurnWithHook — Circle forwards the destination mint…`);
  console.log(`        burning ${est(burnAmount)} USDC (fee up to ${est(maxFee)})`);
  const burnTx = await messenger.depositForBurnWithHook(
    burnAmount,
    dst.cctpDomain,
    mintRecipient,
    src.usdcErc20,
    destinationCaller,
    maxFee,
    FAST,
    CCTP_FORWARD_HOOK
  );
  console.log(`        ${burnTx.hash}`);
  console.log(`        ${src.explorer}/tx/${burnTx.hash}`);
  const rc = await burnTx.wait(1);
  console.log(`        confirmed in block ${rc.blockNumber} (gas ${rc.gasUsed})`);

  console.log(`\n  [4/4] waiting for Circle to mint on ${dst.name}…`);
  const msg = await pollForwardedMint(src.irisApi, src.cctpDomain, burnTx.hash);
  console.log(`        forwarded mint tx: ${msg.forwardTxHash}`);

  let received = 0n;
  for (let i = 0; i < 30; i++) {
    const now = await dstUsdc.balanceOf(wallet.address);
    if (now > dstBal) {
      received = now - dstBal;
      break;
    }
    await new Promise((r) => setTimeout(r, 4000));
  }

  console.log(`\n════════════════════════════════════════════════════════════`);
  if (received > 0n) {
    console.log(`  ✅ ARRIVED — ${formatUnits(received, 6)} USDC on ${dst.name}`);
    console.log(`     new balance: ${formatUnits(await dstUsdc.balanceOf(wallet.address), 6)} USDC`);
  } else {
    console.log(`  ⏳ mint submitted, balance not visible yet — re-run to re-check`);
  }
  console.log(`     ${dst.explorer}/tx/${msg.forwardTxHash}`);
  console.log(`════════════════════════════════════════════════════════════\n`);
}

main().catch((e) => {
  console.error("\nBRIDGE FAILED:", e.shortMessage ?? e.message);
  process.exitCode = 1;
});
