# DEPLOYMENT — Noor (NUR) on Arc Mainnet

Generated `2026-09-17T18:47:06.963Z` directly from chain state (chain ID `5042`).

> ⚠️ **This contract is deployed on Arc MAINNET and holds real value.**

## Live contract

| | |
| :--- | :--- |
| **Address** | [`0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f`](https://explorer.arc.io/address/0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f) |
| **Name / symbol** | Noor (NUR) |
| **Decimals** | 18 |
| **Total supply** | 1000000000.0 NUR |
| **Hard cap** | 1000000000.0 NUR |
| **Remaining mintable** | 0.0 NUR |
| **Owner** | `0xB66BE4c1C3677a82105da62E447EAde1e243538f` |
| **Verified source** | ✅ yes — [read it](https://explorer.arc.io/address/0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f#code) |
| **Verified at** | 2026-09-17T20:47:36.000Z |
| **Compiler** | `v0.8.28+commit.7893614a`, evm `cancun`, optimizer 200 runs |
| **Deployed** | 2026-09-17T17:46:40.558Z (block 21365329) |
| **Deploy tx** | `0x878fd0d726cc67152c20156db091f8758edf2076d7d409f4b81ef86db96b7616` |

### Operator wallet

| Item | Value |
| :--- | :--- |
| Address | `0xB66BE4c1C3677a82105da62E447EAde1e243538f` |
| Derivation | `m/44'/60'/0'/0/10` |
| Gas balance | 0.129053606 USDC |

### Runtime configuration

| Setting | Value | Meaning |
| :--- | :--- | :--- |
| `feeBps` | 0 | no transfer fee |
| `limitsEnabled` | false | no anti-whale limit |
| `paused` | false | token is live |
| `treasury` | `0xB66BE4c1C3677a82105da62E447EAde1e243538f` | fee recipient (unused) |
| `pendingOwner` | `0x0000000000000000000000000000000000000000` | no ownership change in flight |

## Market / liquidity

| Item | Value |
| :--- | :--- |
| Protocol | Uniswap v2 |
| Pair | [`0xa8dC7Eba119949500F8e18fD086a0bF151095910`](https://explorer.arc.io/address/0xa8dC7Eba119949500F8e18fD086a0bF151095910) |
| Router02 | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` |
| Factory | `0x89e5DB8B5aA49aA85AC63f691524311AEB649eba` |
| Created by | `0x282acec994254926959866384fcf1d31aee41f8f54ee8d480cdeb55d1c1eaed1` (block 21366612) |
| Reserves | 2451124.575955448359707434 NUR + 2.55 USDC |
| Opening price | 1 NUR = 0.000001 USDC |
| Implied FDV | $1,000 (derived from a 2.55 USDC pool — not a valuation) |
| LP tokens held by | `0xB66BE4c1C3677a82105da62E447EAde1e243538f` |

> Thin proof-of-market: 2.5 USDC of real capital. Severe slippage at any meaningful size.

## Public listings

| Platform | Status | Page |
| :--- | :--- | :--- |
| Dexscreener | indexed | [open](https://dexscreener.com/arc/0xa8dc7eba119949500f8e18fd086a0bf151095910) |
| Geckoterminal | indexed | [open](https://www.geckoterminal.com/arc/pools/0xa8dC7Eba119949500F8e18fD086a0bF151095910) |
| Coinmarketcap | not eligible yet | — |
| Blockscout | requested | — |
| UniswapTokenList | requested | [open](https://github.com/Uniswap/default-token-list/issues/2582) |
| Coingecko | via GeckoTerminal | [open](https://www.geckoterminal.com/arc/pools/0xa8dC7Eba119949500F8e18fD086a0bF151095910) |

- **dexscreener** — indexed by first swap on the pool; Enhanced Token Info is a paid product (USD 299-499) — not purchased.
- **geckoterminal** — Update Token Info Fast Pass is USD 199 — not purchased; GeckoTerminal powers CoinGecko's DEX data and feeds apps via its API.
- **coinmarketcap** — A tracked CMC listing requires a qualifying exchange and real volume; an untracked page can be requested but shows no price.
- **blockscout** — Token info emailed to submissions@blockscout.com from jadjbara3@gmail.com.
- **uniswapTokenList** — Official token request filed; the Uniswap default list does not cover Arc yet, so this registers the token for when it does.
- **coingecko** — CoinGecko consumes GeckoTerminal DEX data; a CoinGecko coin page needs a CoinGecko listing review.

## Holder balances

| Holder | Address | NUR | Share | Exempt |
| :--- | :--- | ---: | ---: | :---: |
| **operator wallet** (deployer, holds the genesis supply) | `0xB66BE4c1C3677a82105da62E447EAde1e243538f` | 997547875.424044551640292566 | 99.7548% | true |

Distribution addresses derived from the same mnemonic (currently unfunded on this chain):

| Role | Address | NUR | Share | Exempt | Gas (USDC) |
| :--- | :--- | ---: | ---: | :---: | ---: |
| main — Deployer / Treasury operations | `0x91400DA46CfcA15c2e3B09dF792BdFD0dd8D2Af6` | 0.0 | 0.00% | false | 0.0 |
| community — Community, airdrop & rewards pool | `0x724b502c55D256D900bf0E43c7Ccbe3035b19a0D` | 1000.0 | 0.00% | false | 0.0 |
| liquidity — Liquidity provision / market making | `0xfCE6DaFF33ab028331506f37cC2d5C7A2854a9AA` | 0.0 | 0.00% | false | 0.0 |
| ecosystem — Ecosystem & development fund | `0x1068e2D46F9a0551F60Efc226D41b8356Fca0bB3` | 0.0 | 0.00% | false | 0.0 |

## On-chain evidence

Every action below is a confirmed Arc transaction:

| # | Step | What it proves | Transaction |
| ---: | :--- | :--- | :--- |
| 1 | `bridge (Base)` | approve USDC -> TokenMessengerV2 (CCTP V2) | [`0x42b058f539a5347a…`](https://basescan.org/tx/0x42b058f539a5347aefdcad85bc122d9023bc969abbf02decd04566354bca8acf) |
| 2 | `bridge (Base)` | depositForBurnWithHook — burn 2.8 USDC, forward to Arc | [`0xfd8c13dfe9636857…`](https://basescan.org/tx/0xfd8c13dfe963685735a612ae4ad05b47992234efca950a75af3270049e96cd30) |
| 3 | `bridge (Arc)` | Circle forwarded mint — 2.783237 USDC delivered to Arc | [`0xbc057a28a66e0d8e…`](https://explorer.arc.io/tx/0xbc057a28a66e0d8e18fff55a6f7b3f009e22ce6756f9f8e9d44efe2fdae81fb0) |
| 4 | `deploy (Arc)` | NoorCoin contract creation on Arc Mainnet | [`0x878fd0d726cc6715…`](https://explorer.arc.io/tx/0x878fd0d726cc67152c20156db091f8758edf2076d7d409f4b81ef86db96b7616) |
| 5 | `smoke (Arc)` | live transfer — 1,000 NUR to m/44'/60'/0'/0/1 | [`0x87023fdba4d4aebe…`](https://explorer.arc.io/tx/0x87023fdba4d4aebe3e64685733cec803bde93b222c7e45387018d3a901ad9d55) |
| 6 | `smoke (Arc)` | EIP-2612 permit — gasless 500 NUR approval | [`0x876be46156e81f27…`](https://explorer.arc.io/tx/0x876be46156e81f273cffa93dee8b3829a77a6e15d04fb816f3d7392edba66894) |
| 7 | `swap (Arc)` | single indexing swap — 0.05 USDC → NUR (emits the Swap event DexScreener requires) | [`0xe45ae7a721322d4f…`](https://explorer.arc.io/tx/0xe45ae7a721322d4f3b217215a57b269a8dc2c5b9808701c7e2f3e8108ff8fe38) |
| 8 | `approve (Arc)` | approve USDC to Router02 for the indexing swap | [`0x99617dc07dc0e149…`](https://explorer.arc.io/tx/0x99617dc07dc0e149a40b3c6a95f3a5894362dafaeb355460b3df68915244cf11) |

## Safety properties verified on-chain

`scripts/mainnet-smoke.mjs` ran against the live mainnet contract — 16 assertions, all passed:

- reads: name, symbol, 18 decimals, supply = cap = 1,000,000,000, zero remaining mintable
- live ERC-20 transfer confirmed by balance deltas on both sides
- EIP-2612 `permit` signed off-chain and accepted on-chain
- minting past the cap reverts
- setting a fee above the 5% ceiling reverts

The full property suite (`scripts/guards.mjs`) was executed on Arc Testnet:

- minting one wei past the 1,000,000,000 cap
- setting a fee above the 5% hard ceiling
- setting the treasury to the zero address
- a non-owner calling `setExempt`, `setLimits` or `pause`
- enabling limits with a zero `maxTxAmount`
- transferring while paused (then `unpause` restores liveness)

## Reproduce from scratch

```bash
cd arc-token
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install
node scripts/compile.mjs     # std-json-input sha256: c6c56e74163f12ae0435f4a14e02b62118241dd0cce34b94234dd4b6a0cd4928
node scripts/mainnet-wallet.mjs --show   # real-money operator wallet
# fund it with USDC on Arc Mainnet (chain ID 5042) — there is no faucet
ARC_NETWORK=arc-mainnet node scripts/preflight.mjs        # go / no-go
ARC_NETWORK=arc-mainnet node scripts/deploy.mjs --yes
ARC_NETWORK=arc-mainnet node scripts/report.mjs
```

## Network reference

| Item | Value |
| :--- | :--- |
| Network | Arc Mainnet |
| Chain ID | `5042` (`0x13b2`) |
| RPC | `https://rpc.mainnet.arc.io` |
| Explorer | https://explorer.arc.io |
| Explorer API host | `https://explorer.arc.io` |
| Gas token | USDC (18 decimals; ERC-20 interface 6 decimals) |
| Minimum base fee | 20 Gwei (protocol floor) |
| Finality | ~780 ms, deterministic (Malachite consensus) |
| Faucet | none — real money only |
