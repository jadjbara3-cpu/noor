// Count real trades on the NUR/USDC pool, by distinct human wallets.
//
//   node scripts/track-trades.mjs
//   node scripts/track-trades.mjs --detail
//
// A "real trade" is a swap on the pair whose *transaction sender* is a wallet we
// do not control. The pair's own Swap event names the Uniswap router as `sender`
// for anything routed through it, so the router tells us nothing about who
// traded — the transaction's `from` field is what matters.
//
// The activation swap is excluded: it was sent by the operator wallet, not a
// person, and it exists only to trigger DEX indexing.

import { JsonRpcProvider, Contract, formatUnits } from "ethers";

const RPC = "https://rpc.mainnet.arc.io";
const CHAIN_ID = 5042;
const PAIR = "0xa8dC7Eba119949500F8e18fD086a0bF151095910";
const USDC = "0x3600000000000000000000000000000000000000";
const NUR = "0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f";

// wallets belonging to the project — never counted as organic
const OWN = new Set([
  "0xb66be4c1c3677a82105da62e447eade1e243538f", // operator
  "0x91400da46cfca15c2e3b09df792bdfd0dd8d2af6", // testnet main
  "0x724b502c55d256d900bf0e43c7ccbe3035b19a0d",
  "0xfce6daff33ab028331506f37cc2d5c7a2854a9aa",
  "0x1068e2d46f9a0551f60efc226d41b8356fca0bb3",
  "0x3c58fd5cd6e191a839d6ba3a5059c7948025cb51", // trader
]);

const TARGET = 10;

const pairAbi = [
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function token0() view returns (address)",
];

const CHUNK = 9_000;

async function main() {
  const detail = process.argv.includes("--detail");
  const p = new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
  const pair = new Contract(PAIR, pairAbi, p);

  const latest = await p.getBlockNumber();
  const [t0, reserves] = await Promise.all([pair.token0(), pair.getReserves()]);
  const usdcIsT0 = t0.toLowerCase() === USDC.toLowerCase();
  const rUsdc = usdcIsT0 ? reserves[0] : reserves[1];
  const rNur = usdcIsT0 ? reserves[1] : reserves[0];

  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`  NOOR (NUR) — real-trade tracker`);
  console.log(`════════════════════════════════════════════════════════════════\n`);
  console.log(`  pool       : ${PAIR}`);
  console.log(`  reserves   : ${formatUnits(rUsdc, 6)} USDC  |  ${formatUnits(rNur, 18)} NUR`);
  console.log(`  latest     : block ${latest}`);

  // The pool was created at block 21366612; scan forward from a little before.
  const from = 21_366_000;
  const logs = [];
  for (let start = from; start <= latest; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, latest);
    try {
      const chunk = await pair.queryFilter("Swap", start, end);
      logs.push(...chunk);
    } catch (e) {
      console.error(`  ! chunk ${start}-${end} failed: ${e.shortMessage ?? e.message}`);
    }
  }

  // Resolve each swap's transaction to find who actually sent it.
  const txCache = new Map();
  const humans = new Map(); // address -> { trades, volumeUsdc }
  let projectSwaps = 0;

  for (const log of logs) {
    let tx = txCache.get(log.transactionHash);
    if (tx === undefined) {
      tx = await p.getTransaction(log.transactionHash).catch(() => null);
      txCache.set(log.transactionHash, tx);
    }
    const from_ = (tx?.from ?? "").toLowerCase();
    const isBuy = log.args[1] > 0n; // amount0In > 0 means USDC went in
    const usdcIn = usdcIsT0 ? log.args[1] : log.args[2];

    if (OWN.has(from_)) { projectSwaps++; continue; }

    const rec = humans.get(from_) ?? { trades: 0, volumeUsdc: 0n, buys: 0, sells: 0, first: log.blockNumber };
    rec.trades++;
    rec.volumeUsdc += usdcIn;
    isBuy ? rec.buys++ : rec.sells++;
    humans.set(from_, rec);
  }

  const unique = humans.size;
  const totalVolume = [...humans.values()].reduce((n, r) => n + r.volumeUsdc, 0n);

  console.log(`\n  swap events total      : ${logs.length}`);
  console.log(`  project-side swaps     : ${projectSwaps}  (excluded — operator/activation)`);
  console.log(`  trades by other people : ${logs.length - projectSwaps}`);
  console.log(`  distinct human wallets : ${unique}`);
  console.log(`  their volume           : ${formatUnits(totalVolume, 6)} USDC`);

  if (detail && unique) {
    console.log(`\n  ── wallets ──`);
    for (const [addr, r] of humans) {
      console.log(`  ${addr}  trades ${r.trades}  buys ${r.buys}  sells ${r.sells}  volume ${formatUnits(r.volumeUsdc, 6)} USDC  first block ${r.first}`);
    }
  }

  const pct = Math.min(100, (unique / TARGET) * 100);
  const bar = "█".repeat(Math.round(pct / 5)).padEnd(20, "·");
  console.log(`\n  GOAL  [${bar}]  ${unique} / ${TARGET}`);
  if (unique >= TARGET) console.log(`  ✅ target reached with real, distinct wallets`);
  else console.log(`  ${TARGET - unique} more distinct wallet(s) needed`);
  console.log("");
}

main().catch((e) => {
  console.error("TRACKER FAILED:", e.shortMessage ?? e.message);
  process.exitCode = 1;
});
