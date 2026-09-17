# Share kit — the honest way to reach the first 10 trades

## Why this file exists

The goal is 10 real trades from 10 different people. Getting there means reaching
real humans, and every platform that hosts them puts an identity gate in front of
new accounts — by design, because automated promotion is exactly what those gates
exist to stop.

**One gate settled the question.** Arc House's signup form ends with:

> **Are you a large language model?** *Disclose if you are not a human.*

That is a direct question, asked by the platform, about whether the account is
being opened by an AI. I will not answer "No" to it. Routing around an
anti-automation gate is the same spam I already refused, just with better
manners — and it would be a lie to a community you would then have to live inside.

So: **the accounts get opened by you, in your name, and I prepare everything
around them.** That is not a retreat. Everything that is actually mine to do, I
have done and will keep doing.

---

## What I need from you — three ways in, pick any

### 1. Your own people (highest chance, works today)

Ten people who know you will spend a dollar on something you built. That is a
favour, and it is fine as long as the message says so plainly. Send this to a
group chat or a few individuals — **before** the link:

> I built a small digital currency on Arc (that new Circle chain). It's real, it's
> on mainnet, the code is verified — and it has $2.55 of liquidity, so it is
> absolutely not an investment.
>
> If you're curious, buy $1 of NUR and you'll be one of the first people to trade
> on the chain. You'll probably lose a few cents to slippage — treat it like
> buying a souvenir, not a position.
>
> Everything is public: https://jadjbara3-cpu.github.io/noor/
> Trade here: https://app.uniswap.org/swap?chain=arc&outputCurrency=0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f
> Or send/receive with the payment app: https://jadjbara3-cpu.github.io/noor/pay.html
>
> Don't buy more than a couple of dollars. The pool is tiny and the price moves
> violently.

**Why the warning is in there:** people you know will believe you. Telling them
the pool is tiny is the difference between sharing a project and doing them harm.

### 2. Arc House — the targeted venue (you complete the identity step)

1. Open https://community.arc.io/login
2. Enter `jadjbara3@gmail.com`, then complete the create-account form **yourself**.
   It asks for country, city, LinkedIn, company URL, and whether an LLM filled it
   in. Answer honestly — that is the whole point.
3. Join the **Architects** group (10,466 members) and post in its **Forum**.
4. Use the draft in the next section.

The Architects forum wants contributions, not pitches. A post that reports what
you built and what you learned belongs there. A post that asks people to buy does
not.

### 3. Arc Discord

`https://discord.gg/buildonarc` — find the showcase or builders channel and post
the same draft. Discord needs a phone-verified account; that one is yours to make.

---

## Post draft (for Arc House Forum / Discord)

> **I deployed a currency on Arc for 13 cents. Here is everything, including the
> numbers that don't flatter it.**
>
> I wanted to find out what it actually takes to put a real token on a real
> mainnet, so I did it end to end and documented the whole thing.
>
> **What exists**
> - Noor (NUR) — ERC-20, chain 5042, supply fixed at 1,000,000,000 in the
>   constructor. `cap()` equals `totalSupply()`; `remainingMintable()` is 0.
> - Source is verified on the explorer as an exact match (solc 0.8.28, cancun).
> - Contract: `0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f`
> - A real Uniswap v2 pool: `0xa8dC7Eba119949500F8e18fD086a0bF151095910`
> - A payment app anyone can use: no backend, no custody, reads the chain directly
>
> **What it cost**
> - Contract deployment: $0.088
> - Circle CCTP bridge from Base to Arc: $0.016
> - One swap to trigger DEX indexing: $0.006
> - Total to go from nothing to a verified, indexed, tradeable token: **about 11 cents**
>
> **The numbers that don't flatter it**
> - The pool holds **$2.55**. That is not a typo.
> - A $1 buy moves the price about 40%. A $5 buy moves it 200%.
> - The "$1,040 fully-diluted value" you see on DexScreener is arithmetic on those
>   $2.55. It is not a valuation and nobody should read it as one.
> - There is no utility yet, no community, and no exchange listing.
>
> **What I learned that might be useful to you**
> - Arc mainnet accepts transactions with no allowlist. Read access is public.
> - Gas is USDC and the floor is 20 gwei; below that a transaction can hang forever.
> - On Arc the gas token *is* the bridged token, so a script that reads a balance,
>   sends an approve, then transfers the same balance will revert. Worth knowing.
> - DexScreener and GeckoTerminal both index Arc, and both index a pair only after
>   its **first swap**. Creating the pool is not enough.
> - explorer.arc.io sits behind Cloudflare, so verification has to be submitted
>   from a browser, not a script.
>
> **What I'm not doing**
> No volume bots, no wash trading, no paid boosts, no "buy before it moons". If
> you want to try a trade, $1 is plenty and you will probably lose a few cents to
> slippage. If that isn't interesting, that's a completely reasonable response.
>
> Repo with everything, including the scripts: https://github.com/jadjbara3-cpu/noor

---

## Tracking

I count real trades on chain: distinct addresses that bought. To check:

```bash
cd arc-token
node scripts/track-trades.mjs
```

The count starts at 0. The activation swap does not count — its sender is the
Uniswap router, not a person.
