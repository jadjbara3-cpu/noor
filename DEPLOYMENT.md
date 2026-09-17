# DEPLOYMENT — Noor (NUR) on Arc Testnet

Generated `2026-09-17T18:03:17.193Z` directly from chain state (chain ID `5042002`).

## Live contract

| | |
| :--- | :--- |
| **Address** | [`0x5cA0543cf51F9f2f2bd1722B7bAe76Ca7F1F0053`](https://testnet.arcscan.app/address/0x5cA0543cf51F9f2f2bd1722B7bAe76Ca7F1F0053) |
| **Name / symbol** | Noor (NUR) |
| **Decimals** | 18 |
| **Total supply** | 999999000.000000000000000001 NUR |
| **Hard cap** | 1000000000.0 NUR |
| **Remaining mintable** | 999.999999999999999999 NUR |
| **Owner** | `0x91400DA46CfcA15c2e3B09dF792BdFD0dd8D2Af6` |
| **Verified source** | ✅ yes — [read it](https://testnet.arcscan.app/address/0x5cA0543cf51F9f2f2bd1722B7bAe76Ca7F1F0053#code) |
| **Verified at** | 2026-09-17T17:04:39.423983Z |
| **Compiler** | `v0.8.28+commit.7893614a`, evm `cancun`, optimizer 200 runs |
| **Deployed** | 2026-09-17T17:00:48.000Z (block 62602220) |
| **Deploy tx** | `0x14f397b95237613cb4d068eacda63ac80ff4a71dd1404922266ec4580be38751` |

### Operator wallet

| Item | Value |
| :--- | :--- |
| Address | `0x91400DA46CfcA15c2e3B09dF792BdFD0dd8D2Af6` |
| Derivation | `m/44'/60'/0'/0/0` |
| Gas balance | 0.017820648915 USDC |

### Runtime configuration

| Setting | Value | Meaning |
| :--- | :--- | :--- |
| `feeBps` | 0 | no transfer fee |
| `limitsEnabled` | false | no anti-whale limit |
| `paused` | false | token is live |
| `treasury` | `0x91400DA46CfcA15c2e3B09dF792BdFD0dd8D2Af6` | fee recipient (unused) |
| `pendingOwner` | `0x0000000000000000000000000000000000000000` | no ownership change in flight |

## Holder balances

| Role | Address | NUR | Share | Exempt | Gas (USDC) |
| :--- | :--- | ---: | ---: | :---: | ---: |
| main — Deployer / Treasury operations | `0x91400DA46CfcA15c2e3B09dF792BdFD0dd8D2Af6` | 399999939.000000000000000001 | 40.00% | true | 0.017820648915 |
| community — Community, airdrop & rewards pool | `0x724b502c55D256D900bf0E43c7Ccbe3035b19a0D` | 299998761.0 | 30.00% | true | 0.049238225 |
| liquidity — Liquidity provision / market making | `0xfCE6DaFF33ab028331506f37cC2d5C7A2854a9AA` | 200000270.0 | 20.00% | true | 0.0 |
| ecosystem — Ecosystem & development fund | `0x1068e2D46F9a0551F60Efc226D41b8356Fca0bB3` | 100000030.0 | 10.00% | true | 0.0 |

## On-chain evidence

Every action below is a confirmed Arc transaction:

| # | Step | What it proves | Transaction |
| ---: | :--- | :--- | :--- |
| 1 | `faucet` | Circle faucet drip — 20 testnet USDC | [`0x600441fb86814c77…`](https://testnet.arcscan.app/tx/0x600441fb86814c778530009bb813f58337768b3642b9d603a9c49d86dce5c021) |
| 2 | `deploy` | NoorCoin contract creation | [`0x14f397b95237613c…`](https://testnet.arcscan.app/tx/0x14f397b95237613cb4d068eacda63ac80ff4a71dd1404922266ec4580be38751) |
| 3 | `distribute` | 300,000,000 NUR → community | [`0xf141476b9e6676f7…`](https://testnet.arcscan.app/tx/0xf141476b9e6676f74d21aec61005d372d583760fac1860c46ac0abc5b0ff089f) |
| 4 | `distribute` | 200,000,000 NUR → liquidity | [`0xbe3b13ddef48b7f5…`](https://testnet.arcscan.app/tx/0xbe3b13ddef48b7f5f47f10662b610d900a1271ec22ff8f3f73fa6f820469a724) |
| 5 | `distribute` | 100,000,000 NUR → ecosystem | [`0xb823bba1a10070b7…`](https://testnet.arcscan.app/tx/0xb823bba1a10070b783e9fc03229f2e7a10cc11265f4ec375b554b3b3d2b6951e) |
| 6 | `configure` | setExempt(community) | [`0x8bc06666537043be…`](https://testnet.arcscan.app/tx/0x8bc06666537043be94b4e1c89558e439c3279e5a6341a95e34d429ed391455dd) |
| 7 | `configure` | setExempt(liquidity) | [`0x727169cb89b80393…`](https://testnet.arcscan.app/tx/0x727169cb89b80393967d026de163782698cedf31fee5eb8aae5e2ca80f508620) |
| 8 | `configure` | setExempt(ecosystem) | [`0x086117fa77964d52…`](https://testnet.arcscan.app/tx/0x086117fa77964d52fb7769813fc51ea35244589e60d24ca54e89389715713482) |
| 9 | `demo` | native USDC gas top-up for community | [`0xb1e989c7b40a6b76…`](https://testnet.arcscan.app/tx/0xb1e989c7b40a6b76487232a4fefcfb4fa7132a889cf5fbf0a2bd97ab11313943) |
| 10 | `demo` | EIP-2612 permit — gasless 1000 NUR approval | [`0x4dac5a5a38a05a58…`](https://testnet.arcscan.app/tx/0x4dac5a5a38a05a58e86fcfd48cdeb5b223c78cc0eac2b992740db0997cc7f8d4) |
| 11 | `demo` | transferFrom — spend 250 NUR of the allowance | [`0x49e548ef294d4e5e…`](https://testnet.arcscan.app/tx/0x49e548ef294d4e5ef77a26b7ecf12677d7847d1b484f7c9cb6c69822c1a98115) |
| 12 | `demo` | batchTransfer — 3 recipients in one tx | [`0x996251ad152a9b2a…`](https://testnet.arcscan.app/tx/0x996251ad152a9b2aecaef1c7838536a8de943c0e145e97334d36e862b4a3453f) |
| 13 | `demo` | burn — 1000 NUR destroyed | [`0x7d4b2306c15a8898…`](https://testnet.arcscan.app/tx/0x7d4b2306c15a88981222023db1b1712b63b91ea0489a78f693d6986226413bbc) |
| 14 | `guards` | pause() — circuit breaker on | [`0x3dd801a72a8432dc…`](https://testnet.arcscan.app/tx/0x3dd801a72a8432dcb23e6841ba7b643a4d844a9c4691d6cd31ceb4daf8f8664b) |
| 15 | `guards` | unpause() — circuit breaker off | [`0x4f21d899ea268f1b…`](https://testnet.arcscan.app/tx/0x4f21d899ea268f1b8b3944a784fc099334e4be467661a7fb8b4160d0a56977ed) |
| 16 | `guards` | transfer after unpause — proves liveness | [`0x20f4e165f727121f…`](https://testnet.arcscan.app/tx/0x20f4e165f727121fe6f1938adfc1c2d1bf13175fce87c2c16c9fb5ce71da27eb) |

## Safety properties verified on-chain

`scripts/guards.mjs` asserts each of the following and all of them reverted as required:

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
node scripts/wallet.mjs      # restore the mnemonic from SECRETS.md first
node scripts/accounts.mjs
node scripts/faucet.mjs      # fund gas
node scripts/deploy.mjs
node scripts/record.mjs <txHash>   # if the local record is lost
node scripts/verify.mjs
node scripts/configure.mjs
node scripts/distribute.mjs
node scripts/status.mjs
node scripts/guards.mjs
```

## Network reference

| Item | Value |
| :--- | :--- |
| Network | Arc Testnet |
| Chain ID | `5042002` (`0x4cef52`) |
| RPC | `https://rpc.testnet.arc.io` |
| Explorer | https://testnet.arcscan.app |
| Explorer API host | `https://explorer.testnet.arc.io` |
| Gas token | USDC (18 decimals; ERC-20 interface 6 decimals) |
| Minimum base fee | 20 Gwei (protocol floor) |
| Finality | ~780 ms, deterministic (Malachite consensus) |
| Faucet | https://faucet.circle.com |
