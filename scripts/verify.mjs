// Publish the NoorCoin source on the Arc explorer (Blockscout v2).
//
//   node scripts/verify.mjs
//   node scripts/verify.mjs --method multi-part
//
// Discovered API contract (Blockscout v11.3.0 / API v2.11.4 on Arc):
//
//   POST {apiHost}/api/v2/smart-contracts/{address}/verification/via/standard-input
//   Content-Type: multipart/form-data
//     compiler_version           e.g. v0.8.28+commit.7893614a
//     license_type               mit | none | apache_2_0 | ...
//     autodetect_constructor_args  "true"
//     constructor_arguments      "0x..." or "" (empty with autodetect)
//     files                      the standard-JSON-input file, as an upload
//
// Two traps worth recording:
//   * the field carrying the JSON is a FILE part named `files`; sending the JSON
//     as a plain string field (`contract_source_code`/`source_code`) is rejected
//     with a bare 400 "Bad request".
//   * testnet.arcscan.app is a CDN alias. Posting there returns 404 for the v2
//     verification route, and the legacy query-string endpoint returns
//     Cloudflare 414 because the standard JSON input is ~150 KB.

import fs from "node:fs";
import path from "node:path";
import { readDeployment, writeDeployment, network, EXPLORER_ADDR } from "./lib/arc.mjs";
import { ROOT } from "./lib/build.mjs";

const LICENSE_FOR_SPDX = { MIT: "mit", "Apache-2.0": "apache_2_0", "GPL-3.0": "gnu_gpl_v3", UNLICENSED: "none" };

/**
 * explorer.arc.io sits behind Cloudflare's JS challenge, which rejects plain
 * Node requests with HTTP 403 "Just a moment..." regardless of User-Agent.
 * There is no headless path to the mainnet verification API. When that happens
 * we print the exact browser procedure instead of failing silently.
 */
function cloudflareBlocked(text) {
  return /Just a moment|cf-chl|Attention Required/i.test(text);
}

function printBrowserProcedure(net, dep) {
  console.log(
    [
      "",
      "─".repeat(72),
      `${net.name} verification must be submitted through the browser.`,
      "─".repeat(72),
      "",
      "1. Open this URL in Chrome (BrowserForce tab):",
      `   ${net.explorer}/contract-verification?address=${dep.address}`,
      "",
      "2. Fill the form:",
      `   • Contract address : ${dep.address}`,
      "   • Verification method : Solidity (Standard JSON input)",
      `   • Compiler : ${dep.compiler.version}`,
      `   • File : arc-token/${dep.compiler.standardJsonInput}`,
      "",
      "3. Click “Verify & publish”, then confirm with:",
      "   node scripts/verify.mjs --check",
      "",
    ].join("\n")
  );
}

async function getStatus(net, address) {
  const r = await fetch(`${net.apiHost}/api/v2/smart-contracts/${address}`);
  return r.ok ? r.json() : null;
}

function detectLicense(source) {
  const m = source.match(/SPDX-License-Identifier:\s*([^\s*]+)/);
  return LICENSE_FOR_SPDX[m?.[1]] ?? "none";
}

async function main() {
  const net = network();
  const dep = readDeployment(net);
  if (!dep?.address) throw new Error("No deployment record. Run: node scripts/deploy.mjs");

  // --check: read verification state through the public API only.
  if (process.argv.includes("--check")) {
    const s = await getStatus(net, dep.address);
    if (!s) {
      console.log("could not read explorer API (403/challenge). Verify in the browser and check the page.");
      return;
    }
    console.log(`${dep.address} on ${net.name}`);
    console.log(`  verified : ${s.is_verified}`);
    if (s.is_verified) {
      console.log(`  name     : ${s.name}`);
      console.log(`  compiler : ${s.compiler_version} | evm ${s.evm_version}`);
      console.log(`  verified : ${s.verified_at}`);
      dep.verified = true;
      dep.verifiedAt = s.verified_at;
      writeDeployment(dep, net);
    }
    return;
  }

  const current = await getStatus(net, dep.address);
  if (current?.is_verified) {
    dep.verified = true;
    dep.verifiedAt = dep.verifiedAt ?? current.verified_at;
    writeDeployment(dep, net);
    console.log(`✅ already verified: ${EXPLORER_ADDR(net, dep.address)}#code`);
    console.log(`   ${current.name} | ${current.compiler_version} | evm ${current.evm_version}`);
    return;
  }

  const inputPath = path.join(ROOT, dep.compiler.standardJsonInput);
  const sourceCode = fs.readFileSync(inputPath, "utf8");
  const soliditySource = fs.readFileSync(path.join(ROOT, "contracts/NoorCoin.sol"), "utf8");

  const form = new FormData();
  form.append("compiler_version", dep.compiler.version);
  form.append("license_type", detectLicense(soliditySource));
  form.append("autodetect_constructor_args", "true");
  form.append("constructor_arguments", "");
  form.append("files", new Blob([sourceCode], { type: "application/json" }), "standard-json-input.json");

  const url = `${net.apiHost}/api/v2/smart-contracts/${dep.address}/verification/via/standard-input`;
  console.log(`verifying ${dep.address}`);
  console.log(`endpoint  ${url}`);
  console.log(`compiler  ${dep.compiler.version}  optimizer=${dep.compiler.optimizer.runs}  evm=${dep.compiler.evmVersion}`);
  console.log(`input     ${path.relative(ROOT, inputPath)} (${sourceCode.length} bytes, ${Object.keys(JSON.parse(sourceCode).sources).length} sources)\n`);

  const res = await fetch(url, { method: "POST", body: form });
  const text = await res.text();
  console.log(`submit -> HTTP ${res.status} ${text.slice(0, 300)}`);

  if (cloudflareBlocked(text)) {
    printBrowserProcedure(net, dep);
    return;
  }

  if (!res.ok && !/already/i.test(text)) {
    throw new Error(`Submission rejected (HTTP ${res.status}): ${text.slice(0, 400)}`);
  }

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const s = await getStatus(net, dep.address);
    if (s?.is_verified) {
      dep.verified = true;
      dep.verifiedAt = s.verified_at;
      dep.verification = {
        method: "Blockscout v2 via/standard-input (multipart/form-data)",
        apiHost: net.apiHost,
        compiler: s.compiler_version,
        evmVersion: s.evm_version,
        optimizer: { enabled: s.optimization_enabled, runs: s.optimization_runs },
        filePath: s.file_path,
        contractName: s.name,
        license: s.license_type,
      };
      writeDeployment(dep, net);
      console.log(`\n✅ verified after ${(i + 1) * 5}s`);
      console.log(`   name      : ${s.name}`);
      console.log(`   file      : ${s.file_path}`);
      console.log(`   compiler  : ${s.compiler_version} | evm ${s.evm_version} | opt ${s.optimization_enabled} runs ${s.optimization_runs}`);
      console.log(`   verified  : ${s.verified_at}`);
      console.log(`   ${EXPLORER_ADDR(net, dep.address)}#code`);
      return;
    }
    if (s?.verification_error) console.log(`   [${i + 1}] error: ${String(s.verification_error).slice(0, 200)}`);
    else process.stdout.write(`   [${i + 1}] pending…\r`);
  }

  throw new Error("timed out waiting for verification; check the explorer");
}

main().catch((e) => {
  console.error("\nVERIFY FAILED:", e.message);
  process.exitCode = 1;
});
