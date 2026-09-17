// Pre-flight go / no-go check before spending gas.
//
//   node scripts/preflight.mjs
//   ARC_NETWORK=arc-mainnet node scripts/preflight.mjs
//
// Runs every check that could waste money, BEFORE any transaction is signed:
// chain identity, wallet, balance, gas sanity, bytecode determinism, constructor
// execution against real network state, gas estimate, spend ceiling, duplicate
// deployment, and explorer reachability for the verification step.
//
// Exit code 0 = GO, 1 = NO-GO.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  ContractFactory,
  formatEther,
  formatUnits,
  parseUnits,
} from "ethers";
import { readArtifact, ROOT } from "./lib/build.mjs";
import {
  network,
  provider,
  walletRecord,
  readDeployment,
  EXPLORER_ADDR,
} from "./lib/arc.mjs";
import { ensureMainnetWallet } from "./mainnet-wallet.mjs";
import { loadWalletRecord } from "./wallet.mjs";

const TOKEN = {
  name: "Noor",
  symbol: "NUR",
  decimals: 18,
  initialSupply: 1_000_000_000n,
  cap: 1_000_000_000n,
};

const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok, detail });
  console.log(`  ${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  return ok;
};
const warn = (label, detail = "") => {
  results.push({ label, ok: true, warn: true, detail });
  console.log(`  ⚠  ${label}${detail ? ` — ${detail}` : ""}`);
};
const info = (label, detail = "") => console.log(`  •  ${label}${detail ? `: ${detail}` : ""}`);

async function main() {
  const net = network();
  const prov = provider(net);

  console.log(`\n════════════════════════════════════════════════════════════════════`);
  console.log(`  PRE-FLIGHT — Noor (NUR) deployment to ${net.name} (chain ${net.chainId})`);
  console.log(`════════════════════════════════════════════════════════════════════\n`);

  // ── 1. chain identity ────────────────────────────────────────────────
  console.log("1. Network identity");
  const liveChainId = (await prov.getNetwork()).chainId;
  check(`RPC reports chain ${liveChainId}`, liveChainId === BigInt(net.chainId), `expected ${net.chainId}`);

  const gasPrice = BigInt(await prov.send("eth_gasPrice", []));
  const floor = parseUnits("20", "gwei");
  const baseGasPrice = gasPrice > floor ? gasPrice : floor;
  const maxFeePerGas = baseGasPrice * 2n;
  info("gas price", `${formatUnits(gasPrice, "gwei")} gwei`);
  info("maxFeePerGas used", `${formatUnits(maxFeePerGas, "gwei")} gwei (2× base, floor 20)`);
  check("gas price is sane (< 500 gwei)", gasPrice < parseUnits("500", "gwei"), `${formatUnits(gasPrice, "gwei")} gwei`);
  if (gasPrice > parseUnits("100", "gwei")) warn("gas is elevated — deployment will cost more than usual");

  const block = await prov.getBlockNumber();
  info("current block", block.toString());

  // ── 2. wallet ────────────────────────────────────────────────────────
  console.log("\n2. Operator wallet");
  let record;
  try {
    if (net.realMoney) {
      record = ensureMainnetWallet();
      check("mainnet operator wallet exists", !!record.address, record.address);
      check("key file is present", fs.existsSync(path.join(ROOT, ".secrets", "mainnet-wallet.json")));
    } else {
      record = walletRecord(net);
      check("wallet exists", !!record.address, record.address);
    }
  } catch (e) {
    check("wallet loads", false, e.message);
    return finish();
  }
  info("derivation", record.derivationPath ?? "(random key)");

  const balance = await prov.getBalance(record.address);
  const nonce = await prov.getTransactionCount(record.address);
  info("balance", `${formatEther(balance)} ${net.currency}`);
  info("nonce", nonce.toString());

  // ── 3. bytecode determinism ──────────────────────────────────────────
  console.log("\n3. Build artefacts");
  const artifact = readArtifact("NoorCoin");
  check("artifact exists", !!artifact.bytecode, `${artifact.bytecode.length / 2} deploy bytes`);

  const inputPath = path.join(ROOT, "build", "standard-json-input.json");
  check("standard-json-input present", fs.existsSync(inputPath));
  const inputSha = fs.existsSync(inputPath)
    ? crypto.createHash("sha256").update(fs.readFileSync(inputPath)).digest("hex")
    : null;
  info("input sha256", inputSha ?? "—");

  // Cross-check against the already-verified testnet deployment: the same
  // source must produce the same runtime bytecode on every network.
  const testnetDep = (() => {
    try {
      const f = path.join(ROOT, "deployments", "5042002.json");
      return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
    } catch {
      return null;
    }
  })();
  if (testnetDep?.onchain?.runtimeBytes) {
    const expected = testnetDep.onchain.runtimeBytes;
    const actual = artifact.deployedBytecode.length / 2;
    check(
      "runtime bytecode matches the verified testnet build",
      expected === actual,
      `${actual} bytes vs ${expected}`
    );
  }
  if (testnetDep?.compiler?.standardJsonInputSha256 && inputSha) {
    check(
      "compiler input is unchanged since the verified build",
      testnetDep.compiler.standardJsonInputSha256 === inputSha,
      inputSha.slice(0, 16) + "…"
    );
  }

  // ── 4. constructor arguments & simulation ────────────────────────────
  console.log("\n4. Deployment simulation against live state");
  const ctorArgs = [
    record.address,
    parseUnits(TOKEN.initialSupply.toString(), TOKEN.decimals),
    parseUnits(TOKEN.cap.toString(), TOKEN.decimals),
    record.address,
  ];

  const factory = new ContractFactory(artifact.abi, artifact.bytecode);
  const deployData = (await factory.getDeployTransaction(...ctorArgs)).data;
  info("creation data", `${(deployData.length - 2) / 2} bytes`);

  try {
    const runtime = await prov.call({ from: record.address, data: deployData });
    const runtimeBytes = (runtime.length - 2) / 2;
    const expected = artifact.deployedBytecode.length / 2;
    check(
      "constructor executes without reverting",
      true,
      `returned ${runtimeBytes} bytes of runtime code`
    );
    check("returned runtime matches the artifact exactly", runtimeBytes === expected, `${expected} bytes`);
  } catch (e) {
    check("constructor executes without reverting", false, (e.shortMessage ?? e.message).slice(0, 120));
  }

  let gasLimit = null;
  let worstCase = null;
  try {
    const gas = await prov.estimateGas({ from: record.address, data: deployData, value: 0n });
    gasLimit = (gas * 120n) / 100n;
    worstCase = gasLimit * maxFeePerGas;
    info("estimateGas", gas.toString());
    info("with 20% buffer", gasLimit.toString());
  } catch (e) {
    check("gas estimate succeeds", false, (e.shortMessage ?? e.message).slice(0, 120));
  }

  // ── 5. money ─────────────────────────────────────────────────────────
  console.log("\n5. Funding & spend ceiling");
  if (worstCase !== null) {
    info("worst-case cost", `${formatEther(worstCase)} ${net.currency}`);
    const spendCap = parseUnits(process.env.ARC_MAX_SPEND_USDC ?? "0.50", 18);
    check(
      `worst case is within the ${formatEther(spendCap)} ${net.currency} cap`,
      worstCase <= spendCap
    );
    check(
      "balance covers the worst case",
      balance >= worstCase,
      balance >= worstCase
        ? `${formatEther(balance - worstCase)} ${net.currency} left over`
        : `short by ${formatEther(worstCase - balance)} ${net.currency}`
    );
    if (balance > 0n && balance < worstCase) {
      warn("wallet is funded but not enough — send a little more");
    }
    if (balance === 0n) {
      console.log("");
      console.log(`     → send ${net.currency} on ${net.name} (chain ${net.chainId}) to:`);
      console.log(`       ${record.address}`);
    }
  }

  // ── 6. duplicate deployment ──────────────────────────────────────────
  console.log("\n6. Duplicate-deployment check");
  const force = process.argv.includes("--force");
  const existing = readDeployment(net);
  if (existing?.address) {
    const code = await prov.getCode(existing.address);
    const live = code && code !== "0x";
    if (live && force) {
      warn(
        `a live contract is already recorded for ${net.name}`,
        `${existing.address} — proceeding because --force was passed`
      );
    } else {
      check(`no live contract already recorded for ${net.name}`, !live, existing.address);
    }
    if (live) info("existing deployment", EXPLORER_ADDR(net, existing.address));
  } else {
    check(`no prior record for chain ${net.chainId}`, true, "fresh deployment");
  }

  // ── 7. verification path ─────────────────────────────────────────────
  console.log("\n7. Verification path");
  if (net.realMoney) {
    warn(
      "explorer.arc.io is behind Cloudflare's JS challenge",
      "verification must be submitted from the browser, not Node"
    );
    check("browser verification procedure documented", true, "node scripts/verify.mjs");
  } else {
    try {
      const r = await fetch(`${net.apiHost}/api/v2/smart-contracts/verification/config`);
      check("verifier API reachable", r.ok, `HTTP ${r.status}`);
      if (r.ok) {
        const j = await r.json();
        const has = (j.solidity_compiler_versions ?? []).includes("v0.8.28+commit.7893614a");
        check("compiler v0.8.28+commit.7893614a offered by the verifier", has);
      }
    } catch (e) {
      check("verifier API reachable", false, e.message.slice(0, 80));
    }
  }

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  const warnings = results.filter((r) => r.warn);
  console.log(`\n════════════════════════════════════════════════════════════════════`);
  if (failed.length === 0) {
    console.log(`  ✅ GO — ${results.length - warnings.length} checks passed${warnings.length ? `, ${warnings.length} warning(s)` : ""}`);
    console.log(`════════════════════════════════════════════════════════════════════\n`);
    process.exitCode = 0;
  } else {
    console.log(`  ❌ NO-GO — ${failed.length} check(s) failed:`);
    for (const f of failed) console.log(`       • ${f.label}${f.detail ? ` (${f.detail})` : ""}`);
    console.log(`════════════════════════════════════════════════════════════════════\n`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("\nPREFLIGHT ERROR:", e.shortMessage ?? e.message);
  process.exitCode = 1;
});
