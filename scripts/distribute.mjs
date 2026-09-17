// Distribute the genesis supply according to the published allocation.
//
//   node scripts/distribute.mjs --dry-run
//   node scripts/distribute.mjs
//
// The deployer wallet holds 100% of the genesis supply after deployment; this
// script moves each tranche to its role wallet, producing verifiable on-chain
// evidence that ordinary transfers work.

import { Contract, formatUnits, parseUnits } from "ethers";
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
  const artifact = readArtifact("NoorCoin");
  const token = new Contract(dep.address, artifact.abi, owner);

  const decimals = Number(await token.decimals());
  const symbol = await token.symbol();
  const total = await token.totalSupply();

  console.log(`token    : ${await token.name()} (${symbol}) @ ${dep.address}`);
  console.log(`supply   : ${formatUnits(total, decimals)} ${symbol}`);
  console.log(`sender   : ${owner.address}\n`);

  const plans = Object.entries(accounts.accounts)
    .filter(([role]) => role !== "main")
    .map(([role, a]) => ({
      role,
      to: a.address,
      label: a.label,
      amount: (total * BigInt(a.shareBps)) / 10_000n,
    }));

  for (const p of plans) {
    console.log(
      `${p.role.padEnd(10)} ${(Number(p.shareBps ?? 0) || "").toString().padStart(0)}${formatUnits(p.amount, decimals).padStart(16)} ${symbol}  ->  ${p.to}  (${p.label})`
    );
  }

  if (DRY) {
    console.log("\ndry run — nothing sent");
    return;
  }

  const fees = await feeOverrides(prov);
  const results = [];

  for (const p of plans) {
    const balance = await token.balanceOf(owner.address);
    if (balance < p.amount) throw new Error(`Insufficient balance for ${p.role}: ${balance} < ${p.amount}`);

    const tx = await token.transfer(p.to, p.amount, fees);
    process.stdout.write(`\n${p.role}: ${tx.hash} … `);
    const rc = await tx.wait(1);
    console.log(`confirmed in block ${rc.blockNumber} (gas ${rc.gasUsed})`);
    results.push({ role: p.role, to: p.to, amount: p.amount.toString(), txHash: tx.hash, block: rc.blockNumber });
  }

  console.log("\nfinal balances:");
  for (const [role, a] of Object.entries(accounts.accounts)) {
    const bal = await token.balanceOf(a.address);
    console.log(`  ${role.padEnd(10)} ${formatUnits(bal, decimals).padStart(16)} ${symbol}`);
  }

  console.log("\ntransactions:");
  for (const r of results) console.log(`  ${r.role.padEnd(10)} ${EXPLORER_TX(net, r.txHash)}`);
}

main().catch((e) => {
  console.error("\nDISTRIBUTE FAILED:", e.shortMessage ?? e.message);
  process.exitCode = 1;
});
