// Deploy NoorCoin to Arc.
//
//   node scripts/deploy.mjs                 # arc-testnet (default)
//   ARC_NETWORK=arc-mainnet node scripts/deploy.mjs
//
// Requires a funded wallet: node scripts/wallet.mjs --show

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  ContractFactory,
  formatEther,
  formatUnits,
  parseUnits,
  keccak256,
} from "ethers";
import { readArtifact, ROOT } from "./lib/build.mjs";
import {
  network,
  provider,
  signer,
  walletRecord,
  assertRealMoneyAllowed,
  feeOverrides,
  readDeployment,
  writeDeployment,
  EXPLORER_ADDR,
  EXPLORER_TX,
} from "./lib/arc.mjs";

export const TOKEN = {
  name: "Noor",
  symbol: "NUR",
  decimals: 18,
  initialSupply: 1_000_000_000n, // 1e9 NUR minted at genesis
  cap: 1_000_000_000n, // immutable ceiling — supply can never exceed 1e9
  contract: "contracts/NoorCoin.sol:NoorCoin",
};

async function main() {
  const net = network();
  assertRealMoneyAllowed(net);
  const prov = provider(net);
  const w = signer(net);
  const record = walletRecord(net);

  const chainId = (await prov.getNetwork()).chainId;
  if (chainId !== BigInt(net.chainId)) {
    throw new Error(`RPC chainId ${chainId} != expected ${net.chainId} for ${net.name}`);
  }

  const balance = await prov.getBalance(w.address);
  console.log(`network     : ${net.name} (chainId ${net.chainId})`);
  console.log(`deployer    : ${w.address}`);
  console.log(`balance     : ${formatEther(balance)} ${net.currency}`);

  if (balance === 0n) {
    if (net.realMoney) {
      console.error(
        `\nNo gas. ${net.currency} is the gas token on Arc and this wallet is empty.\n\n` +
          `  There is NO faucet on ${net.name} — it is real money.\n` +
          `  Send USDC on the ${net.name} network (chain ID ${net.chainId}) to:\n\n` +
          `      ${w.address}\n\n` +
          `  Cheapest confirmed route: withdraw USDC from an exchange that lists Arc\n` +
          `  (Kraken, Upbit), or route USDCoin via Base and bridge with Circle CCTP.\n` +
          `  A deployment needs under $0.10, so a few dollars is ample.\n\n` +
          `  ⚠  Sending on any other network means permanent loss.\n`
      );
    } else {
      console.error(
        `\nNo gas. ${net.currency} is the gas token on Arc and this wallet is empty.\n` +
          `Fund it from ${net.faucet} (network: ${net.name}) then re-run.\n` +
          `Address: ${w.address}`
      );
    }
    process.exitCode = 2;
    return;
  }

  const existing = readDeployment(net);
  if (existing?.address && !process.argv.includes("--force")) {
    const code = await prov.getCode(existing.address);
    if (code && code !== "0x") {
      console.log(`\nAlready deployed at ${existing.address} (use --force to deploy another).`);
      console.log(EXPLORER_ADDR(net, existing.address));
      return;
    }
  }

  const artifact = readArtifact("NoorCoin");
  const ctorArgs = [
    w.address, // initialOwner
    parseUnits(TOKEN.initialSupply.toString(), TOKEN.decimals),
    parseUnits(TOKEN.cap.toString(), TOKEN.decimals),
    w.address, // treasury (fee recipient, currently unused since feeBps = 0)
  ];

  const factory = new ContractFactory(artifact.abi, artifact.bytecode, w);
  const fees = await feeOverrides(prov);

  const deployTx = await factory.getDeployTransaction(...ctorArgs);
  const gasEstimate = await prov.estimateGas({ ...deployTx, from: w.address });
  const gasLimit = (gasEstimate * 120n) / 100n;

  console.log(`\ncontract    : ${TOKEN.name} (${TOKEN.symbol}), ${TOKEN.decimals} decimals`);
  console.log(`supply/cap  : ${TOKEN.initialSupply} / ${TOKEN.cap} ${TOKEN.symbol}`);
  console.log(`bytecode    : ${artifact.bytecode.length / 2} bytes`);
  console.log(`gasLimit    : ${gasLimit}`);
  console.log(`maxFeePerGas: ${formatUnits(fees.maxFeePerGas, "gwei")} gwei`);
  console.log(`max cost    : ${formatEther(gasLimit * fees.maxFeePerGas)} ${net.currency}\n`);

  // Hard spend ceiling. On mainnet this is real money, so the deployment aborts
  // rather than silently costing more than the operator authorised.
  const maxCost = gasLimit * fees.maxFeePerGas;
  const spendCap = parseUnits(process.env.ARC_MAX_SPEND_USDC ?? "0.50", 18);
  if (maxCost > spendCap) {
    throw new Error(
      `Refusing to deploy: worst-case cost ${formatEther(maxCost)} ${net.currency} ` +
        `exceeds the ${formatEther(spendCap)} ${net.currency} cap (raise ARC_MAX_SPEND_USDC to override).`
    );
  }
  if (net.realMoney) {
    console.log(`⚠  ${net.name} — spending REAL USDC. Worst case ${formatEther(maxCost)} ${net.currency}.\n`);
  }

  console.log("submitting deployment…");
  const contract = await factory.deploy(...ctorArgs, { ...fees, gasLimit });
  const deployTxHash = contract.deploymentTransaction().hash;
  console.log(`tx          : ${deployTxHash}`);
  console.log(`explorer    : ${EXPLORER_TX(net, deployTxHash)}`);

  const receipt = await contract.deploymentTransaction().wait(1);
  const address = await contract.getAddress();

  const code = await prov.getCode(address);
  if (!code || code === "0x") throw new Error("No bytecode at the deployed address");

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

  const deployment = {
    project: "Noor (NUR)",
    network: net.name,
    chainId: net.chainId,
    rpc: net.rpc,
    explorer: net.explorer,
    address,
    txHash: deployTxHash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    effectiveGasPrice: receipt.gasPrice?.toString() ?? null,
    deployer: w.address,
    derivationPath: record?.derivationPath ?? null,
    constructorArgs: ctorArgs.map((a) => a.toString()),
    constructorArgsHex: contract.deploymentTransaction().data.slice(-(ctorArgs.length * 64)),
    compiler: {
      version: "v0.8.28+commit.7893614a",
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
      contractName: TOKEN.contract,
      standardJsonInput: "build/standard-json-input.json",
      standardJsonInputSha256: sha256File(path.join(ROOT, "build/standard-json-input.json")),
    },
    sourceHash: keccak256("0x" + Buffer.from(fs.readFileSync(path.join(ROOT, "contracts/NoorCoin.sol"))).toString("hex")),
    verified: false,
    onchain,
    deployedAt: new Date().toISOString(),
  };

  const file = writeDeployment(deployment, net);
  console.log(`\n✅ deployed`);
  console.log(`address     : ${address}`);
  console.log(`block       : ${receipt.blockNumber}`);
  console.log(`gas used    : ${receipt.gasUsed}`);
  console.log(`name/symbol : ${onchain.name} (${onchain.symbol})`);
  console.log(`totalSupply : ${formatUnits(onchain.totalSupply, onchain.decimals)} ${onchain.symbol}`);
  console.log(`cap         : ${formatUnits(onchain.cap, onchain.decimals)} ${onchain.symbol}`);
  console.log(`owner       : ${onchain.owner}`);
  console.log(`\nexplorer    : ${EXPLORER_ADDR(net, address)}`);
  console.log(`record      : ${path.relative(ROOT, file)}`);
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

main().catch((e) => {
  console.error("\nDEPLOY FAILED:", e.shortMessage ?? e.message);
  if (e.info) console.error(JSON.stringify(e.info, null, 2));
  process.exitCode = 1;
});
