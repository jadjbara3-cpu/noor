// End-to-end autonomous launch: wait for funding on Base → bridge to Arc →
// pre-flight → deploy → verify. One command, no intervention.
//
//   node scripts/launch.mjs                 # report current state, do nothing
//   node scripts/launch.mjs --wait          # poll until Base is funded, then bridge + deploy
//   node scripts/launch.mjs --yes           # execute now with whatever is already there
//
// Real money is involved, so the first execution requires --yes (or --wait,
// which is how the operator authorises it in advance).

import { spawnSync } from "node:child_process";
import { Contract, JsonRpcProvider, formatUnits } from "ethers";
import { network, walletRecord } from "./lib/arc.mjs";

const ERC20 = ["function balanceOf(address) view returns (uint256)"];

const BASE = network("base");
const ARC = network("arc-mainnet");

// Measured deployment ceiling: 2,198,280 gas x 40 gwei = 0.0879312 USDC.
// Arc's gas is native USDC (18 decimals) but the ERC-20 interface — which is what
// balanceOf() returns — uses 6 decimals, so everything here is normalised to
// 6-decimal subunits. 0.0879312 USDC = 87,932 subunits; we require 0.1 USDC.
const DEPLOY_WORST_CASE = 100_000n; // 0.1 USDC in 6-decimal subunits
const DEPLOY_DECIMALS = 6;
const BRIDGE_MIN_USDC = 200_000n; // 0.2 USDC — below this bridging is pointless

function step(label) {
  console.log(`\n${"━".repeat(66)}\n  ${label}\n${"━".repeat(66)}`);
}

function run(script, args = []) {
  const r = spawnSync(process.execPath, [`scripts/${script}`, ...args], {
    stdio: "inherit",
    // Every child must target Arc mainnet, not the default testnet.
    env: { ...process.env, ARC_NETWORK: "arc-mainnet" },
  });
  return r.status ?? 1;
}

async function state() {
  const baseProv = new JsonRpcProvider(BASE.rpc, BASE.chainId, { staticNetwork: true });
  const arcProv = new JsonRpcProvider(ARC.rpc, ARC.chainId, { staticNetwork: true });
  const record = walletRecord(ARC);
  const baseUsdc = new Contract(BASE.usdcErc20, ERC20, baseProv);
  const arcUsdc = new Contract(ARC.usdcErc20, ERC20, arcProv);

  const [eth, busdc, ausdc] = await Promise.all([
    baseProv.getBalance(record.address),
    baseUsdc.balanceOf(record.address),
    arcUsdc.balanceOf(record.address),
  ]);
  return { address: record.address, eth, busdc, ausdc };
}

function report(s) {
  console.log(`  wallet        : ${s.address}`);
  console.log(`  Base  ETH     : ${formatUnits(s.eth, 18)}`);
  console.log(`  Base  USDC    : ${formatUnits(s.busdc, 6)}`);
  console.log(`  Arc   USDC    : ${formatUnits(s.ausdc, 6)}`);
  console.log(`  deploy needs  : ${formatUnits(DEPLOY_WORST_CASE, DEPLOY_DECIMALS)} USDC on Arc (worst case 0.088, 0.1 required)`);
}

async function main() {
  const wait = process.argv.includes("--wait");
  const yes = process.argv.includes("--yes") || wait;

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║   NOOR (NUR) — AUTONOMOUS LAUNCH ORCHESTRATOR                  ║");
  console.log("║   Base → (CCTP V2) → Arc Mainnet → deploy → verify             ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");

  step("STEP 1 — funding state");
  let s = await state();
  report(s);

  if (s.busdc < BRIDGE_MIN_USDC && wait) {
    console.log("\n  waiting for USDC on Base… (checking every 30s, up to 2 hours)");
    const deadline = Date.now() + 2 * 60 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 30000));
      s = await state();
      const stamp = new Date().toISOString().slice(11, 19);
      console.log(
        `  [${stamp}] Base: ${formatUnits(s.busdc, 6)} USDC / ${formatUnits(s.eth, 18)} ETH` +
          (s.ausdc > 0n ? `  |  Arc: ${formatUnits(s.ausdc, 6)} USDC` : "")
      );
      if (s.busdc >= BRIDGE_MIN_USDC) break;
    }
  }

  // ── bridge if the money is still on Base ────────────────────────────────
  if (s.busdc >= BRIDGE_MIN_USDC && s.ausdc < DEPLOY_WORST_CASE) {
    if (s.eth === 0n) {
      console.log(
        `\n  ❌ USDC arrived on Base but there is no ETH for Base gas.\n` +
          `     Send a small amount of ETH on Base to ${s.address} and re-run.`
      );
      process.exitCode = 1;
      return;
    }

    step("STEP 2 — bridging Base → Arc via CCTP V2");
    if (!yes) {
      console.log("  dry run only — re-run with --yes (or --wait) to bridge");
      run("bridge-to-arc.mjs");
      return;
    }
    const rc = run("bridge-to-arc.mjs", ["--yes"]);
    if (rc !== 0) {
      console.log("\n  ❌ bridge failed — stopping before spending anything on Arc");
      process.exitCode = rc;
      return;
    }
    s = await state();
    report(s);
  } else if (s.ausdc >= DEPLOY_WORST_CASE) {
    console.log("\n  Arc is already funded — skipping the bridge.");
  } else {
    console.log(
      `\n  Nothing to do yet. Send USDC (and a little ETH) on Base to:\n\n      ${s.address}\n`
    );
    return;
  }

  // ── deploy ──────────────────────────────────────────────────────────────
  if (s.ausdc < DEPLOY_WORST_CASE) {
    console.log(`\n  ⏳ Arc balance ${formatUnits(s.ausdc, DEPLOY_DECIMALS)} < ${formatUnits(DEPLOY_WORST_CASE, DEPLOY_DECIMALS)} USDC — not enough to deploy yet.`);
    return;
  }

  step("STEP 3 — pre-flight");
  const pf = run("preflight.mjs", ["--force"]);
  if (pf !== 0) {
    console.log("\n  ❌ pre-flight is NO-GO — not deploying");
    process.exitCode = pf;
    return;
  }

  step("STEP 4 — deploying NoorCoin to Arc Mainnet");
  const dep = run("deploy.mjs", ["--yes"]);
  if (dep !== 0) {
    console.log("\n  ❌ deployment failed");
    process.exitCode = dep;
    return;
  }

  step("STEP 5 — verifying the source on explorer.arc.io");
  // Cloudflare blocks Node here, so this prints the browser procedure.
  run("verify.mjs");

  step("STEP 6 — final report");
  run("report.mjs");

  console.log("\n✅ Launch sequence complete. See DEPLOYMENT-MAINNET.md\n");
}

main().catch((e) => {
  console.error("\nLAUNCH FAILED:", e.shortMessage ?? e.message);
  process.exitCode = 1;
});
