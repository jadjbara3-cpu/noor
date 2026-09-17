// Create an additional named wallet derived from the project mnemonic.
//
//   node scripts/new-wallet.mjs <name>          # e.g. trader, savings, ops
//   node scripts/new-wallet.mjs <name> --show
//
// Wallets live in .secrets/extra-wallets.json and are keyed by name. Indices in
// the 10..49 range are reserved for these auxiliary wallets so they can never
// collide with the allocation accounts (0..3) or the mainnet operator (10).

import fs from "node:fs";
import path from "node:path";
import { HDNodeWallet, Mnemonic, JsonRpcProvider, formatEther } from "ethers";
import { ROOT, isMainModule } from "./lib/build.mjs";
import { loadWalletRecord, SECRETS_DIR } from "./wallet.mjs";

const EXTRA_FILE = path.join(SECRETS_DIR, "extra-wallets.json");
const FIRST_INDEX = 11;

function loadExtra() {
  if (!fs.existsSync(EXTRA_FILE)) return { scheme: "bip39-bip44", wallets: {} };
  return JSON.parse(fs.readFileSync(EXTRA_FILE, "utf8"));
}

function saveExtra(data) {
  fs.mkdirSync(SECRETS_DIR, { recursive: true });
  fs.writeFileSync(EXTRA_FILE, JSON.stringify(data, null, 2));
}

export function createWallet(name, purpose = "") {
  const master = loadWalletRecord();
  if (!master) throw new Error("No master wallet. Run: node scripts/wallet.mjs");

  const data = loadExtra();
  if (data.wallets[name]) return data.wallets[name];

  const used = Object.values(data.wallets).map((w) => w.index);
  let index = FIRST_INDEX;
  while (used.includes(index)) index++;

  const hd = HDNodeWallet.fromMnemonic(
    Mnemonic.fromPhrase(master.mnemonic),
    `m/44'/60'/0'/0/${index}`
  );

  const record = {
    name,
    purpose: purpose || "(unspecified)",
    index,
    derivationPath: `m/44'/60'/0'/0/${index}`,
    address: hd.address,
    privateKey: hd.privateKey,
    createdAt: new Date().toISOString(),
  };

  data.wallets[name] = record;
  saveExtra(data);
  return record;
}

export function getWallet(name) {
  const data = loadExtra();
  const w = data.wallets[name];
  if (!w) throw new Error(`No wallet named "${name}". Known: ${Object.keys(data.wallets).join(", ") || "(none)"}`);
  return w;
}

export function listWallets() {
  return Object.values(loadExtra().wallets);
}

async function main() {
  const name = process.argv[2];
  if (!name || name.startsWith("--")) {
    const all = listWallets();
    console.log(`\nauxiliary wallets (${all.length}):`);
    for (const w of all) {
      console.log(`  ${w.name.padEnd(12)} ${w.address}  ${w.derivationPath}  — ${w.purpose}`);
    }
    console.log(`\nfile: ${path.relative(ROOT, EXTRA_FILE)}\n`);
    return;
  }

  const existing = fs.existsSync(EXTRA_FILE) && loadExtra().wallets[name];
  const purposeIdx = process.argv.indexOf("--purpose");
  const purpose = purposeIdx !== -1 ? process.argv[purposeIdx + 1] : "";
  const w = createWallet(name, purpose);

  console.log(`\n  ${existing ? "existing" : "NEW"} wallet "${w.name}"`);
  console.log(`  ${"─".repeat(64)}`);
  console.log(`  address    : ${w.address}`);
  console.log(`  path       : ${w.derivationPath}`);
  console.log(`  purpose    : ${w.purpose}`);
  console.log(`  file       : ${path.relative(ROOT, EXTRA_FILE)}`);

  const prov = new JsonRpcProvider("https://rpc.mainnet.arc.io", 5042, { staticNetwork: true });
  const base = new JsonRpcProvider("https://mainnet.base.org", 8453, { staticNetwork: true });
  const [arc, baseBal] = await Promise.all([prov.getBalance(w.address), base.getBalance(w.address)]);
  console.log(`\n  Arc mainnet : ${formatEther(arc)} USDC`);
  console.log(`  Base        : ${formatEther(baseBal)} ETH\n`);
}

if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
