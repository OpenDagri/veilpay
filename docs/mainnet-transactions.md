# Mainnet transactions

Every real Starknet Mainnet transaction VeilPay initiates lands here.
This file IS the hackathon submission evidence.

Wallet: **Ready X** on **Starknet Mainnet**.
Verified STRK token: `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d`.
Chain ID: `SN_MAIN` (`0x534e5f4d41494e`).

## Before every transaction (operator checklist)

The app enforces the first three via `src/lib/starknet/networks.ts`; the
remaining items are the operator's responsibility.

1. Wallet chain badge in the Payroll tab reads **"Chain verified: Starknet Mainnet"** (green).
2. Token badge reads **"Token verified: STRK — 0x0471…938d"** (green).
3. Preflight reports **"Shielded balance covers payroll"** (green).
4. Read the Confirmation card end-to-end before clicking **Sign & submit**:
   employer address, per-recipient address, per-recipient amount, total.
5. Approve the wallet popup only after confirming the amount + recipient
   in Ready's own confirmation matches the app's Confirmation card.
6. Wait for on-chain confirmation. Copy the tx hash from the receipt card.
7. Add a row to the table below with all fields filled.

Never approve a transaction if the app shows a red badge on chain or token,
or if the amount / recipient in Ready doesn't match the app.

## Log

| Date (UTC) | Purpose | Amount | Target | Tx hash | Result | Explorer |
|---|---|---|---|---|---|---|
| 2026-08-16 11:01 | first STRK20 shield (M3) — employer (Ready X) funded demo balance | 6 STRK | pool entry-point `0x1270…584f` → pool `0x4033…812a` | `0x2099783559…a02a0b072` | SUCCEEDED · ACCEPTED_ON_L1 · block 13380900 · fee 3.23 STRK | https://voyager.online/tx/0x20997835598931e114150b22f87a6cf1de5a60cb67a48b435d0a5aa02a0b072 |
| 2026-08-16 11:01 | recipient-wallet registration shield (spare wallet, not in DEMO_RECIPIENTS) | 6 STRK | pool entry-point `0x1270…584f` → pool `0x4033…812a` | `0x647a43dd2f…816db29de` | SUCCEEDED · ACCEPTED_ON_L1 · block 13380918 · fee 3.48 STRK | https://voyager.online/tx/0x647a43dd2f7baab32889110d4b86d66a596fa5fb91982910585e20816db29de |
| 2026-08-18 09:23 | recipient-wallet registration shield (spare wallet, not in DEMO_RECIPIENTS) | 6 STRK | pool entry-point `0x1270…584f` → pool `0x4033…812a` | `0x80020f3165…be30b354a` | SUCCEEDED · ACCEPTED_ON_L1 · block 13480525 · fee 3.21 STRK | https://voyager.online/tx/0x80020f3165c2b1ea9c366b31586f059751ea28b457bc4c87ac2fcbe30b354a |
| 2026-08-18 09:28 | recipient-wallet registration shield (spare wallet, not in DEMO_RECIPIENTS) | 6 STRK | pool entry-point `0x1270…584f` → pool `0x4033…812a` | `0x73eb51f162…f0c97da15` | SUCCEEDED · ACCEPTED_ON_L1 · block 13480700 · fee 3.24 STRK | https://voyager.online/tx/0x73eb51f162313ff35c6d0d6b9b66acf32dc1f1958820504ece98d7f0c97da15 |
| _pending_ | first private transfer (M4) | 0.001 STRK | employer self (Demo Mode) | _pending_ | _pending_ | https://voyager.online/tx/... |
| _pending_ | first private payroll batch (M6) | 3 × 0.001 STRK | employer self (Demo Mode) | _pending_ | _pending_ | https://voyager.online/tx/... |

Add rows for retries, unshield, and each subsequent payroll batch.

## Amount policy

- Shield: **0.01 STRK** per operation (enough to cover a few payrolls before re-shielding).
- Private transfer / payroll: **0.001 STRK** per recipient.
- These values are hardcoded in `src/app/components/client/WalletHandle/WalletAccountV6Tag.tsx`
  (`SHIELD_DEMO_AMOUNT`, `TRANSFER_DEMO_AMOUNT`, `ECHO_DEMO_AMOUNT`) and in
  `src/lib/demo/generator.ts` (`SAFE_EXECUTION_AMOUNT`).
- If the pool rejects for a documented minimum-amount reason, scale up in
  the source constants only — do not paste raw amounts into the wallet.

## Never in this file

- Private keys, seed phrases, mnemonics.
- Viewing keys, session tokens, RPC secrets.
- Anything from `.env.local`.
