// Watch the Arc mainnet operator wallet for incoming USDC.
//
//   node scripts/watch-funding.mjs             one check
//   node scripts/watch-funding.mjs --wait      poll until funded, then run deploy
//   node scripts/watch-funding.mjs --wait --deploy
//
// Exists so the mainnet launch can start the instant funding lands, without a
// human having to re-run anything.

import { JsonRpcProvider, formatEther, formatUnits, parseUnits } from "ethers";
import { network } from "./lib/arc.mjs";
import { ensureMainnetWallet } from "./mainnet-wallet.mjs";

const MAINNET = { rpc: "https://rpc.mainnet.arc.io", chainId: 5042 };
const DEPLOY_WORST_CASE = 2_198_280n * parseUnits("40", "gwei"); // measured ceiling

async function balance(prov, address) {
  return prov.getBalance(address);
}

async function main() {
  const rec = ensureMainnetWallet();
  const wait = process.argv.includes("--wait");
  const deploy = process.argv.includes("--deploy");
  const prov = new JsonRpcProvider(MAINNET.rpc, MAINNET.chainId, { staticNetwork: true });

  console.log(`watching : ${rec.address}`);
  console.log(`network  : Arc Mainnet (${MAINNET.chainId})`);
  console.log(`needs    : ~${formatEther(DEPLOY_WORST_CASE)} USDC to deploy (worst case)\n`);

  const deadline = Date.now() + 60 * 60 * 1000; // 1 hour cap

  for (;;) {
    const bal = await balance(prov, rec.address);
    const enough = bal >= DEPLOY_WORST_CASE;
    const stamp = new Date().toISOString().slice(11, 19);
    console.log(`[${stamp}] balance: ${formatEther(bal)} USDC ${enough ? "— FUNDED ✅" : ""}`);

    if (enough) {
      if (deploy) {
        console.log("\nlaunching mainnet deployment…\n");
        process.env.ARC_NETWORK = "arc-mainnet";
        const { spawnSync } = await import("node:child_process");
        const r = spawnSync(process.execPath, ["scripts/deploy.mjs", "--yes"], {
          stdio: "inherit",
          env: { ...process.env, ARC_NETWORK: "arc-mainnet" },
        });
        process.exitCode = r.status ?? 1;
        return;
      }
      console.log("\nfunded — run: ARC_NETWORK=arc-mainnet node scripts/deploy.mjs --yes");
      return;
    }

    if (!wait) return;
    if (Date.now() > deadline) {
      console.log("\nstopped watching after 1 hour; re-run to continue");
      return;
    }
    await new Promise((r) => setTimeout(r, 30000));
  }
}

main().catch((e) => {
  console.error("WATCH FAILED:", e.message);
  process.exitCode = 1;
});
