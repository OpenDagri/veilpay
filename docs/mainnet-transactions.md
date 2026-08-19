# Mainnet transactions

Every real Starknet Mainnet transaction VeilPay initiates lands here.
This file IS the hackathon submission evidence.

Wallet: **Ready X** on **Starknet Mainnet**.
Verified STRK token: `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d`.
Chain ID: `SN_MAIN` (`0x534e5f4d41494e`).

## Before every transaction (operator checklist)

The app enforces the first three via `src/lib/starknet/networks.ts`; the
remaining items are the operator's responsibility.

1. Wallet chain badge reads **"Chain verified: Starknet Mainnet"** (green).
2. Token badge reads **"Token verified: STRK — 0x0471…938d"** (green).
3. Payroll tab: the derived-preflight verdict reads **"Ready to execute"** (green)
   with `Private balance ≥ Payroll execution`. Debug transfer tab: all five
   header badges are green (Wallet connected · Network MAINNET · Chain verified ·
   Token verified · Recipient valid).
4. Read the Confirmation card end-to-end before clicking **Sign & submit**:
   employer address, per-recipient address, per-recipient amount, total.
5. Approve the wallet popup only after confirming the amount + recipient
   in Ready's own confirmation matches the app's Confirmation card.
6. Wait for on-chain confirmation. Copy the tx hash from the receipt card.
   The hardened executor / Debug transfer tab will only render "confirmed"
   after `execution_status === "SUCCEEDED"` — never on absence of exception.
7. Add a row to the table below with all fields filled.

Never approve a transaction if the app shows a red badge on chain or token,
or if the amount / recipient in Ready doesn't match the app.

## Ready X wallet limitation (2026-08-19 — worth documenting for the panel)

STRK20's protocol supports arbitrary A→B private transfers between any two
registered pool participants. Ready X's current build, however, does not
expose the machinery for a dapp to open a channel to an arbitrary recipient
it has never sent to before — every attempted A→B private transfer through
`wallet_strk20InvokeTransaction` returns:

```
Missing channel context for recipient 0x…
```

We verified this both via our dapp (Debug transfer tab) and via Ready X's own
Send UI (which offers *"send starknet or shielded starknet tokens"* but no
dedicated A→B private-transfer button). The strk20-by-example docs describe
`.build({ autoSetup: true })` on the Node SDK as the mechanism that opens the
channel + token-subchannel, but the Wallet API surface has no equivalent action
type and Ready X does not automate the fetch of the recipient's on-chain public
viewing key.

**Consequence for VeilPay's demo:** the only STRK20 private-transfer path
Ready X currently supports is **self-recipient** (the sender's self-channel,
opened by their own first shield). Per the STRK20 docs verbatim: *"A deposit
is just a channel from yourself to yourself."* We therefore ship self-recipient
Demo Mode as the hackathon demo path. This is a real STRK20 in-pool `transfer`
action, verifiable on-chain by the absence of an ERC20 `Transfer(user → pool)`
event in the tx receipt.

## Log

| Date (UTC) | Purpose | Amount | Target | Tx hash | Result | Explorer |
|---|---|---|---|---|---|---|
| 2026-08-16 11:01 | first STRK20 shield (M3) — employer (Ready X) funded demo balance | 6 STRK | pool entry-point `0x1270…584f` → pool `0x4033…812a` | `0x2099783559…a02a0b072` | SUCCEEDED · ACCEPTED_ON_L1 · block 13380900 · fee 3.23 STRK | https://voyager.online/tx/0x20997835598931e114150b22f87a6cf1de5a60cb67a48b435d0a5aa02a0b072 |
| 2026-08-16 11:01 | recipient-wallet registration shield (spare wallet, not in DEMO_RECIPIENTS) | 6 STRK | pool entry-point `0x1270…584f` → pool `0x4033…812a` | `0x647a43dd2f…816db29de` | SUCCEEDED · ACCEPTED_ON_L1 · block 13380918 · fee 3.48 STRK | https://voyager.online/tx/0x647a43dd2f7baab32889110d4b86d66a596fa5fb91982910585e20816db29de |
| 2026-08-18 09:23 | recipient-wallet registration shield (spare wallet, not in DEMO_RECIPIENTS) | 6 STRK | pool entry-point `0x1270…584f` → pool `0x4033…812a` | `0x80020f3165…be30b354a` | SUCCEEDED · ACCEPTED_ON_L1 · block 13480525 · fee 3.21 STRK | https://voyager.online/tx/0x80020f3165c2b1ea9c366b31586f059751ea28b457bc4c87ac2fcbe30b354a |
| 2026-08-18 09:28 | recipient-wallet registration shield (spare wallet, not in DEMO_RECIPIENTS) | 6 STRK | pool entry-point `0x1270…584f` → pool `0x4033…812a` | `0x73eb51f162…f0c97da15` | SUCCEEDED · ACCEPTED_ON_L1 · block 13480700 · fee 3.24 STRK | https://voyager.online/tx/0x73eb51f162313ff35c6d0d6b9b66acf32dc1f1958820504ece98d7f0c97da15 |
| 2026-08-18 | sender-wallet `0x0451…fe90` registration shield (sponsored via paymaster `0x1503…a9df`) | 0.01 STRK from user + 6 STRK from paymaster | pool entry-point `0x1270…584f` → pool `0x4033…812a` | `0xa5fae06427…7c9e551` | SUCCEEDED · ACCEPTED_ON_L2 · block 13506054 · fee 3.35 STRK (paid by paymaster) | https://voyager.online/tx/0xa5fae0642786a84cafb652dab512b8de068dd8d484de9b1c1960367c9e551 |
| 2026-08-19 14:33 | **M4 — first STRK20 private transfer (self-channel; see Ready X limitation below)** | 0.001 STRK | authorizing wallet = `0x0451…fe90`, recipient = self (self-channel) | `0x5e8793af6b…e2e8dcb78` | SUCCEEDED · ACCEPTED_ON_L2 · block 13542881 · fee 3.52 STRK (paid by paymaster `0x205f…eb7a`) · no ERC20 `Transfer(user → pool)` event → NOT a shield | https://voyager.online/tx/0x5e8793af6b9a84eee1a116012ecf8bb54c98742aa661ceb4ceb67ce2e8dcb78 |
| _pending_ | first private payroll batch (M6) | 3 × 0.001 STRK | authorizing wallet self (Demo Mode) | _pending_ | _pending_ | https://voyager.online/tx/... |

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
