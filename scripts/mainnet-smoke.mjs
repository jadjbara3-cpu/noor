// Post-deployment smoke test on Arc MAINNET: proves the live contract works with
// real transactions, and records the verification result.
//
//   node scripts/mainnet-smoke.mjs --yes
//
// Spends a few thousandths of a USDC in gas. Deliberately small.

import { Contract, formatUnits, HDNodeWallet, Mnemonic, Wallet } from "ethers";
import { readArtifact } from "./lib/build.mjs";
import {
  network,
  provider,
  signer,
  walletRecord,
  assertRealMoneyAllowed,
  feeOverrides,
  readDeployment,
  writeDeployment,
  EXPLORER_ADDR,
  EXPLORER_TX,
} from "./lib/arc.mjs";
import { loadWalletRecord } from "./wallet.mjs";

const VERIFIED_AT = "2026-09-17T20:47:36.000Z"; // observed on explorer.arc.io

async function main() {
  const net = network();
  assertRealMoneyAllowed(net);
  const dep = readDeployment(net);
  if (!dep?.address) throw new Error("No mainnet deployment record");

  const prov = provider(net);
  const owner = signer(net);
  const record = walletRecord(net);
  const artifact = readArtifact("NoorCoin");
  const token = new Contract(dep.address, artifact.abi, owner);

  const dec = Number(await token.decimals());
  const symbol = await token.symbol();
  const u = (v) => formatUnits(v, dec);
  const fees = await feeOverrides(prov);

  // Derive a second address we control (same master mnemonic, index 1).
  const master = loadWalletRecord();
  const recipient = HDNodeWallet.fromMnemonic(
    Mnemonic.fromPhrase(master.mnemonic),
    "m/44'/60'/0'/0/1"
  ).address;

  const results = [];
  const check = (label, ok, detail = "") => {
    results.push({ label, ok, detail });
    console.log(`  ${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  };

  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`  NOOR (NUR) MAINNET SMOKE TEST`);
  console.log(`  contract ${dep.address}`);
  console.log(`════════════════════════════════════════════════════════════════\n`);

  // ── static state ─────────────────────────────────────────────────────
  console.log("1. Contract identity (read from mainnet)");
  const name = await token.name();
  const total = await token.totalSupply();
  const cap = await token.cap();
  check("name", name === "Noor", name);
  check("symbol", symbol === "NUR", symbol);
  check("decimals", dec === 18, String(dec));
  check("totalSupply = 1,000,000,000", total === 10n ** 27n, u(total));
  check("cap = totalSupply (fixed supply)", cap === total, u(cap));
  check("remainingMintable = 0", (await token.remainingMintable()) === 0n);
  check("feeBps = 0", (await token.feeBps()) === 0n);
  check("limitsEnabled = false", (await token.limitsEnabled()) === false);
  check("paused = false", (await token.paused()) === false);
  check("owner is the operator wallet", (await token.owner()).toLowerCase() === record.address.toLowerCase());

  // ── live transfer ────────────────────────────────────────────────────
  console.log("\n2. Live transfer (real transaction)");
  const amount = 1_000n * 10n ** BigInt(dec); // 1,000 NUR
  const before = await token.balanceOf(recipient);
  const ownerBefore = await token.balanceOf(owner.address);

  const tx = await token.transfer(recipient, amount, fees);
  console.log(`  tx: ${tx.hash}`);
  const rc = await tx.wait(1);
  const after = await token.balanceOf(recipient);
  const ownerAfter = await token.balanceOf(owner.address);

  check("recipient received the transfer", after - before === amount, `+${u(after - before)} ${symbol}`);
  check("sender balance decreased", ownerBefore - ownerAfter === amount, `-${u(ownerBefore - ownerAfter)} ${symbol}`);
  check("transfer event emitted", rc.logs.length >= 1, `${rc.logs.length} log(s)`);
  results.push({ txHash: tx.hash, kind: "transfer" });

  // ── EIP-2612 permit, signed off-chain ────────────────────────────────
  console.log("\n3. EIP-2612 permit (gasless approval, signed off-chain)");
  const { Signature, parseUnits } = await import("ethers");
  const spender = HDNodeWallet.fromMnemonic(
    Mnemonic.fromPhrase(master.mnemonic),
    "m/44'/60'/0'/0/2"
  ).address;
  const permitValue = parseUnits("500", dec);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const nonce = await token.nonces(owner.address);
  const domain = { name, version: "1", chainId: net.chainId, verifyingContract: dep.address };
  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };
  const sig = await owner.signTypedData(domain, types, {
    owner: owner.address, spender, value: permitValue, nonce, deadline,
  });
  const { v, r, s } = Signature.from(sig);
  const ptx = await token.permit(owner.address, spender, permitValue, deadline, v, r, s, fees);
  await ptx.wait(1);
  const allowance = await token.allowance(owner.address, spender);
  check("permit set the allowance", allowance === permitValue, `${u(allowance)} ${symbol}`);
  results.push({ txHash: ptx.hash, kind: "permit" });

  // ── guards must revert ───────────────────────────────────────────────
  console.log("\n4. Guard checks (must revert)");
  const expectRevert = async (label, fn) => {
    try {
      const t = await fn();
      if (t?.wait) await t.wait(1);
      check(label, false, "UNEXPECTEDLY SUCCEEDED");
    } catch (e) {
      check(label, true, (e.shortMessage ?? e.message).replace(/\s+/g, " ").slice(0, 70));
    }
  };
  await expectRevert("mint past the 1,000,000,000 cap", () => token.mint(owner.address, 1n, fees));
  await expectRevert("setFee above the 5% ceiling", () => token.setFee(501, owner.address, fees));

  // ── record verification ──────────────────────────────────────────────
  dep.verified = true;
  dep.verifiedAt = VERIFIED_AT;
  dep.verification = {
    method: "Blockscout v2 via/standard-input (multipart/form-data, submitted from browser)",
    explorer: `${net.explorer}/address/${dep.address}#code`,
    result: "exact match",
    contractName: name + "Coin",
    filePath: "contracts/NoorCoin.sol",
    compiler: dep.compiler.version,
    evmVersion: dep.compiler.evmVersion,
    optimizer: dep.compiler.optimizer,
  };
  dep.smokeTest = {
    executedAt: new Date().toISOString(),
    transactions: results,
  };
  writeDeployment(dep, net);

  const failed = results.filter((r) => r.ok === false);
  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`  ${failed.length === 0 ? "✅ ALL CHECKS PASSED" : `❌ ${failed.length} CHECK(S) FAILED`}  (${results.filter(r => r.ok !== undefined).length} assertions)`);
  console.log(`  explorer : ${EXPLORER_ADDR(net, dep.address)}`);
  for (const r of results.filter((x) => x.txHash)) {
    console.log(`  ${r.kind.padEnd(9)}: ${EXPLORER_TX(net, r.txHash)}`);
  }
  console.log(`════════════════════════════════════════════════════════════════\n`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error("\nSMOKE TEST FAILED:", e.shortMessage ?? e.message);
  process.exitCode = 1;
});
