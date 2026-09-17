// End-to-end feature proof: exercises permit (EIP-2612), batchTransfer and burn
// against the live Arc deployment, producing verifiable on-chain receipts.
//
//   node scripts/demo.mjs

import { Contract, Signature, parseUnits, formatUnits, Wallet } from "ethers";
import { readArtifact } from "./lib/build.mjs";
import { network, provider, signer, assertRealMoneyAllowed, feeOverrides, readDeployment, EXPLORER_TX } from "./lib/arc.mjs";
import { ensureAccounts } from "./accounts.mjs";

async function main() {
  const net = network();
  assertRealMoneyAllowed(net);
  const dep = readDeployment(net);
  if (!dep?.address) throw new Error("No deployment. Run: node scripts/deploy.mjs");

  const accounts = ensureAccounts();
  const prov = provider(net);
  const main = signer(net);
  const artifact = readArtifact("NoorCoin");
  const token = new Contract(dep.address, artifact.abi, main);

  const community = new Wallet(accounts.accounts.community.privateKey, prov);
  const liquidityAddr = accounts.accounts.liquidity.address;

  const decimals = Number(await token.decimals());
  const symbol = await token.symbol();
  const fees = await feeOverrides(prov);
  const u = (v) => formatUnits(v, decimals);
  const results = [];

  console.log(`token  : ${dep.address}`);
  console.log(`symbol : ${symbol}\n`);

  // The demo has one non-deployer wallet send a transaction, so it needs a
  // little native USDC for gas. Top it up from the deployer if needed.
  const MIN_GAS = parseUnits("0.05", 18);
  const communityGas = await prov.getBalance(community.address);
  if (communityGas < MIN_GAS) {
    const topUp = MIN_GAS - communityGas;
    const fundTx = await main.sendTransaction({ to: community.address, value: topUp, ...fees });
    await fundTx.wait(1);
    console.log(`gas top-up : sent ${formatUnits(topUp, 18)} USDC to community  (${fundTx.hash})\n`);
  }

  // ---------------------------------------------------------------- 1. permit
  console.log("─── 1. EIP-2612 permit (gasless approval) ───");
  const value = parseUnits("1000", decimals);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const nonce = await token.nonces(community.address);

  const domain = {
    name: await token.name(),
    version: "1",
    chainId: net.chainId,
    verifyingContract: dep.address,
  };
  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };
  const message = {
    owner: community.address,
    spender: main.address,
    value,
    nonce,
    deadline,
  };

  const signature = await community.signTypedData(domain, types, message);
  const { v, r, s } = Signature.from(signature);
  console.log(`  owner   : ${community.address}`);
  console.log(`  spender : ${main.address}`);
  console.log(`  value   : ${u(value)} ${symbol}`);
  console.log(`  nonce   : ${nonce}`);
  console.log(`  sig     : ${signature.slice(0, 42)}…  (signed off-chain, zero gas)`);

  const permitTx = await token.permit(community.address, main.address, value, deadline, v, r, s, fees);
  console.log(`  permit tx: ${permitTx.hash}`);
  await permitTx.wait(1);
  const allowance = await token.allowance(community.address, main.address);
  console.log(`  allowance now: ${u(allowance)} ${symbol}  ✅`);
  results.push({ step: "permit", txHash: permitTx.hash, detail: `allowance=${allowance}` });

  // --------------------------------------------------------- 2. transferFrom
  console.log("\n─── 2. transferFrom (spend the permit allowance) ───");
  const spend = parseUnits("250", decimals);
  const tfTx = await token.transferFrom(community.address, liquidityAddr, spend, fees);
  console.log(`  tx: ${tfTx.hash}`);
  await tfTx.wait(1);
  const liqBal = await token.balanceOf(liquidityAddr);
  console.log(`  liquidity balance: ${u(liqBal)} ${symbol}  ✅`);
  results.push({ step: "transferFrom", txHash: tfTx.hash, detail: `liquidity=${liqBal}` });

  // --------------------------------------------------------- 3. batchTransfer
  console.log("\n─── 3. batchTransfer (one tx, three recipients) ───");
  const recipients = [
    accounts.accounts.community.address,
    accounts.accounts.liquidity.address,
    accounts.accounts.ecosystem.address,
  ];
  const amounts = [parseUnits("10", decimals), parseUnits("20", decimals), parseUnits("30", decimals)];
  const before = await Promise.all(recipients.map((a) => token.balanceOf(a)));
  const batchTx = await token.batchTransfer(recipients, amounts, fees);
  console.log(`  tx: ${batchTx.hash}`);
  const batchRc = await batchTx.wait(1);
  const after = await Promise.all(recipients.map((a) => token.balanceOf(a)));
  recipients.forEach((a, i) => {
    const delta = after[i] - before[i];
    console.log(`  ${a}  +${u(delta)} ${symbol}  ${delta === amounts[i] ? "✅" : "❌"}`);
  });
  console.log(`  transfer events in tx: ${batchRc.logs.length}`);
  results.push({ step: "batchTransfer", txHash: batchTx.hash, recipients, amounts: amounts.map(String) });

  // ------------------------------------------------------------------ 4. burn
  console.log("\n─── 4. burn (deflation) ───");
  const supplyBefore = await token.totalSupply();
  const burnAmount = parseUnits("1000", decimals);
  const communityToken = token.connect(community);
  const burnTx = await communityToken.burn(burnAmount, fees);
  console.log(`  tx: ${burnTx.hash}`);
  await burnTx.wait(1);
  const supplyAfter = await token.totalSupply();
  console.log(`  supply ${u(supplyBefore)} → ${u(supplyAfter)} ${symbol}`);
  console.log(`  burned: ${u(supplyBefore - supplyAfter)} ${symbol}  ✅`);
  console.log(`  remainingMintable (burned supply is re-issuable, cap unchanged): ${u(await token.remainingMintable())} ${symbol}`);
  results.push({ step: "burn", txHash: burnTx.hash, burned: String(supplyBefore - supplyAfter) });

  // --------------------------------------------------------------- 5. cap/guard
  console.log("\n─── 5. guard checks (these must FAIL) ───");
  const remaining = await token.remainingMintable();
  console.log(`  remainingMintable: ${u(remaining)} ${symbol} (== supply burned so far)`);
  try {
    // One wei more than the cap allows must always revert.
    await token.mint(main.address, remaining + 1n, fees);
    console.log("  mint past cap: ❌ unexpectedly succeeded");
  } catch (e) {
    console.log(`  mint past cap: ✅ reverted (${(e.shortMessage ?? e.message).slice(0, 90)})`);
  }
  try {
    const outsider = token.connect(community);
    await outsider.setFee(100, community.address, fees);
    console.log("  non-owner setFee: ❌ unexpectedly succeeded");
  } catch (e) {
    console.log(`  non-owner setFee: ✅ reverted (${(e.shortMessage ?? e.message).slice(0, 90)})`);
  }
  try {
    await token.setFee(501, main.address, fees); // MAX_FEE_BPS == 500
    console.log("  fee above 5% cap: ❌ unexpectedly succeeded");
  } catch (e) {
    console.log(`  fee above 5% cap: ✅ reverted (${(e.shortMessage ?? e.message).slice(0, 90)})`);
  }

  console.log("\n=== on-chain evidence ===");
  for (const r of results) console.log(`  ${r.step.padEnd(15)} ${EXPLORER_TX(net, r.txHash)}`);
}

main().catch((e) => {
  console.error("\nDEMO FAILED:", e.shortMessage ?? e.message);
  process.exitCode = 1;
});
