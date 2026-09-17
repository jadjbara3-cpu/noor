// Claim Arc testnet USDC from Circle's faucet.
//
//   node scripts/faucet.mjs                        # uses address from .secrets/wallet.json
//   node scripts/faucet.mjs 0xYourAddress
//   CIRCLE_API_KEY=TEST_API_KEY:xxx:xxx node scripts/faucet.mjs
//
// Circle's public /v1/faucet/drips endpoint is authenticated with a Test API key
// from https://console.circle.com — create a free developer account, then
// Account → API keys → Create key (Test). The key is stored in .secrets/ so it
// is reused on later runs.

import fs from "node:fs";
import path from "node:path";
import { SECRETS_DIR, loadWalletRecord } from "./wallet.mjs";
import { network, provider } from "./lib/arc.mjs";
import { formatEther } from "ethers";

const KEY_FILE = path.join(SECRETS_DIR, "circle-api-key.txt");
const API = "https://api.circle.com/v1/faucet/drips";

function resolveKey() {
  if (process.env.CIRCLE_API_KEY) return process.env.CIRCLE_API_KEY.trim();
  if (fs.existsSync(KEY_FILE)) return fs.readFileSync(KEY_FILE, "utf8").trim();
  return null;
}

export function storeKey(key) {
  fs.mkdirSync(SECRETS_DIR, { recursive: true });
  fs.writeFileSync(KEY_FILE, key.trim() + "\n");
}

async function main() {
  const net = network();
  const record = loadWalletRecord();
  const address = process.argv[2]?.startsWith("0x") ? process.argv[2] : record?.address;
  if (!address) throw new Error("No address. Run: node scripts/wallet.mjs");

  const key = resolveKey();
  const payload = { address, blockchain: "ARC-TESTNET", native: true, usdc: true };

  console.log(`faucet      : ${net.faucet}`);
  console.log(`api         : ${API}`);
  console.log(`address     : ${address}`);
  console.log(`api key     : ${key ? key.slice(0, 18) + "…" : "(none)"}\n`);

  if (!key) {
    console.log(
      [
        "No Circle API key on file.",
        "",
        "Two ways to fund this address:",
        "",
        "  A) Browser (no key):",
        `     open ${net.faucet} → Network: ${net.name} → USDC → paste ${address}`,
        "     → tick the reCAPTCHA box → Send 20 USDC",
        "",
        "  B) API key (automatable):",
        "     create a free account at https://console.circle.com",
        "     Account → API keys → Create API key (TEST)",
        "     then: node scripts/faucet.mjs --key TEST_API_KEY:xxx:xxx",
        "",
      ].join("\n")
    );
    process.exitCode = 0;
  }

  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log(`HTTP ${res.status}`);
  console.log(text.slice(0, 1200));

  if (res.ok) {
    console.log("\nwaiting for the balance to land…");
    const prov = provider(net);
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const bal = await prov.getBalance(address);
      if (bal > 0n) {
        console.log(`✅ balance: ${formatEther(bal)} ${net.currency}`);
        return;
      }
    }
    console.log("no balance yet — check the explorer");
  }
}

const keyFlag = process.argv.indexOf("--key");
if (keyFlag !== -1 && process.argv[keyFlag + 1]) {
  storeKey(process.argv[keyFlag + 1]);
  console.log("stored Circle API key in .secrets/circle-api-key.txt\n");
}

main().catch((e) => {
  console.error("FAUCET FAILED:", e.message);
  process.exitCode = 1;
});
