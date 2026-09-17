# Blockscout Token Info — submission packet

Everything needed to get Noor (NUR) displayed with its name, description, website
and icon on the Arc explorer (`explorer.arc.io`), instead of a bare contract row.

**Status: SENT.** The request was emailed from `jadjbara3@gmail.com` to
`submissions@blockscout.com` on 2026-09-17, under the subject
*"Token info submission - Noor (NUR) on Arc Mainnet"*, and is visible in that
account's Sent folder. Blockscout replies with a link to supply the remaining
details; watch that inbox.

Route A below is kept for reference — it is no longer required, because the
signed proof of control substitutes for logging in with the deployer wallet.

---

## The facts (copy-paste ready)

| Field | Value |
| :--- | :--- |
| Token name | Noor |
| Symbol | NUR |
| Contract address | `0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f` |
| Chain | Arc Mainnet — chain ID `5042` |
| Deployer address | `0xB66BE4c1C3677a82105da62E447EAde1e243538f` |
| Decimals | 18 |
| Total supply | 1,000,000,000 NUR (immutable cap) |
| **Icon URL (48×48)** | `https://jadjbara3-cpu.github.io/noor/brand/favicon.png` |
| Project website | `https://jadjbara3-cpu.github.io/noor/` |
| Uniswap v2 pair | `0xa8dC7Eba119949500F8e18fD086a0bF151095910` |
| Verified source | `https://explorer.arc.io/address/0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f#code` |

**Project description** (paste as-is):

> Noor (NUR) is a fixed-supply ERC-20 digital currency on Arc Network, Circle's
> USDC-native Layer 1. Supply is capped at 1,000,000,000 NUR in the constructor
> and cannot be raised by anyone, including the owner — `cap()` equals
> `totalSupply()` and `remainingMintable()` returns zero. The Solidity source is
> verified on the Arc explorer as an exact match, EIP-2612 permit is supported
> for gasless approvals, any holder can burn, and the transfer fee is zero. NUR
> trades against USDC on the official Uniswap v2 deployment on Arc.

**Social / further links** (add any you create):

- Token list: `https://jadjbara3-cpu.github.io/noor/brand/tokenlist.json`
- Repository: `https://github.com/jadjbara3-cpu/noor`

---

## What was sent

The email included the field table above, the project description, and a
**cryptographic proof of control** of the deploying wallet — an EIP-191
(`personal_sign`) signature that recovers to
`0xB66BE4c1C3677a82105da62E447EAde1e243538f`. The private key never left this
machine; only the signature was transmitted, and a signature cannot be used to
move funds.

To re-verify the proof at any time:

```bash
node -e "const{verifyMessage}=require('ethers');console.log(verifyMessage(process.argv[1],process.argv[2]))" \
  "$(node -e "console.log(require('./.bl-proof.json').statement)")" \
  "$(node -e "console.log(require('./.bl-proof.json').signature)")"
```

---

## Route A — Deployer login (kept for reference)

Blockscout verifies you automatically when you are signed in as the wallet that
deployed the token.

1. Import the deployer key into MetaMask.
   - MetaMask → account menu → **Import account** → paste the private key for
     `0xB66BE4c1C3677a82105da62E447EAde1e243538f`.
   - The key is in `.secrets/mainnet-wallet.json` in this project, field
     `privateKey`.
   - **Security note:** this puts the treasury key (997,499,000 NUR) inside a
     browser extension. If you would rather not, use Route B. If you do it,
     remove the account from MetaMask again once the submission is accepted.
2. Add the Arc Mainnet network to MetaMask if it is not already there:
   RPC `https://rpc.mainnet.arc.io`, chain ID `5042`, symbol `USDC`.
3. Go to the token page:
   `https://explorer.arc.io/token/0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f`
4. Log in (top right) → **Continue with Web3 wallet** → select MetaMask → sign
   the message. Add an email to the account when prompted.
5. On the token page, click the **⋯ (three dots)** next to the address →
   **Add token info**.
6. Paste the fields from the table above and send the request.

Expected outcome: automatic wallet check passes, then QA reviews the description
and icon. Standard review has no guaranteed timeline; expedited review costs
99 USDC/USDT and must be paid on Ethereum, Optimism, Base or Robinhood Chain —
**not** on Arc.

## Route B — Email submission (no key in the browser)

Use this if you do not want the deployer key inside a browser extension.

1. Send an email **from the project's own address** to
   `submissions@blockscout.com`.
2. Include: the wallet address, all the fields above, and an explanation of your
   relationship to the project.
3. Include proof you control the deployer address. The cheapest is a signed
   message: sign any plain-text statement with the deployer key and paste the
   signature plus the exact message. Foundry (`cast wallet sign`) or any wallet
   can produce it.
4. They reply with a link to supply the remaining details.

---

## Draft email for Route B

> **Subject:** Token info submission — Noor (NUR) on Arc Mainnet
>
> Hello,
>
> I would like to submit token information for Noor (NUR) on Arc Mainnet
> (chain ID 5042).
>
> Token name: Noor
> Symbol: NUR
> Contract: 0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f
> Deployer wallet: 0xB66BE4c1C3677a82105da62E447EAde1e243538f
> Decimals: 18
> Total supply: 1,000,000,000 NUR (immutable cap)
> Icon (48x48 PNG): https://jadjbara3-cpu.github.io/noor/brand/favicon.png
> Website: https://jadjbara3-cpu.github.io/noor/
> Source (verified, exact match): https://explorer.arc.io/address/0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f#code
> Uniswap v2 pair: https://explorer.arc.io/address/0xa8dC7Eba119949500F8e18fD086a0bF151095910
> Token list: https://jadjbara3-cpu.github.io/noor/brand/tokenlist.json
>
> Description: Noor (NUR) is a fixed-supply ERC-20 digital currency on Arc
> Network, Circle's USDC-native Layer 1. Supply is capped at 1,000,000,000 NUR in
> the constructor and cannot be raised by anyone, including the owner. The source
> is verified on the Arc explorer as an exact match, EIP-2612 permit is
> supported, any holder can burn, and the transfer fee is zero. NUR trades
> against USDC on the official Uniswap v2 deployment on Arc.
>
> I control the deploying wallet. [Attach or paste a signature proving this.]
>
> Thank you.
