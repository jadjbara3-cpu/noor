// Shared Arc network helpers: provider, gas policy, deployment records.

import fs from "node:fs";
import path from "node:path";
import { JsonRpcProvider, Wallet, parseUnits } from "ethers";
import { ROOT } from "./build.mjs";
import { loadWalletRecord } from "../wallet.mjs";

export const NETWORKS = {
  "arc-testnet": {
    name: "Arc Testnet",
    chainId: 5042002,
    rpc: "https://rpc.testnet.arc.io",
    explorer: "https://testnet.arcscan.app",
    altExplorer: "https://explorer.testnet.arc.io",
    // Blockscout's canonical API host for this chain. testnet.arcscan.app is a
    // CDN alias whose Cloudflare edge rejects the large verification payloads.
    apiHost: "https://explorer.testnet.arc.io",
    currency: "USDC",
    faucet: "https://faucet.circle.com",
    usdcErc20: "0x3600000000000000000000000000000000000000",
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    // CCTP V2 — testnet uses its own contract set and Circle's sandbox attestation API.
    cctpDomain: 26,
    tokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
    messageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
    irisApi: "https://iris-api-sandbox.circle.com",
  },
  "arc-mainnet": {
    name: "Arc Mainnet",
    chainId: 5042,
    rpc: "https://rpc.mainnet.arc.io",
    explorer: "https://explorer.arc.io",
    apiHost: "https://explorer.arc.io",
    currency: "USDC",
    // Real money. The operator wallet lives in .secrets/mainnet-wallet.json.
    realMoney: true,
    usdcErc20: "0x3600000000000000000000000000000000000000",
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    // CCTP V2 — Arc's Circle domain and the shared MessageTransmitterV2 address.
    cctpDomain: 26,
    tokenMessengerV2: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
    messageTransmitterV2: "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64",
    irisApi: "https://iris-api.circle.com",
  },
  // Source chain for funding Arc when the user's exchange does not support Arc.
  // CCTP V2 lives at identical addresses on every supported chain.
  base: {
    name: "Base",
    chainId: 8453,
    rpc: process.env.BASE_RPC ?? "https://mainnet.base.org",
    explorer: "https://basescan.org",
    currency: "ETH",
    realMoney: true,
    usdcErc20: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    cctpDomain: 6,
    tokenMessengerV2: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
    irisApi: "https://iris-api.circle.com",
  },
  // Testnet counterpart, used for a real dress rehearsal of the bridge.
  "base-sepolia": {
    name: "Base Sepolia",
    chainId: 84532,
    rpc: process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
    explorer: "https://sepolia.basescan.org",
    currency: "ETH",
    realMoney: false,
    usdcErc20: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    cctpDomain: 6,
    tokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
    messageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
    irisApi: "https://iris-api-sandbox.circle.com",
  },
};

/** CCTP V2 forwards the destination mint to Circle, so no Arc gas is needed upfront. */
export const CCTP_FORWARD_HOOK =
  "0x636374702d666f72776172640000000000000000000000000000000000000000"; // "cctp-forward"

export const IRIS_API = "https://iris-api.circle.com";

export const MAINNET_WALLET_FILE = path.join(ROOT, ".secrets", "mainnet-wallet.json");

/** The wallet that signs for a network: testnet key, or the dedicated mainnet key. */
export function walletRecord(net = network()) {
  if (net.realMoney) {
    if (!fs.existsSync(MAINNET_WALLET_FILE)) {
      throw new Error(
        "No Arc mainnet operator wallet. Run: node scripts/mainnet-wallet.mjs"
      );
    }
    return JSON.parse(fs.readFileSync(MAINNET_WALLET_FILE, "utf8"));
  }
  const record = loadWalletRecord();
  if (!record) throw new Error("No wallet. Run: node scripts/wallet.mjs");
  return record;
}

export function network(key = process.env.ARC_NETWORK ?? "arc-testnet") {
  const n = NETWORKS[key];
  if (!n) throw new Error(`Unknown network "${key}". Use: ${Object.keys(NETWORKS).join(", ")}`);
  return n;
}

export function provider(net = network()) {
  return new JsonRpcProvider(net.rpc, net.chainId, { staticNetwork: true });
}

export function signer(net = network()) {
  const record = walletRecord(net);
  return new Wallet(record.privateKey, provider(net));
}

/** Guard for scripts that spend real money. Requires an explicit opt-in flag. */
export function assertRealMoneyAllowed(net = network()) {
  if (!net.realMoney) return;
  if (process.env.ARC_CONFIRM_MAINNET === "yes" || process.argv.includes("--yes")) return;
  throw new Error(
    `${net.name} spends REAL USDC. Re-run with --yes (or ARC_CONFIRM_MAINNET=yes) to confirm.`
  );
}

/**
 * Arc fee policy (docs.arc.io/arc/references/gas-and-fees):
 *   - minimum base fee on testnet is 20 Gwei, hard protocol floor
 *   - maxFeePerGas below 20 Gwei can hang forever or fail
 *   - a small tip (1 Gwei) improves inclusion; 0 is accepted
 */
export async function feeOverrides(prov) {
  const FLOOR = parseUnits("20", "gwei");
  const TIP = parseUnits("1", "gwei");

  let suggested = FLOOR;
  try {
    const raw = await prov.send("eth_gasPrice", []);
    const parsed = BigInt(raw);
    suggested = parsed > FLOOR ? parsed : FLOOR;
  } catch {
    /* keep floor */
  }

  return {
    maxFeePerGas: suggested * 2n, // headroom over the EWMA base fee
    maxPriorityFeePerGas: TIP,
    type: 2,
  };
}

export function deploymentsDir() {
  const dir = path.join(ROOT, "deployments");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function deploymentFile(net = network()) {
  return path.join(deploymentsDir(), `${net.chainId}.json`);
}

export function readDeployment(net = network()) {
  const f = deploymentFile(net);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
}

export function writeDeployment(data, net = network()) {
  const f = deploymentFile(net);
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
  return f;
}

export const EXPLORER_TX = (net, hash) => `${net.explorer}/tx/${hash}`;
export const EXPLORER_ADDR = (net, addr) => `${net.explorer}/address/${addr}`;
