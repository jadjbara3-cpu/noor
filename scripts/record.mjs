// Rebuild a deployment record from an on-chain transaction hash.
//
//   node scripts/record.mjs 0x<deployTxHash>
//
// Useful when a deployment succeeded on-chain but the local record was lost.

import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import { Contract, keccak256 } from "ethers";
import { readArtifact, ROOT } from "./lib/build.mjs";
import { network, provider, walletRecord, writeDeployment, readDeployment, EXPLORER_ADDR } from "./lib/arc.mjs";

const TOKEN_CONTRACT = "contracts/NoorCoin.sol:NoorCoin";

async function main() {
  const txHash = process.argv[2];
  if (!txHash?.startsWith("0x")) throw new Error("usage: node scripts/record.mjs 0x<txHash>");

  const net = network();
  const prov = provider(net);
  const artifact = readArtifact("NoorCoin");

  const receipt = await prov.getTransactionReceipt(txHash);
  if (!receipt) throw new Error("transaction not found");
  if (receipt.status !== 1) throw new Error(`transaction reverted (status ${receipt.status})`);
  if (!receipt.contractAddress) throw new Error("transaction is not a contract creation");

  const tx = await prov.getTransaction(txHash);
  const address = receipt.contractAddress;
  const contract = new Contract(address, artifact.abi, prov);
  const code = await prov.getCode(address);
  const record = walletRecord(net);
  const inputFile = path.join(ROOT, "build/standard-json-input.json");

  const onchain = {
    name: await contract.name(),
    symbol: await contract.symbol(),
    decimals: Number(await contract.decimals()),
    totalSupply: (await contract.totalSupply()).toString(),
    cap: (await contract.cap()).toString(),
    owner: await contract.owner(),
    treasury: await contract.treasury(),
    feeBps: Number(await contract.feeBps()),
    limitsEnabled: await contract.limitsEnabled(),
    paused: await contract.paused(),
    runtimeBytes: (code.length - 2) / 2,
  };

  const previous = readDeployment(net);

  const deployment = {
    project: "Noor (NUR)",
    network: net.name,
    chainId: net.chainId,
    rpc: net.rpc,
    explorer: net.explorer,
    address,
    txHash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    effectiveGasPrice: receipt.gasPrice?.toString() ?? null,
    deployer: tx.from,
    derivationPath: record?.derivationPath ?? null,
    constructorArgsHex: tx.data.slice(-(4 * 64)),
    compiler: {
      version: "v0.8.28+commit.7893614a",
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
      contractName: TOKEN_CONTRACT,
      standardJsonInput: "build/standard-json-input.json",
      standardJsonInputSha256: crypto.createHash("sha256").update(fs.readFileSync(inputFile)).digest("hex"),
    },
    sourceHash: keccak256("0x" + fs.readFileSync(path.join(ROOT, "contracts/NoorCoin.sol")).toString("hex")),
    verified: previous?.address === address ? (previous.verified ?? false) : false,
    onchain,
    recoveredFromChain: true,
    deployedAt: new Date(receipt.blockNumber * 1000).toISOString(),
  };

  const file = writeDeployment(deployment, net);
  console.log(`address     : ${address}`);
  console.log(`name/symbol : ${onchain.name} (${onchain.symbol})`);
  console.log(`totalSupply : ${onchain.totalSupply}`);
  console.log(`owner       : ${onchain.owner}`);
  console.log(`record      : ${path.relative(ROOT, file)}`);
  console.log(`explorer    : ${EXPLORER_ADDR(net, address)}`);
}

main().catch((e) => {
  console.error("RECORD FAILED:", e.shortMessage ?? e.message);
  process.exitCode = 1;
});
