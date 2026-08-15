# VeilPay

**Private Payroll on Starknet.**

VeilPay is a hackathon project that demonstrates paying multiple recipients privately on Starknet using the STRK20 privacy primitives (privacy pool + STRK20 Wallet API). Public observers should not be able to trivially reconstruct the recipient-to-amount mapping of a payroll batch.

Built by [OpenDagri](https://github.com/OpenDagri).

## Status

Milestone 0 — bootstrap. See `CLAUDE.md` for the full development plan and constraints.

## Stack

- Next.js 16, React 19, TypeScript
- starknet.js 10 (STRK20 Wallet API via `WalletAccountV6`)
- `get-starknet` v6 for wallet discovery
- Cairo helper contract under `cairo/` (optional privacy_invoke pattern)

## Getting started

```bash
pnpm install
cp .env.example .env.local   # add your Alchemy Starknet RPC key
pnpm dev                     # http://localhost:3000
```

Requires a STRK20-capable Starknet wallet (currently Ready wallet) on Sepolia or Mainnet.

## Attribution

Bootstrapped from [`Akashneelesh/strk20-starter-kit`](https://github.com/Akashneelesh/strk20-starter-kit) (MIT), which itself is bootstrapped from `PhilippeR26/Starknet-WalletAccount`.

## Privacy honesty statement

STRK20 shields movement inside its pool. Deposits and withdrawals still expose the shielding address and the deposit/withdraw amount. VeilPay does not claim stronger privacy properties than the underlying protocol provides — see `docs/` for details as they are written.

## License

MIT — see `LICENSE`.
