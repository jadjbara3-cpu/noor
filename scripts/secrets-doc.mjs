// Generate SECRETS.md — the single human-readable record of everything needed
// to own, operate and recover the Noor project.
//
//   node scripts/secrets-doc.mjs
//
// ⚠️  The output contains private keys. It lives inside the workspace on
//     purpose (the operator asked for that). Never copy it to a public repo,
//     a chat, or a cloud drive.

import fs from "node:fs";
import path from "node:path";
import { ROOT, isMainModule } from "./lib/build.mjs";
import { SECRETS_DIR, PASSWORD_FILE, KEYSTORE_FILE, loadWalletRecord } from "./wallet.mjs";
import { loadMainnetWallet } from "./mainnet-wallet.mjs";
import { ensureAccounts } from "./accounts.mjs";
import { network, readDeployment } from "./lib/arc.mjs";
import { formatUnits } from "ethers";

const OUT = path.join(ROOT, "SECRETS.md");
const KEY_FILE = path.join(SECRETS_DIR, "circle-api-key.txt");

function readIf(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : null;
}

export function buildDoc() {
  const wallet = loadWalletRecord();
  const accounts = ensureAccounts();
  const net = network();
  const dep = readDeployment(net);
  const keystorePassword = readIf(PASSWORD_FILE);
  const circleKey = readIf(KEY_FILE);

  const lines = [];
  const p = (s = "") => lines.push(s);

  p("# 🔐 NOOR (NUR) — SECRETS & OPERATIONS RECORD");
  p();
  p(`Generated: \`${new Date().toISOString()}\``);
  p();
  p("> **This file contains live private keys and passwords.**");
  p("> Anyone holding it controls these wallets. Keep it offline, encrypt it, never commit it.");
  p();
  p("---");
  p();
  p("## 1. Network");
  p();
  p("| Item | Value |");
  p("| :--- | :--- |");
  p(`| Network | ${net.name} |`);
  p(`| Chain ID | \`${net.chainId}\` (hex \`0x${net.chainId.toString(16)}\`) |`);
  p(`| RPC (HTTP) | \`${net.rpc}\` |`);
  p(`| RPC (WS) | \`wss://rpc.testnet.arc.io\` |`);
  p(`| Explorer | ${net.explorer} |`);
  p(`| Alt explorer | ${net.altExplorer} |`);
  p(`| Native gas token | ${net.currency} (18 decimals for gas, 6 for the ERC-20 interface) |`);
  p(`| USDC ERC-20 interface | \`${net.usdcErc20}\` |`);
  p(`| Multicall3 | \`${net.multicall3}\` |`);
  p(`| Permit2 | \`${net.permit2}\` |`);
  p(`| Faucet | ${net.faucet} |`);
  p(`| Faucet API | \`POST https://api.circle.com/v1/faucet/drips\` |`);
  p(`| Min base fee | 20 Gwei (protocol floor — lower txs hang) |`);
  p();
  p("Arc Mainnet (not used by this deployment): chain ID `5042`, RPC `https://rpc.mainnet.arc.io`,");
  p("explorer `https://explorer.arc.io`. Endpoints are permissioned during the private mainnet phase.");
  p();
  p("---");
  p();
  p("## 2. Master seed phrase (BIP-39)");
  p();
  p("**Mnemonic:**");
  p();
  p("```");
  p(wallet?.mnemonic ?? "(none)");
  p("```");
  p();
  p("Every account below is derived from this single phrase at `m/44'/60'/0'/0/<index>`.");
  p("Back up this phrase offline. It recovers everything else in this document.");
  p();
  p("---");
  p();
  p("## 3. Accounts");
  p();
  p("| Role | Index | Address | Share | Private key |");
  p("| :--- | :--- | :--- | :--- | :--- |");
  for (const [role, a] of Object.entries(accounts.accounts)) {
    p(`| **${role}** — ${a.label} | ${a.index} | \`${a.address}\` | ${a.shareBps / 100}% | \`${a.privateKey}\` |`);
  }
  p();
  p("### Private keys in full");
  p();
  for (const [role, a] of Object.entries(accounts.accounts)) {
    p(`**${role}** (${a.label}) — \`${a.derivationPath}\``);
    p();
    p("```");
    p(`address    ${a.address}`);
    p(`privateKey ${a.privateKey}`);
    p("```");
    p();
  }
  p("---");
  p();
  p("## 3b. Arc MAINNET operator wallet (real money)");
  p();
  const mw = loadMainnetWallet();
  if (mw) {
    p("This is the wallet that receives and holds **real USDC**. It is deliberately");
    p("separate from the testnet accounts above, but derived from the same mnemonic in §2.");
    p();
    p("| Item | Value |");
    p("| :--- | :--- |");
    p(`| Address | \`${mw.address}\` |`);
    p(`| Derivation | \`${mw.derivationPath}\` |`);
    p(`| Network | Arc Mainnet — chain ID \`5042\` |`);
    p(`| Created | ${mw.createdAt} |`);
    p(`| File | \`.secrets/${path.basename("mainnet-wallet.json")}\` |`);
    p();
    p("**Private key:**");
    p();
    p("```");
    p(`address    ${mw.address}`);
    p(`privateKey ${mw.privateKey}`);
    p("```");
    p();
    p("> Sending USDC to this address on any network other than Arc Mainnet means");
    p("> permanent loss. Arc is not Base, not Ethereum, not Arbitrum.");
  } else {
    p("_Not created yet._ Run: `node scripts/mainnet-wallet.mjs`");
  }
  p();
  p("---");
  p();
  p("## 3c. Funding route — Base → Arc via Circle CCTP V2");
  p();
  p("Most exchanges (including Binance) do **not** support Arc withdrawals, so the");
  p("USDC arrives on **Base** first and is bridged by `scripts/bridge-to-arc.mjs`.");
  p("The same key and address are used on both chains.");
  p();
  p("| Item | Value |");
  p("| :--- | :--- |");
  p(`| Receiving address | \`${mw ? mw.address : "(none)"}\` |`);
  p("| Source network | Base — chain ID `8453` |");
  p("| Source RPC | `https://mainnet.base.org` |");
  p("| Source USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals) |");
  p("| Source gas token | ETH (base fee ~0.006 gwei — cents per hundred transactions) |");
  p("| Destination | Arc Mainnet — chain ID `5042`, CCTP domain `26` |");
  p("| Source CCTP domain | Base = `6` |");
  p("| TokenMessengerV2 | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` (identical on Base and Arc) |");
  p("| Arc MessageTransmitterV2 | `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` |");
  p("| Attestation API | `https://iris-api.circle.com/v2/messages/6?transactionHash=0x…` |");
  p("| Fee quote API | `https://iris-api.circle.com/v2/burn/USDC/fees/6/26?forward=true` |");
  p("| Forwarding hook | `0x636374702d666f72776172640000000000000000000000000000000000000000` (`cctp-forward`) |");
  p();
  p("**Measured cost** at 2026-09-17: forwarding fee ≈ `0.015955 USDC`, protocol fee");
  p("`0%` on the standard tier / `0.325%` on the fast tier. Base gas is effectively free.");
  p();
  p("The Forwarding Service makes Circle submit the Arc-side `receiveMessage` itself,");
  p("so the Arc wallet needs **no** gas before the transfer lands — essential here,");
  p("because Arc gas is USDC and the wallet starts empty.");
  p();
  p("```bash");
  p("node scripts/bridge-to-arc.mjs          # balances + live fee quote");
  p("node scripts/bridge-to-arc.mjs --yes    # approve, burn, wait for the Arc mint");
  p("```");
  p();
  p("---");
  p();
  p("## 4. Encrypted keystore");
  p();
  p("| Item | Value |");
  p("| :--- | :--- |");
  p(`| Keystore file | \`.secrets/${path.basename(KEYSTORE_FILE)}\` (Web3 Secret Storage v3, scrypt) |`);
  p(`| Keystore address | \`${wallet?.address}\` |`);
  p(`| **Keystore password** | \`${keystorePassword ?? "(none)"}\` |`);
  p();
  p("Decrypt with:");
  p();
  p("```bash");
  p("node -e \"const{Wallet}=require('ethers'),fs=require('fs');\\");
  p("console.log(Wallet.fromEncryptedJsonSync(fs.readFileSync('.secrets/keystore.json','utf8'), process.argv[1]).privateKey)\" \\");
  p(`  '${keystorePassword ?? "PASSWORD"}'`);
  p("```");
  p();
  p("---");
  p();
  p("## 5. Token contracts (one source, two chains)");
  p();
  for (const [label, chainId, fileName] of [
    ["MAINNET — real value", 5042, "5042.json"],
    ["Testnet — rehearsal", 5042002, "5042002.json"],
  ]) {
    const f = path.join(ROOT, "deployments", fileName);
    const d = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
    p(`### ${label} (chain ${chainId})`);
    p();
    if (!d?.address) {
      p("_Not deployed._");
      p();
      continue;
    }
    p("| Item | Value |");
    p("| :--- | :--- |");
    p(`| Name / symbol | ${d.onchain.name} (${d.onchain.symbol}) |`);
    p(`| Address | \`${d.address}\` |`);
    p(`| Deploy tx | \`${d.txHash}\` |`);
    p(`| Block | ${d.blockNumber} |`);
    p(`| Deployer | \`${d.deployer}\` |`);
    p(`| Total supply | ${formatUnits(d.onchain.totalSupply, d.onchain.decimals)} ${d.onchain.symbol} |`);
    p(`| Cap | ${formatUnits(d.onchain.cap, d.onchain.decimals)} ${d.onchain.symbol} |`);
    p(`| Owner | \`${d.onchain.owner}\` |`);
    p(`| Source verified | ${d.verified ? "yes" : "no"}${d.verification?.result ? ` (${d.verification.result})` : ""} |`);
    p(`| Compiler | \`${d.compiler.version}\`, evm \`${d.compiler.evmVersion}\`, optimizer ${d.compiler.optimizer.runs} |`);
    p(`| Explorer | ${d.explorer}/address/${d.address} |`);
    p();
    p("Constructor arguments:");
    p();
    p("```");
    if (Array.isArray(d.constructorArgs)) {
      d.constructorArgs.forEach((a, i) => p(`arg[${i}] = ${a}`));
    } else {
      p(`abi-encoded: ${d.constructorArgsHex ?? "(not recorded)"}`);
    }
    p("```");
    p();
  }
  p("The same source, compiler and settings produce the same runtime bytecode on");
  p("both chains (7,095 bytes, verified exact match on both explorers).");
  p();
  p("---");
  p();
  p("## 6. Credentials & API keys");
  p();
  if (circleKey) {
    p("**Circle faucet API key (testnet):**");
    p();
    p("```");
    p(circleKey);
    p("```");
  } else {
    p("_No Circle API key stored._ Public faucet: " + net.faucet);
  }
  p();
  p("---");
  p();
  p("## 7. Recovery runbook");
  p();
  p("```bash");
  p("cd arc-token");
  p("npm install                 # or: node \"C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js\" install");
  p("node scripts/compile.mjs    # rebuild artifacts + standard-json-input");
  p("node scripts/wallet.mjs     # recreate .secrets/wallet.json (overwrite with the mnemonic above)");
  p("node scripts/accounts.mjs   # recreate .secrets/accounts.json");
  p("node scripts/status.mjs     # read-only health check");
  p("```");
  p();
  p("To restore from the seed phrase, edit `.secrets/wallet.json` and set `mnemonic`");
  p("to the phrase in §2, then re-run `node scripts/accounts.mjs`.");
  p();
  p("---");
  p();
  p("## 8. Files that must never be published");
  p();
  p("- `.secrets/wallet.json` — mnemonic + private key");
  p("- `.secrets/accounts.json` — all private keys");
  p("- `.secrets/keystore.json` + `.secrets/keystore-password.txt` — encrypted key + its password");
  p("- `.secrets/circle-api-key.txt` — Circle API credentials");
  p("- `SECRETS.md` — this file (all of the above in plain text)");
  p();

  return lines.join("\n");
}

function main() {
  const doc = buildDoc();
  fs.writeFileSync(OUT, doc);
  console.log(`wrote ${path.relative(ROOT, OUT)}  (${doc.length} bytes)`);
  console.log("⚠️  contains private keys — keep it offline");
}

if (isMainModule(import.meta.url)) main();
