// Post-deploy configuration and feature verification.
//
//   node scripts/configure.mjs --dry-run
//   node scripts/configure.mjs
//
// 1. exempts every role wallet from anti-whale limits and transfer fees
// 2. re-reads the configuration to prove the writes landed

import { Contract } from "ethers";
import { readArtifact } from "./lib/build.mjs";
import { network, provider, signer, assertRealMoneyAllowed, feeOverrides, readDeployment, EXPLORER_TX } from "./lib/arc.mjs";
import { ensureAccounts } from "./accounts.mjs";

const DRY = process.argv.includes("--dry-run");

async function main() {
  const net = network();
  assertRealMoneyAllowed(net);
  const dep = readDeployment(net);
  if (!dep?.address) throw new Error("No deployment. Run: node scripts/deploy.mjs");

  const accounts = ensureAccounts();
  const prov = provider(net);
  const owner = signer(net);
  const token = new Contract(dep.address, readArtifact("NoorCoin").abi, owner);
  const fees = await feeOverrides(prov);

  console.log(`token : ${dep.address}`);
  console.log(`owner : ${owner.address}\n`);

  const txs = [];
  for (const [role, a] of Object.entries(accounts.accounts)) {
    const already = await token.isExempt(a.address);
    if (already) {
      console.log(`${role.padEnd(10)} already exempt`);
      continue;
    }
    if (DRY) {
      console.log(`${role.padEnd(10)} would exempt ${a.address}`);
      continue;
    }
    const tx = await token.setExempt(a.address, true, fees);
    process.stdout.write(`${role.padEnd(10)} exempting ${a.address} … ${tx.hash} `);
    const rc = await tx.wait(1);
    console.log(`ok (block ${rc.blockNumber})`);
    txs.push({ role, address: a.address, txHash: tx.hash, block: rc.blockNumber });
  }

  if (DRY) {
    console.log("\ndry run — nothing sent");
    return;
  }

  console.log("\n=== verified configuration ===");
  console.log(`  feeBps        : ${await token.feeBps()}`);
  console.log(`  treasury      : ${await token.treasury()}`);
  console.log(`  limitsEnabled : ${await token.limitsEnabled()}`);
  console.log(`  paused        : ${await token.paused()}`);
  console.log(`  cap           : ${await token.cap()}`);
  console.log(`  totalSupply   : ${await token.totalSupply()}`);
  console.log(`  owner         : ${await token.owner()}`);
  for (const [role, a] of Object.entries(accounts.accounts)) {
    console.log(`  exempt[${role}] : ${await token.isExempt(a.address)}`);
  }

  for (const t of txs) console.log(`\n  ${t.role}: ${EXPLORER_TX(net, t.txHash)}`);
}

main().catch((e) => {
  console.error("CONFIGURE FAILED:", e.shortMessage ?? e.message);
  process.exitCode = 1;
});
