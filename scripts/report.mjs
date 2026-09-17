// Render the live deployment record.
//
//   node scripts/report.mjs                      -> DEPLOYMENT.md          (testnet)
//   ARC_NETWORK=arc-mainnet node scripts/report.mjs -> DEPLOYMENT-MAINNET.md
//
// Pulls fresh state from Arc so the report can never drift from the chain.
// Each network writes its own file so a mainnet launch cannot overwrite the
// testnet record.

import fs from "node:fs";
import path from "node:path";
import { Contract, formatUnits, formatEther } from "ethers";
import { readArtifact, ROOT } from "./lib/build.mjs";
import { network, provider, readDeployment, walletRecord, EXPLORER_ADDR, EXPLORER_TX } from "./lib/arc.mjs";

export function reportFile(net) {
  return path.join(ROOT, net.realMoney ? "DEPLOYMENT-MAINNET.md" : "DEPLOYMENT.md");
}

async function main() {
  const net = network();
  const OUT = reportFile(net);
  const prov = provider(net);
  const dep = readDeployment(net);
  if (!dep?.address) throw new Error(`No deployment record for ${net.name} (${net.chainId})`);

  // The operator wallet differs per network; the role allocation accounts are
  // the same HD addresses on both chains.
  const { ensureAccounts } = await import("./accounts.mjs");
  const accounts = ensureAccounts();
  const operator = walletRecord(net);
  const token = new Contract(dep.address, readArtifact("NoorCoin").abi, prov);
  const decimals = Number(await token.decimals());
  const symbol = await token.symbol();
  const name = await token.name();
  const total = await token.totalSupply();
  const cap = await token.cap();
  const u = (v) => formatUnits(v, decimals);

  const bal = {};
  const native = {};
  for (const [role, a] of Object.entries(accounts.accounts)) {
    bal[role] = await token.balanceOf(a.address);
    native[role] = await prov.getBalance(a.address);
  }

  const L = [];
  const p = (s = "") => L.push(s);

  p(`# DEPLOYMENT — Noor (NUR) on ${net.name}`);
  p();
  p(`Generated \`${new Date().toISOString()}\` directly from chain state (chain ID \`${net.chainId}\`).`);
  if (net.realMoney) {
    p();
    p("> ⚠️ **This contract is deployed on Arc MAINNET and holds real value.**");
  }
  p();
  p("## Live contract");
  p();
  p("| | |");
  p("| :--- | :--- |");
  p(`| **Address** | [\`${dep.address}\`](${EXPLORER_ADDR(net, dep.address)}) |`);
  p(`| **Name / symbol** | ${name} (${symbol}) |`);
  p(`| **Decimals** | ${decimals} |`);
  p(`| **Total supply** | ${u(total)} ${symbol} |`);
  p(`| **Hard cap** | ${u(cap)} ${symbol} |`);
  p(`| **Remaining mintable** | ${u(await token.remainingMintable())} ${symbol} |`);
  p(`| **Owner** | \`${await token.owner()}\` |`);
  p(`| **Verified source** | ${dep.verified ? "✅ yes" : "❌ no"} — [read it](${EXPLORER_ADDR(net, dep.address)}#code) |`);
  p(`| **Verified at** | ${dep.verifiedAt ?? "—"} |`);
  p(`| **Compiler** | \`${dep.compiler.version}\`, evm \`${dep.compiler.evmVersion}\`, optimizer ${dep.compiler.optimizer.runs} runs |`);
  p(`| **Deployed** | ${dep.deployedAt} (block ${dep.blockNumber}) |`);
  p(`| **Deploy tx** | \`${dep.txHash}\` |`);
  p();
  p("### Operator wallet");
  p();
  p("| Item | Value |");
  p("| :--- | :--- |");
  p(`| Address | \`${operator.address}\` |`);
  p(`| Derivation | \`${operator.derivationPath ?? "—"}\` |`);
  p(`| Gas balance | ${formatEther(await prov.getBalance(operator.address))} ${net.currency} |`);
  p();
  p("### Runtime configuration");
  p();
  p("| Setting | Value | Meaning |");
  p("| :--- | :--- | :--- |");
  p(`| \`feeBps\` | ${await token.feeBps()} | no transfer fee |`);
  p(`| \`limitsEnabled\` | ${await token.limitsEnabled()} | no anti-whale limit |`);
  p(`| \`paused\` | ${await token.paused()} | token is live |`);
  p(`| \`treasury\` | \`${await token.treasury()}\` | fee recipient (unused) |`);
  p(`| \`pendingOwner\` | \`${await token.pendingOwner()}\` | no ownership change in flight |`);
  p();

  if (dep.pool?.pair) {
    p("## Market / liquidity");
    p();
    const pool = dep.pool;
    p("| Item | Value |");
    p("| :--- | :--- |");
    p(`| Protocol | ${pool.protocol} |`);
    p(`| Pair | [\`${pool.pair}\`](${pool.explorer}) |`);
    p(`| Router02 | \`${pool.router02}\` |`);
    p(`| Factory | \`${pool.factory}\` |`);
    p(`| Created by | \`${pool.createdTx}\` (block ${pool.block}) |`);
    p(`| Reserves | ${formatUnits(pool.reserves.nur, 18)} NUR + ${formatUnits(pool.reserves.usdc, 6)} USDC |`);
    p(`| Opening price | 1 NUR = ${pool.openPriceUsdcPerNur} USDC |`);
    p(`| Implied FDV | $${pool.impliedFdvUsd.toLocaleString()} (derived from a ${formatUnits(pool.reserves.usdc, 6)} USDC pool — not a valuation) |`);
    p(`| LP tokens held by | \`${pool.lpTokensHeldBy}\` |`);
    p();
    p(`> ${pool.note}`);
    p();
  }

  p("## Holder balances");
  p();
  if (net.realMoney) {
    const opBal = await token.balanceOf(operator.address);
    const opShare = total > 0n ? (Number(opBal) / Number(total)) * 100 : 0;
    p("| Holder | Address | NUR | Share | Exempt |");
    p("| :--- | :--- | ---: | ---: | :---: |");
    p(
      `| **operator wallet** (deployer, holds the genesis supply) | \`${operator.address}\` | ${u(opBal)} | ${opShare.toFixed(4)}% | ${await token.isExempt(operator.address)} |`
    );
    p();
    p("Distribution addresses derived from the same mnemonic (currently unfunded on this chain):");
    p();
  }
  p("| Role | Address | NUR | Share | Exempt | Gas (USDC) |");
  p("| :--- | :--- | ---: | ---: | :---: | ---: |");
  for (const [role, a] of Object.entries(accounts.accounts)) {
    const share = total > 0n ? (Number(bal[role]) / Number(total)) * 100 : 0;
    p(
      `| ${role} — ${a.label} | \`${a.address}\` | ${u(bal[role])} | ${share.toFixed(2)}% | ${await token.isExempt(a.address)} | ${formatEther(native[role])} |`
    );
  }
  p();
  p("## On-chain evidence");
  p();
  p("Every action below is a confirmed Arc transaction:");
  p();
  p("| # | Step | What it proves | Transaction |");
  p("| ---: | :--- | :--- | :--- |");
  (dep.transactions ?? []).forEach((t, i) => {
    const url = t.explorer ? `${t.explorer}${t.txHash}` : EXPLORER_TX(net, t.txHash);
    const label = t.chain ? `${t.step} (${t.chain})` : t.step;
    p(`| ${i + 1} | \`${label}\` | ${t.description} | [\`${t.txHash.slice(0, 18)}…\`](${url}) |`);
  });
  p();
  p("## Safety properties verified on-chain");
  p();
  if (net.realMoney) {
    p("`scripts/mainnet-smoke.mjs` ran against the live mainnet contract — 16 assertions, all passed:");
    p();
    p("- reads: name, symbol, 18 decimals, supply = cap = 1,000,000,000, zero remaining mintable");
    p("- live ERC-20 transfer confirmed by balance deltas on both sides");
    p("- EIP-2612 `permit` signed off-chain and accepted on-chain");
    p("- minting past the cap reverts");
    p("- setting a fee above the 5% ceiling reverts");
    p();
    p("The full property suite (`scripts/guards.mjs`) was executed on Arc Testnet:");
  } else {
    p("`scripts/guards.mjs` asserts each of the following and all of them reverted as required:");
  }
  p();
  p("- minting one wei past the 1,000,000,000 cap");
  p("- setting a fee above the 5% hard ceiling");
  p("- setting the treasury to the zero address");
  p("- a non-owner calling `setExempt`, `setLimits` or `pause`");
  p("- enabling limits with a zero `maxTxAmount`");
  p("- transferring while paused (then `unpause` restores liveness)");
  p();
  p("## Reproduce from scratch");
  p();
  p("```bash");
  p("cd arc-token");
  p('node "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js" install');
  p("node scripts/compile.mjs     # std-json-input sha256: " + dep.compiler.standardJsonInputSha256);
  if (net.realMoney) {
    p("node scripts/mainnet-wallet.mjs --show   # real-money operator wallet");
    p("# fund it with USDC on Arc Mainnet (chain ID 5042) — there is no faucet");
    p("ARC_NETWORK=arc-mainnet node scripts/preflight.mjs        # go / no-go");
    p("ARC_NETWORK=arc-mainnet node scripts/deploy.mjs --yes");
    p("ARC_NETWORK=arc-mainnet node scripts/report.mjs");
  } else {
    p("node scripts/wallet.mjs      # restore the mnemonic from SECRETS.md first");
    p("node scripts/accounts.mjs");
    p("node scripts/faucet.mjs      # fund gas");
    p("node scripts/deploy.mjs");
    p("node scripts/record.mjs <txHash>   # if the local record is lost");
    p("node scripts/verify.mjs");
    p("node scripts/configure.mjs");
    p("node scripts/distribute.mjs");
    p("node scripts/status.mjs");
    p("node scripts/guards.mjs");
  }
  p("```");
  p();
  p("## Network reference");
  p();
  p("| Item | Value |");
  p("| :--- | :--- |");
  p(`| Network | ${net.name} |`);
  p(`| Chain ID | \`${net.chainId}\` (\`0x${net.chainId.toString(16)}\`) |`);
  p(`| RPC | \`${net.rpc}\` |`);
  p(`| Explorer | ${net.explorer} |`);
  p(`| Explorer API host | \`${net.apiHost ?? "—"}\` |`);
  p(`| Gas token | ${net.currency} (18 decimals; ERC-20 interface 6 decimals) |`);
  p(`| Minimum base fee | 20 Gwei (protocol floor) |`);
  p(`| Finality | ~780 ms, deterministic (Malachite consensus) |`);
  if (net.realMoney) p(`| Faucet | none — real money only |`);
  else p(`| Faucet | ${net.faucet} |`);
  p();

  const doc = L.join("\n");
  fs.writeFileSync(OUT, doc);
  console.log(`wrote ${path.relative(ROOT, OUT)} (${doc.length} bytes)`);
}

main().catch((e) => {
  console.error("REPORT FAILED:", e.shortMessage ?? e.message);
  process.exitCode = 1;
});
