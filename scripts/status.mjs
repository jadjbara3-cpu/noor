// Read-only status of the Noor token and all project accounts.
//
//   node scripts/status.mjs

import { Contract, formatUnits, formatEther } from "ethers";
import { readArtifact, ROOT } from "./lib/build.mjs";
import { network, provider, readDeployment, EXPLORER_ADDR } from "./lib/arc.mjs";
import { ensureAccounts } from "./accounts.mjs";
import path from "node:path";
import fs from "node:fs";

function rows(pairs) {
  const w = Math.max(...pairs.map(([k]) => k.length));
  for (const [k, v] of pairs) console.log(`  ${k.padEnd(w)} : ${v}`);
}

async function main() {
  const net = network();
  const prov = provider(net);
  const dep = readDeployment(net);

  console.log(`\n=== ${net.name} (chainId ${net.chainId}) ===`);
  rows([
    ["rpc", net.rpc],
    ["explorer", net.explorer],
    ["block", (await prov.getBlockNumber()).toString()],
    ["gas price", formatUnits(await prov.send("eth_gasPrice", []), "gwei") + " gwei"],
  ]);

  const accounts = ensureAccounts();
  console.log(`\n=== accounts (native ${net.currency} = gas) ===`);
  for (const [role, a] of Object.entries(accounts.accounts)) {
    const bal = await prov.getBalance(a.address);
    console.log(`  ${role.padEnd(10)} ${a.address}  ${formatEther(bal).padStart(18)} ${net.currency}`);
  }

  if (!dep?.address) {
    console.log("\n=== token ===\n  not deployed yet");
    return;
  }

  const token = new Contract(dep.address, readArtifact("NoorCoin").abi, prov);
  const decimals = Number(await token.decimals());
  const symbol = await token.symbol();
  const u = (v) => formatUnits(v, decimals);

  console.log(`\n=== ${await token.name()} (${symbol}) ===`);
  rows([
    ["address", dep.address],
    ["explorer", EXPLORER_ADDR(net, dep.address)],
    ["verified", dep.verified ? "yes" : "no"],
    ["deploy tx", dep.txHash],
    ["deployed", dep.deployedAt],
    ["decimals", decimals],
    ["totalSupply", `${u(await token.totalSupply())} ${symbol}`],
    ["cap", `${u(await token.cap())} ${symbol}`],
    ["remainingMintable", `${u(await token.remainingMintable())} ${symbol}`],
    ["owner", await token.owner()],
    ["pendingOwner", await token.pendingOwner()],
    ["treasury", await token.treasury()],
    ["feeBps", (await token.feeBps()).toString()],
    ["limitsEnabled", (await token.limitsEnabled()).toString()],
    ["paused", (await token.paused()).toString()],
  ]);

  console.log("\n=== balances ===");
  for (const [role, a] of Object.entries(accounts.accounts)) {
    const bal = await token.balanceOf(a.address);
    const pct = (Number(bal) / Number(await token.totalSupply())) * 100;
    console.log(`  ${role.padEnd(10)} ${a.address}  ${u(bal).padStart(16)} ${symbol}  ${pct.toFixed(2)}%`);
  }

  const ex = Object.entries(accounts.accounts).filter(([, a]) => a.address);
  console.log("\n=== exemptions ===");
  for (const [role, a] of ex) {
    console.log(`  ${role.padEnd(10)} ${await token.isExempt(a.address)}`);
  }

  const depFile = path.join(ROOT, "deployments", `${net.chainId}.json`);
  console.log(`\nrecord: ${path.relative(ROOT, depFile)}`);
}

main().catch((e) => {
  console.error(e.shortMessage ?? e.message);
  process.exitCode = 1;
});
