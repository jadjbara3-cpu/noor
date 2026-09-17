# Noor (NUR) — Project One-Pager

*Last updated 2026-09-17. All figures read from Arc mainnet.*

---

## Summary

**Noor (NUR)** is a fixed-supply ERC-20 digital currency deployed on **Arc
Network**, Circle's USDC-native, EVM-compatible Layer 1. It exists as a working,
verifiable on-chain asset: a contract whose source matches its bytecode, a
supply that cannot be inflated, and a live Uniswap market anyone can trade
against.

| | |
| :--- | :--- |
| **Token** | Noor — `NUR`, 18 decimals |
| **Chain** | Arc Mainnet — chain ID `5042` |
| **Contract** | `0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f` |
| **Supply** | 1,000,000,000 NUR |
| **Hard cap** | 1,000,000,000 NUR — immutable |
| **Source** | Verified, **exact match** on the Arc explorer |
| **Market** | Uniswap v2 pair `0xa8dC7Eba119949500F8e18fD086a0bF151095910` (NUR/USDC) |
| **Issuer powers** | Fees ≤ 5% (currently 0), pause, re-issue burned supply. Cap cannot change. |

---

## Why Arc

Arc is Circle's Layer 1 built around USDC as the native gas asset. Fees are
denominated in dollars, finality is deterministic in roughly 780 ms, and the
chain is EVM-equivalent at the Cancun/Osaka level — so standard tooling,
wallets, and contracts work unmodified. For a currency whose whole value
proposition is predictability, a chain whose transaction cost is quoted in the
same unit as the asset is a coherent home.

---

## Monetary design

| Property | Value |
| :--- | :--- |
| Genesis supply | 1,000,000,000 NUR, minted to the deployer |
| Cap | 1,000,000,000 NUR, set in the constructor, immutable |
| Inflation | **None.** Supply can only reach the cap again by re-issuing previously burned tokens |
| Deflation | Any holder may `burn()` / `burnFrom()` |
| Transfer fee | 0 bps at launch; hard ceiling 500 bps (5%) |
| Anti-whale limits | Disabled; exempt-list mechanism available for launch windows |

`cap() == genesis supply` is the strongest guarantee the design can offer: no
actor, including the owner, can create a single token beyond one billion.

---

## Technical composition

Built on OpenZeppelin 5.1.0, composed in a single file:

| Module | Contribution |
| :--- | :--- |
| `ERC20` | The standard every wallet, DEX and indexer speaks |
| `ERC20Permit` (EIP-2612) | Signature-based approvals — approve without a transaction |
| `ERC20Capped` | The immutable supply ceiling |
| `ERC20Burnable` | Holder-driven deflation |
| `ERC20Pausable` | Owner circuit breaker for incidents |
| `Ownable2Step` | Two-step ownership transfer, no single-signature footgun |
| Anti-whale guards | Optional `maxTxAmount` / `maxWalletAmount`, exempt-list driven |
| Treasury fee | Optional, 0 by default, hard-capped at 5% |
| `batchTransfer` | Single-transaction distribution |

Every balance movement funnels through one `_update` override, so limits, fees,
the cap and the pause switch can never be bypassed by an unusual call path.

---

## Allocation

| Tranche | Share | Amount | Purpose |
| :--- | ---: | ---: | :--- |
| Deployer / Treasury | 40% | 400,000,000 | Operations and treasury |
| Community & Rewards | 30% | 300,000,000 | Airdrops, incentives, grants |
| Liquidity | 20% | 200,000,000 | Market depth and DEX liquidity |
| Ecosystem & Development | 10% | 100,000,000 | Engineering and integrations |

**Status:** an allocation plan, not a claim about present distribution. Token
movements are executed on chain as they are used, and every one is a public
transaction.

---

## Verification

Nothing about Noor requires trust in a document.

| Claim | How to check it |
| :--- | :--- |
| The source is the running code | Read the exact-match verification on the Arc explorer |
| The supply is capped | Call `cap()` and `totalSupply()`; call `remainingMintable()` |
| No hidden fee | Call `feeBps()` — returns 0 |
| Nobody can freeze your tokens | The contract has no blacklist; `paused` is currently false |
| The market is real | Inspect the pair's reserves — and note their size |

Reproducing the build: compiler `v0.8.28+commit.7893614a`, evm `cancun`,
optimizer enabled at 200 runs. The standard-JSON compiler input is committed in
the repository and its SHA-256 is recorded so the build can be replayed.

---

## Market reality

The Uniswap v2 pool holds a few USDC. At that depth a trade of a few dollars
moves the price several-fold. The pool reserves are public and small; anyone
considering a trade should read them first. The implied fully-diluted figure
derived from such a pool is arithmetic, not a valuation.

There is no centralised-exchange listing, no CoinMarketCap ranking, and no
market maker. Those require capital and coverage this project does not have.

---

## Risks

- **No guarantee of value.** NUR has no issuer backing, no reserves, no peg.
- **Thin liquidity.** Slippage is severe at any meaningful size.
- **Owner powers.** The owner can currently pause transfers and set a fee up to
  5%. Both are capped and observable, and `renounceOwnership()` can freeze every
  owner power permanently.
- **Smart-contract risk.** The code is small and standard, but no third-party
  audit has been performed.
- **Regulatory risk.** Issuing or promoting a transferable token is regulated in
  many jurisdictions. Nothing here is legal, tax, or investment advice.

---

## Links

| | |
| :--- | :--- |
| Contract | https://explorer.arc.io/address/0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f |
| Verified source | https://explorer.arc.io/address/0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f#code |
| Liquidity pair | https://explorer.arc.io/address/0xa8dC7Eba119949500F8e18fD086a0bF151095910 |
| Arc documentation | https://docs.arc.io |
| Circle CCTP | https://developers.circle.com/cctp |

---

*Noor is an independent project. It is not affiliated with, endorsed by, or
sponsored by Circle, Arc, or Uniswap. "Noor" and "NUR" name this token only.*
