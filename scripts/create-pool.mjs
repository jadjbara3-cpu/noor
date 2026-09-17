// Create and seed a real NUR/USDC market on Uniswap v2 (Arc mainnet).
//
//   node scripts/create-pool.mjs            # quote + cost estimate (no tx)
//   node scripts/create-pool.mjs --yes      # approve + addLiquidity
//
// Uniswap v2 is the right tool here: one `addLiquidity` call creates the pair
// and sets the opening price, and the LP tokens are minted to the operator
// wallet — so the liquidity can be withdrawn again later, unlike a locked
// launchpad pool.
//
// Uniswap deploys v2 on Arc at the addresses verified below (source:
// developers.uniswap.org/deployments.json, tier "labs-supported").

import {
  Contract,
  JsonRpcProvider,
  Wallet,
  formatUnits,
  parseUnits,
} from "ethers";
import { readArtifact } from "./lib/build.mjs";
import {
  network,
  provider,
  walletRecord,
  assertRealMoneyAllowed,
  feeOverrides,
  readDeployment,
  EXPLORER_ADDR,
} from "./lib/arc.mjs";

export const UNISWAP_V2_ARC = {
  factory: "0x89e5DB8B5aA49aA85AC63f691524311AEB649eba",
  router02: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
};

const FACTORY_ABI = [
  "function getPair(address,address) view returns (address)",
  "function createPair(address,address) returns (address)",
  "function allPairsLength() view returns (uint256)",
];

const ROUTER_ABI = [
  "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity)",
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
  "function factory() view returns (address)",
];

const PAIR_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// ── opening price ────────────────────────────────────────────────────────
// 1 NUR = 0.000001 USDC  (1 USDC = 1,000,000 NUR).
// The pool holds real capital; the implied FDV is a derived number, not a
// promise. Keeping it low is deliberate: it is honest about the pool's size.
const PRICE_USDC_PER_NUR = 1e-6;

// USDC to commit, and how much native USDC to keep back for gas.
const LIQUIDITY_USDC = process.env.POOL_USDC ? Number(process.env.POOL_USDC) : 2.5;
const GAS_RESERVE_USDC = 0.2;

async function main() {
  const net = network();
  const dep = readDeployment(net);
  if (!dep?.address) throw new Error("No mainnet deployment");

  const prov = provider(net);
  const record = walletRecord(net);
  const wallet = new Wallet(record.privateKey, prov);
  const nurAddr = dep.address;
  const usdcAddr = net.usdcErc20;

  const nur = new Contract(nurAddr, ERC20_ABI, wallet);
  const usdc = new Contract(usdcAddr, ERC20_ABI, wallet);
  const factory = new Contract(UNISWAP_V2_ARC.factory, FACTORY_ABI, prov);
  const router = new Contract(UNISWAP_V2_ARC.router02, ROUTER_ABI, wallet);

  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`  CREATE NUR/USDC MARKET — Uniswap v2 on Arc Mainnet`);
  console.log(`════════════════════════════════════════════════════════════════\n`);

  // ── infrastructure sanity ────────────────────────────────────────────
  const [fCode, rCode] = await Promise.all([
    prov.getCode(UNISWAP_V2_ARC.factory),
    prov.getCode(UNISWAP_V2_ARC.router02),
  ]);
  if (fCode === "0x" || rCode === "0x") throw new Error("Uniswap v2 not present on Arc");
  console.log(`  v2 factory   : ${UNISWAP_V2_ARC.factory} (${(fCode.length - 2) / 2} bytes)`);
  console.log(`  v2 router02  : ${UNISWAP_V2_ARC.router02} (${(rCode.length - 2) / 2} bytes)`);
  const routerFactory = await router.factory();
  console.log(`  router.factory() = ${routerFactory}`);
  if (routerFactory.toLowerCase() !== UNISWAP_V2_ARC.factory.toLowerCase()) {
    throw new Error("Router does not point at the expected factory");
  }

  // ── existing pair? ───────────────────────────────────────────────────
  const existing = await factory.getPair(nurAddr, usdcAddr);
  const zero = "0x0000000000000000000000000000000000000000";
  if (existing !== zero) {
    const p = new Contract(existing, PAIR_ABI, prov);
    const [t0, r, ts] = await Promise.all([p.token0(), p.getReserves(), p.totalSupply()]);
    const nurIsT0 = t0.toLowerCase() === nurAddr.toLowerCase();
    const rNur = nurIsT0 ? r[0] : r[1];
    const rUsdc = nurIsT0 ? r[1] : r[0];
    console.log(`  pair         : ${existing}`);
    console.log(`  reserves     : ${formatUnits(rNur, 18)} NUR | ${formatUnits(rUsdc, 6)} USDC`);
    console.log(`  LP supply    : ${formatUnits(ts, 18)}`);
    console.log(`  explorer     : ${net.explorer}/address/${existing}`);
    if (!process.argv.includes("--force")) {
      console.log(`\n  ✅ the market already exists — nothing to do.`);
      console.log(`     add --force to add more liquidity to it.\n`);
      return;
    }
    console.log(`\n  ⚠  --force: adding more liquidity to the existing pair.`);
  } else {
    console.log(`  pair         : none yet — addLiquidity will create it`);
  }

  // ── amounts ──────────────────────────────────────────────────────────
  const nurDec = Number(await nur.decimals());
  const usdcDec = Number(await usdc.decimals());
  const nurBal = await nur.balanceOf(wallet.address);
  const nativeBal = await prov.getBalance(wallet.address);

  const usdcAmount = parseUnits(LIQUIDITY_USDC.toString(), usdcDec);
  // usdcAmount (6dp) / PRICE  -> NUR in whole units -> to 18dp
  const nurWhole = LIQUIDITY_USDC / PRICE_USDC_PER_NUR;
  const nurAmount = parseUnits(nurWhole.toString(), nurDec);

  console.log(`\n  wallet       : ${wallet.address}`);
  console.log(`  native USDC  : ${formatUnits(nativeBal, 18)} (gas + liquidity)`);
  console.log(`  NUR balance  : ${formatUnits(nurBal, nurDec)}`);
  console.log(`\n  plan:`);
  console.log(`    deposit    : ${LIQUIDITY_USDC} USDC + ${nurWhole.toLocaleString()} NUR`);
  console.log(`    open price : 1 NUR = ${PRICE_USDC_PER_NUR} USDC  (1 USDC = ${(1 / PRICE_USDC_PER_NUR).toLocaleString()} NUR)`);
  console.log(`    implied FDV: $${(PRICE_USDC_PER_NUR * 1e9).toLocaleString()} for the 1,000,000,000 supply`);

  if (nurBal < nurAmount) throw new Error(`Not enough NUR: have ${formatUnits(nurBal, nurDec)}`);
  const needed = usdcAmount + parseUnits(GAS_RESERVE_USDC.toString(), 6);
  if (nativeBal < needed * 10n ** 12n) {
    throw new Error(
      `Arc balance too low: have ${formatUnits(nativeBal, 18)} USDC, need liquidity ${LIQUIDITY_USDC} + gas reserve ${GAS_RESERVE_USDC}`
    );
  }

  if (!process.argv.includes("--yes")) {
    console.log(`\n  DRY RUN — add --yes to create the pool.\n`);
    return;
  }
  assertRealMoneyAllowed(net);

  const fees = await feeOverrides(prov);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
  const routerAddr = UNISWAP_V2_ARC.router02;

  // ── approvals ────────────────────────────────────────────────────────
  if ((await nur.allowance(wallet.address, routerAddr)) < nurAmount) {
    console.log("\n  [1/3] approving NUR…");
    const tx = await nur.approve(routerAddr, nurAmount, fees);
    console.log(`        ${tx.hash}`);
    await tx.wait(1);
  } else console.log("\n  [1/3] NUR allowance already sufficient");

  if ((await usdc.allowance(wallet.address, routerAddr)) < usdcAmount) {
    console.log("  [2/3] approving USDC…");
    const tx = await usdc.approve(routerAddr, usdcAmount, fees);
    console.log(`        ${tx.hash}`);
    await tx.wait(1);
  } else console.log("  [2/3] USDC allowance already sufficient");

  // ── add liquidity ────────────────────────────────────────────────────
  console.log("  [3/3] addLiquidity (creates the pair on first call)…");
  const tx = await router.addLiquidity(
    nurAddr,
    usdcAddr,
    nurAmount,
    usdcAmount,
    (nurAmount * 99n) / 100n,
    (usdcAmount * 99n) / 100n,
    wallet.address,
    deadline,
    fees
  );
  console.log(`        ${tx.hash}`);
  console.log(`        ${net.explorer}/tx/${tx.hash}`);
  const rc = await tx.wait(1);
  console.log(`        confirmed in block ${rc.blockNumber} (gas ${rc.gasUsed})`);

  // ── verify ───────────────────────────────────────────────────────────
  const pairAddr = await factory.getPair(nurAddr, usdcAddr);
  const pair = new Contract(pairAddr, PAIR_ABI, prov);
  const [t0, t1, reserves] = await Promise.all([pair.token0(), pair.token1(), pair.getReserves()]);
  const lp = await pair.balanceOf(wallet.address);

  const isNurToken0 = t0.toLowerCase() === nurAddr.toLowerCase();
  const reserveNur = isNurToken0 ? reserves[0] : reserves[1];
  const reserveUsdc = isNurToken0 ? reserves[1] : reserves[0];
  const spot = Number(reserveUsdc) / 10 ** usdcDec / (Number(reserveNur) / 10 ** nurDec);

  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`  ✅ MARKET CREATED`);
  console.log(`     pair        : ${pairAddr}`);
  console.log(`     token0/1    : ${t0} / ${t1}`);
  console.log(`     reserves    : ${formatUnits(reserveNur, nurDec)} NUR  |  ${formatUnits(reserveUsdc, usdcDec)} USDC`);
  console.log(`     spot price  : 1 NUR = ${spot} USDC`);
  console.log(`     LP tokens   : ${formatUnits(lp, 18)} (held by ${wallet.address})`);
  console.log(`     explorer    : ${net.explorer}/address/${pairAddr}`);
  console.log(`════════════════════════════════════════════════════════════════\n`);
}

main().catch((e) => {
  console.error("\nPOOL CREATION FAILED:", e.shortMessage ?? e.message);
  process.exitCode = 1;
});
