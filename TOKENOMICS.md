# Noor (NUR) — tokenomics

## Monetary policy

| Parameter | Value |
| :--- | :--- |
| Name | **Noor** |
| Symbol | **NUR** |
| Decimals | 18 |
| Genesis supply | 1,000,000,000 NUR |
| Hard cap | 1,000,000,000 NUR (immutable, set in the constructor) |
| Inflation | **None** — `totalSupply()` can never exceed the cap |
| Deflation | Holders may `burn()` / `burnFrom()` permanently |
| Transfer fee | 0 bps at launch (ceiling 500 bps = 5%, owner-settable) |
| Anti-whale limits | Disabled at launch (owner-settable, exempt-list based) |

`cap() == genesis supply` is the strongest available on-chain promise: the owner
can only re-mint tokens that were previously burned, and can never create supply
beyond 1,000,000,000 NUR. `remainingMintable()` exposes exactly how much of the
cap is unissued at any moment.

## Allocation

| Tranche | Share | Amount | Wallet role | Purpose |
| :--- | ---: | ---: | :--- | :--- |
| Deployer / Treasury | 40% | 400,000,000 NUR | `main` | Operations, listings, market making, treasury |
| Community & Rewards | 30% | 300,000,000 NUR | `community` | Airdrops, incentives, grants to users |
| Liquidity | 20% | 200,000,000 NUR | `liquidity` | DEX/AMM liquidity, market depth |
| Ecosystem & Dev | 10% | 100,000,000 NUR | `ecosystem` | Engineering, audits, integrations |

Each tranche is a separate HD-derived account so on-chain balances are
independently verifiable. Addresses are recorded in `SECRETS.md`.

Distribution is executed by `scripts/distribute.mjs`, which produces four
verifiable ERC-20 `Transfer` transactions on Arc.

## Why these mechanics

- **ERC-20 + EIP-2612 permit.** A currency needs signature-based approvals so
  that payments and subscriptions do not require a separate `approve` transaction.
- **Fixed cap.** Prevents the single largest trust failure in token design:
  unbounded owner issuance.
- **Burnable.** Supply can contract, which makes the fixed cap a ceiling rather
  than a target.
- **Pausable + Ownable2Step.** Incident response without a single-step ownership
  footgun; `renounceOwnership()` is available to make the token fully immutable.
- **Optional, hard-capped fee.** Defaults off. If ever switched on it can never
  exceed 5%, and exempt accounts bypass it entirely so DEX pools cannot be
  drained by the fee.
- **Anti-whale guards.** Available for a launch window, disabled by default,
  bypassed for exempt accounts (pools, bridges, treasuries).

## Post-deploy hardening checklist

1. `node scripts/verify.mjs` — publish the source on the explorer.
2. `node scripts/distribute.mjs` — move the tranches to their role wallets.
3. Optional: `token.renounceOwnership()` to make the token permanently
   ownerless (freezes mint, pause, fee and limit controls forever).
4. Optional: `token.setExempt(<ammPool>, true)` before adding liquidity.
