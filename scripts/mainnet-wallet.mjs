// Dedicated Arc MAINNET operator wallet for the Noor project.
//
//   node scripts/mainnet-wallet.mjs            create if missing + show balances
//   node scripts/mainnet-wallet.mjs --show     report only
//
// Kept separate from the testnet accounts on purpose: this key is the one that
// will receive and hold real money, so it gets its own derivation index and its
// own file. It is still derived from the same master mnemonic, so the single
// seed phrase in SECRETS.md recovers everything.

import fs from "node:fs";
import path from "node:path";
import { HDNodeWallet, Mnemonic, Wallet, JsonRpcProvider, formatEther } from "ethers";
import { ROOT, isMainModule } from "./lib/build.mjs";
import { loadWalletRecord, SECRETS_DIR } from "./wallet.mjs";

export const MAINNET_INDEX = 10;
export const MAINNET_FILE = path.join(SECRETS_DIR, "mainnet-wallet.json");

const MAINNET = { chainId: 5042, rpc: "https://rpc.mainnet.arc.io", explorer: "https://explorer.arc.io" };
const TESTNET = { chainId: 5042002, rpc: "https://rpc.testnet.arc.io", explorer: "https://testnet.arcscan.app" };

export function loadMainnetWallet() {
  if (!fs.existsSync(MAINNET_FILE)) return null;
  return JSON.parse(fs.readFileSync(MAINNET_FILE, "utf8"));
}

export function createMainnetWallet() {
  const master = loadWalletRecord();
  if (!master) throw new Error("No master wallet. Run: node scripts/wallet.mjs");

  const mnemonic = Mnemonic.fromPhrase(master.mnemonic);
  const path_ = `m/44'/60'/0'/0/${MAINNET_INDEX}`;
  const hd = HDNodeWallet.fromMnemonic(mnemonic, path_);

  const record = {
    role: "arc-mainnet-operator",
    purpose: "Receives real USDC on Arc mainnet; deploys and operates Noor (NUR) on mainnet.",
    network: "Arc Mainnet",
    chainId: MAINNET.chainId,
    derivationPath: path_,
    address: hd.address,
    publicKey: hd.signingKey.publicKey,
    privateKey: hd.privateKey,
    createdAt: new Date().toISOString(),
    warning: "REAL MONEY WALLET. Never share this file or its private key.",
  };

  fs.mkdirSync(SECRETS_DIR, { recursive: true });
  fs.writeFileSync(MAINNET_FILE, JSON.stringify(record, null, 2));
  return record;
}

export function ensureMainnetWallet() {
  return loadMainnetWallet() ?? createMainnetWallet();
}

export function mainnetSigner() {
  const rec = ensureMainnetWallet();
  return new Wallet(rec.privateKey, new JsonRpcProvider(MAINNET.rpc, MAINNET.chainId, { staticNetwork: true }));
}

async function main() {
  const show = process.argv.includes("--show");
  const existed = fs.existsSync(MAINNET_FILE);
  const rec = show ? loadMainnetWallet() : ensureMainnetWallet();
  if (!rec) {
    console.log("no mainnet wallet yet — run without --show");
    return;
  }

  console.log(`\n  ${existed ? "existing" : "NEW"} Arc mainnet operator wallet`);
  console.log(`  ${"─".repeat(70)}`);
  console.log(`  address    : ${rec.address}`);
  console.log(`  path       : ${rec.derivationPath}`);
  console.log(`  file       : ${path.relative(ROOT, MAINNET_FILE)}`);
  console.log(`  created    : ${rec.createdAt}`);

  console.log(`\n  send real USDC to this EXACT address on this EXACT network:\n`);
  console.log(`    network    : Arc Mainnet`);
  console.log(`    chain ID   : ${MAINNET.chainId}`);
  console.log(`    token      : USDC (native — it also pays gas)`);
  console.log(`    address    : ${rec.address}`);
  console.log(`\n  ⚠  wrong network = permanent loss. Arc is NOT Base, NOT Ethereum, NOT Arbitrum.`);

  const m = new JsonRpcProvider(MAINNET.rpc, MAINNET.chainId, { staticNetwork: true });
  const t = new JsonRpcProvider(TESTNET.rpc, TESTNET.chainId, { staticNetwork: true });
  const [mb, tb] = await Promise.all([m.getBalance(rec.address), t.getBalance(rec.address)]);
  console.log(`\n  Arc mainnet balance : ${formatEther(mb)} USDC`);
  console.log(`  Arc testnet balance : ${formatEther(tb)} USDC`);
  console.log(`\n  explorer   : ${MAINNET.explorer}/address/${rec.address}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
