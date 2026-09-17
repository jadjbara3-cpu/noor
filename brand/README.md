# Noor (NUR) — Brand & Asset Kit

Everything a wallet, explorer, DEX, or listing site asks for, in one place.

## Live token

| | |
| :--- | :--- |
| Name / symbol | **Noor** / **NUR** |
| Decimals | 18 |
| Chain | Arc Mainnet — chain ID `5042` |
| Contract | `0x82c9411BBDdafF86F0Ee8E95275256AE136F8c1f` |
| Supply | 1,000,000,000 NUR (hard cap = supply, zero inflation) |
| Market | Uniswap v2 pair `0xa8dC7Eba119949500F8e18fD086a0bF151095910` (NUR/USDC) |

## Colours

| Role | Hex |
| :--- | :--- |
| Navy (primary) | `#0A1B33` |
| Deep blue | `#113055` |
| Arc blue | `#1A4E80` |
| Gold (primary light) | `#FFCF6B` |
| Gold deep | `#D98A15` |
| Cream highlight | `#FFFBEE` |
| Ink (text on light) | `#0A1B33` |
| Muted (secondary text) | `#7C879B` |

## Typography

| Use | Stack |
| :--- | :--- |
| Display / wordmark | `Inter, "Segoe UI", Helvetica, Arial, sans-serif` — 700 weight, wide tracking |
| Body | `Inter, system-ui, -apple-system, "Segoe UI", sans-serif` |
| Monospace (addresses) | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` |

## Files

| File | Size | Use |
| :--- | :--- | :--- |
| `logo.svg` | 200×200 | **Master.** Circular coin mark, navy background |
| `logo-mark.svg` | 200×200 | Master mark on transparent — light surfaces |
| `wordmark.svg` | 700×190 | Master horizontal lockup |
| `logo-32.png` | 32×32 | Favicon, tiny UI |
| `logo-64.png` | 64×64 | Wallet list rows |
| `logo-128.png` | 128×128 | App icons |
| `logo-200.png` | **200×200** | **Token lists, CoinMarketCap, CoinGecko** |
| `logo-256.png` | 256×256 | High-DPI UI |
| `logo-512.png` | 512×512 | Press kits, presentations |
| `logo-200-solid.png` | 200×200 | Same mark, flattened on navy (some forms reject alpha) |
| `logo-mark-200/512.png` | — | Mark only, transparent |
| `wordmark.png` | 1400×380 | Headers, documentation, decks |
| `favicon.png` | 48×48 | Web |
| `tokenlist.json` | — | Uniswap Token List standard |

Regenerate every raster from the SVG masters:

```bash
node scripts/build-brand.mjs
```

The SVGs are the source of truth. Never edit the PNGs by hand.

## Design rationale

**Noor (نور) means "light".** The mark is an eight-pointed star — a form used
across Islamic geometry for centuries — rendered as two overlapping squares with
a luminous core. It reads as both a star and an aperture. The navy field is the
night; the gold is the light in it.

The geometry is deliberately simple: it survives being scaled to 32 px, being
rendered in one colour, and being embroidered, stamped, or printed.

## Before you publish

`tokenlist.json` contains `RAW_HOST` placeholders. Replace them with a real
public base URL before submitting anywhere — for example a GitHub repository's
`raw.githubusercontent.com` prefix, an IPFS gateway, or your own domain. Wallets
and listing sites fetch `logoURI` over HTTPS; a dead link means a blank icon.

Suggested layout once hosted:

```
https://<your-host>/brand/logo-200.png
https://<your-host>/brand/tokenlist.json
```

## Trademark note

"Noor" and "NUR" are used here as the name of this token only. The mark does not
imply affiliation with Circle, Arc, or Uniswap. Do not use their logos alongside
this one in a way that suggests endorsement.
