// Self-contained Solidity build helper: resolves the full import graph, produces
// a standard-JSON-input that is byte-for-byte what we also submit for explorer
// verification, and compiles it with solc-js (the same compiler as native solc).

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const solc = require("solc");

export const ROOT = path.resolve(new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
export const CONTRACTS_DIR = path.join(ROOT, "contracts");
export const NODE_MODULES = path.join(ROOT, "node_modules");
export const BUILD_DIR = path.join(ROOT, "build");

const IMPORT_RE = /^\s*import\s+(?:[^"';]*?\sfrom\s+)?"([^"]+)"\s*;/gm;

function toPosix(p) {
  return p.split(path.sep).join("/");
}

/** Resolve an import string to {unitName, absolutePath} or null if unresolvable. */
function resolveImport(importPath, importerUnitName) {
  if (importPath.startsWith(".")) {
    const base = path.posix.dirname(importerUnitName);
    const unitName = path.posix.normalize(path.posix.join(base, importPath));
    const abs = unitName.startsWith("@")
      ? path.join(NODE_MODULES, unitName)
      : path.join(ROOT, unitName);
    return fs.existsSync(abs) ? { unitName, absolutePath: abs } : null;
  }

  // Bare specifier -> node_modules
  const abs = path.join(NODE_MODULES, importPath);
  return fs.existsSync(abs) ? { unitName: importPath, absolutePath: abs } : null;
}

/** Walk the import graph starting from one or more entry .sol files. */
export function collectSources(entryUnitNames) {
  const sources = {};
  const queue = [...entryUnitNames];

  while (queue.length) {
    const unitName = queue.pop();
    if (sources[unitName]) continue;

    const abs = unitName.startsWith("@")
      ? path.join(NODE_MODULES, unitName)
      : path.join(ROOT, unitName);

    const content = fs.readFileSync(abs, "utf8");
    sources[unitName] = { content };

    for (const match of content.matchAll(IMPORT_RE)) {
      const resolved = resolveImport(match[1], unitName);
      if (!resolved) {
        throw new Error(`Cannot resolve import "${match[1]}" from ${unitName}`);
      }
      if (!sources[resolved.unitName]) queue.push(resolved.unitName);
    }
  }

  return sources;
}

/**
 * Build + compile.
 * @param {string[]} entryFiles  paths relative to contracts/, e.g. ["NoorCoin.sol"]
 * @param {object}   settings    solc optimizer/evmVersion overrides
 */
export function build(entryFiles, settings = {}) {
  const entryUnitNames = entryFiles.map((f) => `contracts/${toPosix(f)}`);
  const sources = collectSources(entryUnitNames);

  const optimizer = {
    enabled: settings.optimizerEnabled ?? true,
    runs: settings.optimizerRuns ?? 200,
  };
  const evmVersion = settings.evmVersion ?? "cancun";

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer,
      evmVersion,
      metadata: { bytecodeHash: settings.bytecodeHash ?? "ipfs" },
      outputSelection: {
        "*": {
          "*": [
            "abi",
            "evm.bytecode.object",
            "evm.bytecode.linkReferences",
            "evm.deployedBytecode.object",
            "metadata",
          ],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: () => ({ error: "not found" }) }));

  const errors = (output.errors ?? []).filter((e) => e.severity === "error");
  if (errors.length) {
    throw new Error("Solc errors:\n" + errors.map((e) => e.formattedMessage).join("\n"));
  }

  const warnings = (output.errors ?? []).filter((e) => e.severity !== "error");

  return { input, output, warnings, optimizer, evmVersion, solcVersion: solc.version() };
}

export function writeArtifact(name, { abi, bytecode, deployedBytecode, metadata }) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  const file = path.join(BUILD_DIR, `${name}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({ contractName: name, abi, bytecode, deployedBytecode, metadata }, null, 2)
  );
  return file;
}

export function readArtifact(name) {
  return JSON.parse(fs.readFileSync(path.join(BUILD_DIR, `${name}.json`), "utf8"));
}

/**
 * True when this module is the process entry point.
 *
 * The naive `import.meta.url === `file:///${process.argv[1]}`` form throws when
 * argv[1] is undefined (e.g. `node -e`, `node --eval`, some test runners) and
 * mis-compares Windows paths. This version is safe in every context.
 */
export function isMainModule(importMetaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return importMetaUrl === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

/** Encode constructor arguments exactly as they appear at the tail of deploy bytecode. */
export function encodeConstructorArgs(abi, args) {
  const ctor = abi.find((e) => e.type === "constructor");
  const types = (ctor?.inputs ?? []).map((i) => i.type);
  const { AbiCoder } = require("ethers");
  return AbiCoder.defaultAbiCoder().encode(types, args).slice(2);
}
