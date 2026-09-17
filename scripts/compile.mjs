// Compile every contract in contracts/ and emit build artifacts.
import fs from "node:fs";
import path from "node:path";
import { build, writeArtifact, CONTRACTS_DIR, BUILD_DIR, ROOT } from "./lib/build.mjs";

const entries = fs
  .readdirSync(CONTRACTS_DIR)
  .filter((f) => f.endsWith(".sol"))
  .sort();

if (entries.length === 0) {
  console.error("No .sol files found in", CONTRACTS_DIR);
  process.exitCode = 1;
}

console.log(`solc ${require_solc_version()} | entries: ${entries.join(", ")}`);

function require_solc_version() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules/solc/package.json"), "utf8"));
  return pkg.version;
}

const { input, output, warnings, optimizer, evmVersion, solcVersion } = build(entries);

for (const w of warnings) {
  console.log(`  warn: ${w.formattedMessage.split("\n")[0]}`);
}

// Persist the exact standard-JSON input so verification uses identical settings.
fs.mkdirSync(BUILD_DIR, { recursive: true });
const inputFile = path.join(BUILD_DIR, "standard-json-input.json");
fs.writeFileSync(inputFile, JSON.stringify(input));

const summary = [];
for (const [unitName, contracts] of Object.entries(output.contracts ?? {})) {
  for (const [contractName, artifact] of Object.entries(contracts)) {
    const bytecode = artifact.evm.bytecode.object;
    if (!bytecode) continue; // interface / abstract
    writeArtifact(contractName, {
      abi: artifact.abi,
      bytecode,
      deployedBytecode: artifact.evm.deployedBytecode.object,
      metadata: artifact.metadata,
    });
    summary.push({
      contractName,
      unitName,
      bytecodeBytes: bytecode.length / 2,
      deployedBytes: artifact.evm.deployedBytecode.object.length / 2,
      abiEntries: artifact.abi.length,
    });
  }
}

console.log(`\ncompiler:   ${solcVersion}`);
console.log(`evmVersion: ${evmVersion}`);
console.log(`optimizer:  enabled=${optimizer.enabled} runs=${optimizer.runs}`);
console.log(`sources:    ${Object.keys(input.sources).length}`);
console.log(`standard-json-input: ${path.relative(ROOT, inputFile)}`);
console.log("\nartifacts:");
for (const s of summary) {
  console.log(
    `  ${s.contractName.padEnd(20)} deploy=${String(s.bytecodeBytes).padStart(5)}B  runtime=${String(
      s.deployedBytes
    ).padStart(5)}B  abi=${s.abiEntries}  (${s.unitName})`
  );
}
