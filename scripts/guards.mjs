// Safety-property checks against the live deployment. Every assertion here is
// expected to REVERT; a passing run proves the token's guardrails are real.
//
//   node scripts/guards.mjs

import { Contract, parseUnits, formatUnits } from "ethers";
import { readArtifact } from "./lib/build.mjs";
import { network, provider, signer, assertRealMoneyAllowed, feeOverrides, readDeployment, EXPLORER_TX } from "./lib/arc.mjs";
import { ensureAccounts } from "./accounts.mjs";

async function expectRevert(label, fn, token) {
  try {
    const tx = await fn();
    if (tx?.wait) await tx.wait(1);
    console.log(`  ❌ ${label}: UNEXPECTEDLY SUCCEEDED`);
    return false;
  } catch (e) {
    const msg = (e.shortMessage ?? e.message).replace(/\s+/g, " ").slice(0, 110);
    console.log(`  ✅ ${label}: reverted — ${msg}`);
    return true;
  }
}

async function main() {
  const net = network();
  assertRealMoneyAllowed(net);
  const dep = readDeployment(net);
  if (!dep?.address) throw new Error("No deployment");

  const accounts = ensureAccounts();
  const prov = provider(net);
  const owner = signer(net);
  const comm = accounts.accounts.community;
  const artifact = readArtifact("NoorCoin");
  const token = new Contract(dep.address, artifact.abi, owner);
  const outsider = new Contract(dep.address, artifact.abi, owner).connect(
    new (await import("ethers")).Wallet(comm.privateKey, prov)
  );
  const fees = await feeOverrides(prov);
  const u = (v) => formatUnits(v, 18);
  const symbol = await token.symbol();

  let pass = 0;
  let total = 0;
  const check = async (label, fn) => {
    total++;
    if (await expectRevert(label, fn, token)) pass++;
  };

  console.log(`=== Noor safety guards @ ${dep.address} ===\n`);

  const remaining = await token.remainingMintable();
  console.log(`remainingMintable = ${u(remaining)} ${symbol}\n`);

  await check("mint one wei past the 1,000,000,000 cap", () =>
    token.mint(owner.address, remaining + 1n, fees)
  );

  await check("setFee above the 5% hard ceiling", () =>
    token.setFee(501, owner.address, fees)
  );

  await check("setFee with the zero address as treasury", () =>
    token.setFee(0, "0x0000000000000000000000000000000000000000", fees)
  );

  await check("non-owner calling setExempt", () =>
    outsider.setExempt(comm.address, false, fees)
  );

  await check("non-owner calling setLimits", () =>
    outsider.setLimits(1, 1, true, fees)
  );

  await check("non-owner calling pause", () => outsider.pause(fees));

  await check("setLimits(true) with a zero maxTx", () =>
    token.setLimits(0, parseUnits("1000", 18), true, fees)
  );

  // --- pause / unpause circuit breaker -------------------------------------
  console.log("\n  -- pause circuit breaker --");
  const pauseTx = await token.pause(fees);
  await pauseTx.wait(1);
  console.log(`  paused: ${await token.paused()}  (${pauseTx.hash})`);

  await check("transfer while paused", () =>
    token.transfer(comm.address, 1n, fees)
  );

  const unpauseTx = await token.unpause(fees);
  await unpauseTx.wait(1);
  console.log(`  unpaused: ${!(await token.paused())}  (${unpauseTx.hash})`);

  total++;
  const liveTx = await token.transfer(comm.address, parseUnits("1", 18), fees);
  await liveTx.wait(1);
  console.log(`  ✅ transfer after unpause: succeeded — ${liveTx.hash}`);
  pass++;

  console.log(`\n=== ${pass}/${total} safety properties hold ===`);
  console.log(`\n  pause   : ${EXPLORER_TX(net, pauseTx.hash)}`);
  console.log(`  unpause : ${EXPLORER_TX(net, unpauseTx.hash)}`);
  console.log(`  transfer: ${EXPLORER_TX(net, liveTx.hash)}`);

  console.log("\n=== final state ===");
  console.log(`  totalSupply     : ${u(await token.totalSupply())} ${symbol}`);
  console.log(`  cap             : ${u(await token.cap())} ${symbol}`);
  console.log(`  remainingMintable: ${u(await token.remainingMintable())} ${symbol}`);
  console.log(`  paused          : ${await token.paused()}`);
  console.log(`  feeBps          : ${await token.feeBps()}`);
  console.log(`  limitsEnabled   : ${await token.limitsEnabled()}`);

  if (pass !== total) process.exitCode = 1;
}

main().catch((e) => {
  console.error("\nGUARDS FAILED:", e.shortMessage ?? e.message);
  process.exitCode = 1;
});
