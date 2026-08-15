# STRK20 integration reference

Milestone 2 checkpoint. Documents every STRK20 API surface VeilPay relies on, sourced from the pinned starter kit code (commit `187fe78`) plus primary docs (strk20-by-example.org, starknet-privacy). No API is guessed — every entry links to a file and line, an npm package, or an authoritative external doc.

## Pinned packages

From `package.json`:

| Package | Version | Purpose |
|---|---|---|
| `starknet` | `10.4.0` | STRK20 Wallet API landed in 10.4.0. Pinned exact — a bare `latest` resolves to 10.0.x with no STRK20 methods. |
| `@starknet-io/get-starknet-discovery` | `6.0.2` | Wallet-standard discovery (replaces starknetkit). |
| `@starknet-io/get-starknet-wallet-standard` | `6.0.2` | Types for wallet-standard wallets. |
| `@starknet-io/types-js` | `0.10.3` (dev) | Provides `WALLET_API.STRK20_ACTION` union. |
| `next` | `^16.0.8` (actual: 16.3.1) | Runtime. `agentRules: false` in `next.config.js` — do NOT remove. |

Runtime constraints:
- Node 20.9+ (Next.js 16 requirement). We run 20.19.5.
- `pnpm@10.34.5` — pnpm 11 needs Node 22+.

## The Wallet API path (our chosen integration)

VeilPay uses **only** the Wallet API path. The starkware-libs Privacy SDK (`@starkware-libs/starknet-privacy-sdk`) is **not** installed and **not** used — it needs Node 24+, the user's private key, and a proving-service URL; it is wrong for a browser dapp.

The Wallet API surface is three methods on a `WalletAccountV6` instance:

### 1. `strk20InvokeTransaction(actions: STRK20_ACTION[]) → { transaction_hash }`

Submits one or more STRK20 actions in **one** wallet-signed transaction. Called at `src/app/components/client/WalletHandle/WalletAccountV6Tag.tsx:205`.

Batching is real. The "echo" flow at `WalletAccountV6Tag.tsx:345-353` demonstrates a three-action batch (withdraw + transfer + invoke). Implication for VeilPay: **an N-recipient payroll can be a single call**, i.e. one wallet confirmation for the whole payroll.

### 2. `strk20Balances(tokens: string[]) → { token, amount }[]`

Reads shielded balances. Empty array = all shielded tokens. Called at `WalletAccountV6Tag.tsx:293`. Called before payroll to verify employer's private balance ≥ sum of amounts.

### 3. `deployContract({ classHash, constructorCalldata }) → { transaction_hash, contract_address }`

Standard `WalletAccountV6` method (not STRK20-specific). Used only for deploying the echo helper class (`WalletAccountV6Tag.tsx:251`). VeilPay may not need this.

## STRK20 action types

Union type from `@starknet-io/types-js` (WALLET_API.STRK20_ACTION), verified in-code:

| Type | Shape | Meaning |
|---|---|---|
| `deposit` | `{ type: "deposit", token, amount }` | Shield: move public tokens → private pool. Requires prior `approve()` on the ERC-20 to the pool. |
| `withdraw` | `{ type: "withdraw", token, amount, recipient }` | Unshield: private pool → public `recipient`. Amounts and addresses become public here. |
| `transfer` | `{ type: "transfer", token, amount, recipient }` | Private in-pool transfer. **The one payroll relies on.** |
| `invoke` | `{ type: "invoke", contract, calldata }` | Call an anonymizer/DeFi helper from inside the pool. Not needed for MVP payroll. |

Amounts are hex-encoded via `starknet.num.toHex(bigint)`. Base units (18 decimals for STRK): `1n * 10n ** 18n` = 1 STRK.

Special placeholder strings the wallet substitutes (do NOT hex-normalize):
- `"OPEN"` — declares an open output note (advanced, for `invoke` flows only)
- `"${poolAddress}"`, `"${openNoteIds[N]}"` — filled in by the wallet at signing time

## Networks + providers

STRK20 privacy pool is deployed on Mainnet (frontend provider index 0) and Sepolia (index 2). Source: `src/utils/constants.ts:12-15, 44-45`.

```
0 → Mainnet   (Alchemy: starknet-mainnet.g.alchemy.com/... + NEXT_PUBLIC_PROVIDER_URL)
1 → spare public testnet RPC (NOT STRK20 supported — ignored)
2 → Sepolia   (Alchemy: starknet-sepolia.g.alchemy.com/... + NEXT_PUBLIC_PROVIDER_URL)
```

`Strk20Networks` in `constants.ts` gates the UI: if the connected wallet's chain ≠ Mainnet or Sepolia, the STRK20 buttons are disabled.

Chain-ID detection at connect: `walletV6.requestChainId(wallet)` from starknet.js.

## Contract addresses (canonical, from `src/utils/constants.ts`)

| Symbol | Address | Notes |
|---|---|---|
| STRK ERC-20 | `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` | Same on Mainnet + Sepolia (`constants.ts:7`). |
| Echo helper class hash | `0x2a4482a13cb7f70dce6f7ba99c4ee6ce404379abeddd9b831b6bf24eb71e137` | Declared on Mainnet + Sepolia (`constants.ts:33`). |
| Echo helper (Mainnet instance) | `0x78ae662e0cc6d1ab2cfeaf2a51ba8783d88e31886f88a794d142f95a6f8735b` | `constants.ts:23` — VeilPay does NOT use the echo helper for payroll. |
| Privacy pool (Sepolia v2.0) | `0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91` | From strk20-by-example.org llms-full.txt (July 2026). Not hardcoded in the starter — the wallet knows it. |
| Privacy pool (Mainnet) | not yet recorded here | Held inside the wallet's Wallet API implementation. Look up in Ready wallet source or ask maintainers before Milestone 9 mainnet demo. |

## STRK20 constraints that shape VeilPay's UX

1. **Both sender and recipient must be registered in the pool.** Sending private transfers to unregistered recipients fails or requires an escrow helper. → VeilPay demo will use 3 pre-registered Sepolia wallets (user will provide addresses).
2. **New notes mature 10 blocks after creation.** After the employer's first shield, wait ~10 blocks (Sepolia ~2 minutes) before the payroll batch can spend those notes. → Demo flow should either pre-shield well before demo time OR show a maturity progress indicator.
3. **Deposit screening (FPI).** Every shield deposit is signed by the pool's FPI screening service; blocked addresses fail even in local dev. → Employer wallet must be a "clean" address.
4. **Edges are public.** Deposit and withdraw expose amounts + addresses. Only in-pool `transfer` is private. → README already states this; payroll flow should only use `transfer` in the private critical path.
5. **Long proof-verification window.** Privacy pool txs verify a STARK proof on-chain. Starter kit polls with a 400 × 3s budget (`WalletAccountV6Tag.tsx:224`). Expect confirmation to take minutes, not seconds. → Payroll UX must show pending state clearly.

## What VeilPay adds on top of the starter kit

- A **payroll model** (`type Payroll`, `type PayrollRecipient`) with `displayAmount` (fake fiat label) separated from `executionAmount` (tiny real base-unit value). Safe-demo-mode enforced.
- A **demo generator** producing seeded fictional names + display amounts, mapped to a small set of controlled recipient addresses.
- A **payroll executor** that builds one STRK20_ACTION[] of `transfer`s and calls `strk20InvokeTransaction` once. Per-recipient status is derived from the single receipt.
- Copy + IA replacing the starter's tab-based demo (Shield / Send / Unshield / Echo / Balances) with the payroll flow (Payroll → Review → Execute).

None of this modifies the shield / unshield / balances primitives — those stay as-is until Milestone 9 polish.

## References

- Starter kit code: this repo, files listed above.
- STRK20 by example: https://strk20-by-example.org and https://strk20-by-example.org/llms-full.txt
- Privacy pool contracts: https://github.com/starkware-libs/starknet-privacy
- Wallet API types: `node_modules/@starknet-io/types-js`
- Starter kit README + attribution: `THIRD_PARTY_NOTICES.md`
