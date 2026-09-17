// Wallet generation + secret persistence for the Noor project.
//
//   node scripts/wallet.mjs            -> create if missing, then report address
//   node scripts/wallet.mjs --show     -> report address + balances
//
// SECURITY: private material is written to arc-token/.secrets/ (workspace local).
// Nothing secret is ever printed to stdout.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Wallet, JsonRpcProvider, formatEther } from "ethers";
import { ROOT, isMainModule } from "./lib/build.mjs";

export const SECRETS_DIR = path.join(ROOT, ".secrets");
export const WALLET_FILE = path.join(SECRETS_DIR, "wallet.json");
export const KEYSTORE_FILE = path.join(SECRETS_DIR, "keystore.json");
export const PASSWORD_FILE = path.join(SECRETS_DIR, "keystore-password.txt");

const RPC = process.env.ARC_RPC ?? "https://rpc.testnet.arc.io";

function ensureDir() {
  fs.mkdirSync(SECRETS_DIR, { recursive: true });
}

export function loadWalletRecord() {
  if (!fs.existsSync(WALLET_FILE)) return null;
  return JSON.parse(fs.readFileSync(WALLET_FILE, "utf8"));
}

function createWallet() {
  ensureDir();

  const entropy = crypto.randomBytes(32);
  const wallet = Wallet.createRandom({ extraEntropy: entropy });
  const password = crypto.randomBytes(32).toString("base64url");

  const record = {
    scheme: "bip39-secp256k1",
    derivationPath: wallet.path,
    address: wallet.address,
    publicKey: wallet.signingKey.publicKey,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic.phrase,
    createdAt: new Date().toISOString(),
    networks: {
      "arc-testnet": { chainId: 5042002, rpc: "https://rpc.testnet.arc.io" },
      "arc-mainnet": { chainId: 5042, rpc: "https://rpc.mainnet.arc.io" },
    },
  };

  fs.writeFileSync(WALLET_FILE, JSON.stringify(record, null, 2));
  fs.writeFileSync(PASSWORD_FILE, password + "\n");

  // Encrypted keystore (scrypt / Web3 Secret Storage v3).
  const keystoreJson = JSON.stringify(wallet.encryptSync(password, { scrypt: { N: 1 << 18 } }));
  fs.writeFileSync(KEYSTORE_FILE, keystoreJson);

  return record;
}

export function getWallet() {
  const record = loadWalletRecord();
  if (!record) throw new Error("No wallet yet — run: node scripts/wallet.mjs");
  return new Wallet(record.privateKey);
}

async function main() {
  const show = process.argv.includes("--show");
  let record = loadWalletRecord();

  if (!record && show) {
    console.log("no wallet found; run without --show to create one");
    return;
  }

  if (!record) {
    record = createWallet();
    console.log("created new wallet");
  }

  console.log("address     :", record.address);
  console.log("derivation  :", record.derivationPath ?? "(random key, no path)");
  console.log("secrets dir :", path.relative(ROOT, SECRETS_DIR));
  console.log("keystore    :", path.relative(ROOT, KEYSTORE_FILE));

  if (show) {
    const provider = new JsonRpcProvider(RPC, 5042002);
    const [balance, nonce, net] = await Promise.all([
      provider.getBalance(record.address),
      provider.getTransactionCount(record.address),
      provider.getNetwork(),
    ]);
    console.log("rpc         :", RPC);
    console.log("chainId     :", net.chainId.toString());
    console.log("balance     :", formatEther(balance), "USDC (testnet gas token)");
    console.log("tx count    :", nonce);
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
