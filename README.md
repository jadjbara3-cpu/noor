# Noor (NUR) — a digital currency on Arc Network

**Noor** is an ERC-20 digital currency deployed on **Arc Network**, Circle's
USDC-native, EVM-compatible Layer 1. This repository contains the contract, the
build pipeline, the deployment tooling, and the operational secrets record.

## 🟢 LIVE ON ARC MAINNET

| | |
| :--- | :--- |
| **Contract** | [`0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f`](https://explorer.arc.io/address/0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f) |
| **Source** | ✅ [verified, exact match](https://explorer.arc.io/address/0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f#code) — `v0.8.28`, evm `cancun`, optimizer 200 |
| **Deploy tx** | [`0x878fd0d7…b7616`](https://explorer.arc.io/tx/0x878fd0d726cc67152c20156db091f8758edf2076d7d409f4b81ef86db96b7616) |
| **Supply** | 1,000,000,000 NUR, hard cap = supply, zero inflation |
| **Owner** | `0xB66BE4c1C3677a82105da62E447EAde1e243538f` |
| **Smoke test** | ✅ 16/16 assertions — live transfer + EIP-2612 permit + guards revert |
| **Market** | Uniswap v2 NUR/USDC — [`0xa8dC7Eba…5910`](https://explorer.arc.io/address/0xa8dC7Eba119949500F8e18fD086a0bF151095910) · opening price 1 NUR = 0.000001 USDC |
| **Listed on** | [DexScreener](https://dexscreener.com/arc/0xa8dc7eba119949500f8e18fd086a0bf151095910) ✅ · [GeckoTerminal](https://www.geckoterminal.com/arc/pools/0xa8dC7Eba119949500F8e18fD086a0bF151095910) ✅ (both free, automatic on first swap) |
| **Requested** | [Uniswap default list #2582](https://github.com/Uniswap/default-token-list/issues/2582) · Blockscout token info (emailed) |
| **Funding route** | Binance → Base → Circle CCTP V2 (forwarding) → Arc, total cost ≈ $0.11 |
| **Record** | [`DEPLOYMENT-MAINNET.md`](./DEPLOYMENT-MAINNET.md) · [`MAINNET_LAUNCH_PLAN.md`](./MAINNET_LAUNCH_PLAN.md) |

> The pool holds a few USDC. At that depth a few dollars of trade moves the price
> several-fold — the reserves are public. Read them before trading.

### Brand & assets

| | |
| :--- | :--- |
| Logo masters | [`brand/logo.svg`](./brand/logo.svg) · [`brand/logo-mark.svg`](./brand/logo-mark.svg) · [`brand/wordmark.svg`](./brand/wordmark.svg) |
| Raster set | `brand/logo-{32,64,128,200,256,512}.png` + `logo-200-solid.png` (CoinMarketCap 200×200) |
| Token list | [`brand/tokenlist.json`](./brand/tokenlist.json) — Uniswap Token List standard |
| Landing page | [`site/index.html`](./site/index.html) — self-contained, no dependencies |
| One-pager | [`ONE_PAGER.md`](./ONE_PAGER.md) |
| Rebuild rasters | `node scripts/build-brand.mjs` |

Also deployed and verified on **Arc Testnet** at
[`0x5cA0543c…F0053`](https://testnet.arcscan.app/address/0x5cA0543cf51F9f2f2bd1722B7bAe76Ca7F1F0053)
— see [`DEPLOYMENT.md`](./DEPLOYMENT.md).

Run `node scripts/status.mjs` for live state, `node scripts/report.mjs` to
regenerate a report from chain state (`ARC_NETWORK=arc-mainnet` for mainnet).

---

| | |
| :--- | :--- |
| Token | **Noor (NUR)**, 18 decimals |
| Genesis supply | 1,000,000,000 NUR |
| Hard cap | 1,000,000,000 NUR — immutable, zero inflation |
| Network | Arc Testnet — chain ID `5042002` (`0x4cef52`) |
| RPC | `https://rpc.testnet.arc.io` |
| Gas token | USDC (18 decimals for gas, 6 for the ERC-20 interface) |
| Explorer | https://testnet.arcscan.app |
| Faucet | https://faucet.circle.com |

See [`TOKENOMICS.md`](./TOKENOMICS.md) for monetary policy and allocation, and
[`SECRETS.md`](./SECRETS.md) for keys, credentials and the recovery runbook.

---

## Contract

`contracts/NoorCoin.sol` — one self-contained file composing OpenZeppelin 5.1.0:

| Feature | Source | Why it matters |
| :--- | :--- | :--- |
| ERC-20 | `ERC20` | The currency standard every wallet and DEX speaks |
| Gasless approvals | `ERC20Permit` (EIP-2612) | Sign an approval instead of paying for an `approve` tx |
| Fixed supply | `ERC20Capped` | `totalSupply()` can never exceed 1,000,000,000 NUR |
| Deflation | `ERC20Burnable` | Holders can permanently destroy supply |
| Emergency stop | `ERC20Pausable` | Owner circuit breaker |
| Safe handover | `Ownable2Step` | Ownership transfer needs two steps — no typo can brick the token |
| Anti-whale | `maxTxAmount` / `maxWalletAmount` | Optional launch-window protection, exempt-list driven |
| Treasury fee | `feeBps` / `treasury` | Off by default, hard-capped at 5%, never applied to exempt accounts |
| Distribution | `batchTransfer` | One transaction for an airdrop or payroll run |

Extra views: `remainingMintable()`, `isExempt(account)`, `cap()`, `treasury()`.

## Arc-specific notes

- **Gas is USDC.** There is no separate native coin. A wallet with zero USDC
  cannot transact at all.
- **20 Gwei is a floor, not a suggestion.** `maxFeePerGas` below 20 Gwei can
  leave a transaction pending forever. `scripts/lib/arc.mjs` enforces the floor
  and doubles it for headroom.
- **`cancun` EVM target.** Arc baselines on the Osaka hard fork, which is a
  superset of Cancun; `PUSH0` and `MCOPY` are both available.
- **Verification is Etherscan-compatible.** Arcscan (Blockscout) accepts
  `POST /api?module=contract&action=verifysourcecode` — and this deployment only
  reads parameters from the **query string**, not a form body.
- **No wrapped USDC.** The native asset already satisfies `IERC20` at
  `0x3600…0000`.

## Layout

```
contracts/NoorCoin.sol        the token
scripts/
  compile.mjs                 solc-js build → build/NoorCoin.json + standard-json-input
  deploy.mjs                  deploy with Arc fee policy
  verify.mjs                  publish source on the explorer (Blockscout v2 multipart)
  record.mjs                  rebuild a deployment record from a tx hash
  configure.mjs               exempt role wallets from limits/fees
  distribute.mjs              move the genesis tranches to role wallets
  guards.mjs                  assert the safety properties on-chain
  demo.mjs                    prove permit / batchTransfer / burn end to end
  report.mjs                  render DEPLOYMENT.md from live chain state
  status.mjs                  read-only health check
  accounts.mjs                HD-derived allocation wallets
  wallet.mjs                  create/report the deployer wallet
  new-wallet.mjs              create additional named wallets
  mainnet-wallet.mjs          the real-money Arc mainnet operator wallet
  bridge-to-arc.mjs           Circle CCTP V2 transfer (Base ⇄ Arc), with rehearsal mode
  create-pool.mjs             create + seed the Uniswap v2 NUR/USDC market
  preflight.mjs               13-check go/no-go before spending gas
  launch.mjs                  autonomous orchestrator: wait → bridge → deploy → verify
  mainnet-smoke.mjs           live post-deploy assertions on mainnet
  build-brand.mjs             render brand SVGs into every raster size
  faucet.mjs                  Circle faucet via API key
  secrets-doc.mjs             regenerate SECRETS.md
  lib/build.mjs               import-graph resolver + solc driver
  lib/arc.mjs                 networks, provider, gas policy, deployment records
deployments/<chainId>.json    deployment record (address, tx, compiler, pool, constructor args)
build/standard-json-input.json  the exact compiler input, also used for verification
brand/                        logo masters (SVG) + generated PNGs + tokenlist.json
site/index.html               self-contained landing page
.secrets/                     mnemonic, private keys, keystore, API keys  (never commit)
SECRETS.md                    plain-text operations + secrets record
DEPLOYMENT-MAINNET.md         generated live mainnet report
DEPLOYMENT.md                 generated live testnet report
ONE_PAGER.md                  project one-pager
```

## Usage

```bash
# 1. dependencies
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install

# 2. compile
node scripts/compile.mjs

# 3. wallet + allocation accounts
node scripts/wallet.mjs
node scripts/accounts.mjs

# 4. fund the deployer with testnet USDC
#    browser: https://faucet.circle.com  (Network: Arc Testnet, USDC)
#    or API:  node scripts/faucet.mjs --key TEST_API_KEY:xxx:xxx

# 5. deploy, verify, distribute
node scripts/deploy.mjs
node scripts/verify.mjs
node scripts/distribute.mjs

# 6. inspect
node scripts/status.mjs
```

## Build determinism

`scripts/compile.mjs` writes `build/standard-json-input.json` containing every
source in the import graph keyed by its canonical source-unit name. The exact
same bytes are submitted for explorer verification, so the verified source is
guaranteed to be the source that produced the deployed runtime bytecode.

| Setting | Value |
| :--- | :--- |
| Compiler | `v0.8.28+commit.7893614a` |
| EVM version | `cancun` |
| Optimizer | enabled, 200 runs |
| Metadata bytecode hash | `ipfs` |
| Sources in graph | 26 |

## Security

- `.secrets/` and `SECRETS.md` hold live private keys. Both are gitignored.
- The token is deployed with limits disabled and the fee at 0 bps.
- `renounceOwnership()` is available once operations stabilise, permanently
  freezing all owner powers.

## License

MIT (contract `SPDX-License-Identifier: MIT`).
