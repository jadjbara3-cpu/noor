// Allocation accounts derived from the project mnemonic.
//
//   node scripts/accounts.mjs          # create/refresh .secrets/accounts.json
//
// All accounts are HD-derived from the same seed phrase stored in
// .secrets/wallet.json, so the whole project is recoverable from one backup.

import fs from "node:fs";
import path from "node:path";
import { HDNodeWallet, Mnemonic, Wallet, formatEther } from "ethers";
import { ROOT, isMainModule } from "./lib/build.mjs";
import { network, provider } from "./lib/arc.mjs";
import { loadWalletRecord, SECRETS_DIR } from "./wallet.mjs";

export const ACCOUNTS_FILE = path.join(SECRETS_DIR, "accounts.json");

/** role -> { index, label, share (bps of 10_000) } */
export const ALLOCATION = {
  main: { index: 0, label: "Deployer / Treasury operations", share: 4000 },
  community: { index: 1, label: "Community, airdrop & rewards pool", share: 3000 },
  liquidity: { index: 2, label: "Liquidity provision / market making", share: 2000 },
  ecosystem: { index: 3, label: "Ecosystem & development fund", share: 1000 },
};

export function loadAccounts() {
  if (!fs.existsSync(ACCOUNTS_FILE)) return null;
  return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8"));
}

export function createAccounts() {
  const main = loadWalletRecord();
  if (!main) throw new Error("No main wallet. Run: node scripts/wallet.mjs");

  const mnemonic = Mnemonic.fromPhrase(main.mnemonic);
  const accounts = {};

  for (const [role, cfg] of Object.entries(ALLOCATION)) {
    const hd = HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${cfg.index}`);
    accounts[role] = {
      role,
      index: cfg.index,
      label: cfg.label,
      shareBps: cfg.share,
      derivationPath: `m/44'/60'/0'/0/${cfg.index}`,
      address: hd.address,
      privateKey: hd.privateKey,
    };
  }

  if (accounts.main.address !== main.address) {
    throw new Error(
      `Derivation mismatch: mnemonic index 0 = ${accounts.main.address}, recorded main = ${main.address}`
    );
  }

  const payload = {
    scheme: "bip39-bip44-secp256k1",
    mnemonic: main.mnemonic,
    createdAt: new Date().toISOString(),
    accounts,
  };
  fs.mkdirSync(SECRETS_DIR, { recursive: true });
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(payload, null, 2));
  return payload;
}

export function ensureAccounts() {
  return loadAccounts() ?? createAccounts();
}

export function signerFor(role, net = network()) {
  const data = ensureAccounts();
  const acct = data.accounts[role];
  if (!acct) throw new Error(`Unknown role "${role}". Known: ${Object.keys(data.accounts).join(", ")}`);
  return new Wallet(acct.privateKey, provider(net));
}

async function main() {
  const created = ensureAccounts();
  const prov = provider();
  const showBalances = process.argv.includes("--balances");

  console.log("role        index  address                                     share    label");
  for (const [role, a] of Object.entries(created.accounts)) {
    let bal = "";
    if (showBalances) {
      bal = "  " + formatEther(await prov.getBalance(a.address)) + " USDC";
    }
    console.log(
      `${role.padEnd(11)} ${String(a.index).padEnd(6)} ${a.address}  ${String(a.shareBps / 100).padStart(3)}%    ${a.label}${bal}`
    );
  }
  console.log(`\nfile: ${path.relative(ROOT, ACCOUNTS_FILE)}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
