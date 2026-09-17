// Perform the single swap that activates DexScreener indexing for the NUR/USDC pool.
//
//   node scripts/activate-dexscreener.mjs            # quote only, no transaction
//   node scripts/activate-dexscreener.mjs --yes      # execute one swap
//
// WHY THIS EXISTS
// ---------------
// DexScreener's own documentation states: "DexScreener automatically indexes
// every token that completes at least one swap on a supported decentralized
// exchange... Pool creation alone is not sufficient. The swap emits the event
// that triggers indexing."
//
// The pool at 0xa8dC7Eba…5910 has zero swaps, so no aggregator has a price
// history to index. This script performs exactly ONE small swap to emit that
// event.
//
// WHAT THIS IS NOT
// ----------------
// It is not a volume campaign, not repeat trading, and not an attempt to make
// the pool look active. One swap, recorded on chain, at a size small enough to
// be obviously an activation step rather than demand. Anyone reading the pool
// sees one trade and the exact amount.

import { Contract, formatUnits } from "ethers";
import {
  network,
  provider,
  signer,
  assertRealMoneyAllowed,
  feeOverrides,
  readDeployment,
} from "./lib/arc.mjs";

export const ARC_ROUTER02 = "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA";

const ROUTER_ABI = [
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

const PAIR_ABI = [
  "function getReserves() view returns (uint112, uint112, uint32)",
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
];

const SWAP_USDC = process.env.SWAP_USDC ?? "0.05";
const SLIPPAGE_BPS = 500n; // 5% — thin pool, but the swap is tiny

async function main() {
  const net = network();
  const dep = readDeployment(net);
  if (!dep?.pool?.pair) throw new Error("No pool recorded for this network");

  const prov = provider(net);
  const wallet = signer(net);

  const usdcAddr = net.usdcErc20;
  const nurAddr = dep.address;
  const pairAddr = dep.pool.pair;

  const usdc = new Contract(usdcAddr, ERC20_ABI, wallet);
  const router = new Contract(ARC_ROUTER02, ROUTER_ABI, wallet);
  const pair = new Contract(pairAddr, PAIR_ABI, prov);

  const usdcDec = 6;
  const nurDec = 18;
  const amountIn = BigInt(Math.round(Number(SWAP_USDC) * 10 ** usdcDec));

  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`  ACTIVATE DEXSCREENER INDEXING — one swap on the NUR/USDC pool`);
  console.log(`════════════════════════════════════════════════════════════════\n`);
  console.log(`  pool        : ${pairAddr}`);
  console.log(`  wallet      : ${wallet.address}`);
  console.log(`  native USDC : ${formatUnits(await prov.getBalance(wallet.address), 18)} USDC`);
  console.log(`  USDC bal    : ${formatUnits(await usdc.balanceOf(wallet.address), usdcDec)} USDC`);
  console.log(`  swapping    : ${SWAP_USDC} USDC -> NUR\n`);

  const before = await pair.getReserves();
  const path = [usdcAddr, nurAddr];
  const quoted = await router.getAmountsOut(amountIn, path);
  const out = quoted[1];
  const amountOutMin = out - (out * SLIPPAGE_BPS) / 10_000n;

  console.log(`  quote       : ${Number(out) / 10 ** nurDec} NUR`);
  console.log(`  min out     : ${Number(amountOutMin) / 10 ** nurDec} NUR (5% slippage)`);
  console.log(`  reserves before: ${before[0]} / ${before[1]}`);

  if (!process.argv.includes("--yes")) {
    console.log(`\n  DRY RUN — add --yes to send the one swap.\n`);
    return;
  }
  assertRealMoneyAllowed(net);

  const fees = await feeOverrides(prov);

  const allowance = await usdc.allowance(wallet.address, ARC_ROUTER02);
  if (allowance < amountIn) {
    console.log("\n  approving USDC…");
    const a = await usdc.approve(ARC_ROUTER02, amountIn, fees);
    console.log(`  ${a.hash}`);
    await a.wait(1);
  } else {
    console.log("\n  USDC allowance already sufficient");
  }

  console.log("  sending the swap…");
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 900);
  const tx = await router.swapExactTokensForTokens(amountIn, amountOutMin, path, wallet.address, deadline, fees);
  console.log(`  tx: ${tx.hash}`);
  console.log(`  ${net.explorer}/tx/${tx.hash}`);
  const rc = await tx.wait(1);
  console.log(`  confirmed in block ${rc.blockNumber} (gas ${rc.gasUsed})`);

  const after = await pair.getReserves();
  const swapEvents = rc.logs.filter((l) => {
    try { return pair.interface.parseLog(l)?.name === "Swap"; } catch { return false; }
  });
  const nurBal = await new Contract(nurAddr, ERC20_ABI, prov).balanceOf(wallet.address);

  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`  ✅ INDEXING EVENT EMITTED`);
  console.log(`     Swap events in this tx : ${swapEvents.length}`);
  console.log(`     reserves after         : ${after[0]} / ${after[1]}`);
  console.log(`     wallet NUR             : ${formatUnits(nurBal, nurDec)} NUR`);
  console.log(`\n     DexScreener indexes within ~5-30 minutes of a first swap.`);
  console.log(`     Check: https://api.dexscreener.com/latest/dex/pairs/arc/${pairAddr}`);
  console.log(`════════════════════════════════════════════════════════════════\n`);
}

main().catch((e) => {
  console.error("\nACTIVATION FAILED:", e.shortMessage ?? e.message);
  process.exitCode = 1;
});
