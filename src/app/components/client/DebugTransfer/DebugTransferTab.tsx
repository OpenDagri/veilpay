"use client";

// Debug Transfer — the smallest possible A → B private transfer, fully
// instrumented. Bypasses the demo generator and the payroll executor.
// Purpose: prove one 0.001 STRK STRK20 private transfer from the connected
// wallet to a *different* pre-registered wallet on Starknet Mainnet, with
// enough visible evidence (intent, wallet return verbatim, receipt) that a
// stale UI can never fake a "complete" state.

import { useMemo, useState } from "react";
import { num, validateAndParseAddress } from "starknet";
import type { WALLET_API } from "@starknet-io/types-js";
import styles from "../../../uni.module.css";
import * as constants from "@/utils/constants";
import { useStoreWallet } from "../../Wallet/walletContext";
import { useFrontendProvider } from "../provider/providerContext";
import {
  STRK_MAINNET_TOKEN,
  isMainnetChainId,
  sameAddress,
} from "@/lib/starknet/networks";

const TOKEN = constants.addrSTRK;
const TOKEN_VERIFIED_MAINNET = sameAddress(TOKEN, STRK_MAINNET_TOKEN);

// Fixed at 0.001 STRK. Any UI-level input change would defeat the
// "smallest known-safe" contract of this diagnostic path.
const TRANSFER_AMOUNT: bigint = 10n ** 15n;

function fmtStrkBaseUnits(amount: bigint): string {
  const whole = amount / 10n ** 18n;
  const frac = (amount % 10n ** 18n)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

function shortHex(h: string): string {
  const hex = num.toHex(h);
  return hex.length <= 13 ? hex : `${hex.slice(0, 7)}...${hex.slice(-4)}`;
}

// A wallet-returned transaction hash must be 0x-prefixed hex of a length
// consistent with a Starknet tx hash. Rejecting anything else is what
// stops "no exception === success" from becoming a false positive.
function isValidTxHash(v: unknown): v is string {
  return typeof v === "string" && /^0x[0-9a-fA-F]{60,66}$/.test(v);
}

type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "submitted"; txHash: string; walletReturn: unknown }
  | { kind: "confirming"; txHash: string; walletReturn: unknown }
  | {
      kind: "confirmed";
      txHash: string;
      walletReturn: unknown;
      receipt: unknown;
      executionStatus: string;
      finalityStatus?: string;
      blockNumber?: number;
      feeStrk: string;
    }
  | {
      kind: "reverted";
      txHash: string;
      walletReturn: unknown;
      receipt: unknown;
      executionStatus: string;
    }
  | {
      kind: "invalid_return";
      walletReturn: unknown;
      message: string;
    }
  | { kind: "error"; message: string; walletReturn?: unknown };

export default function DebugTransferTab() {
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);
  const connectedAddress = useStoreWallet((s) => s.address);
  const isConnected = useStoreWallet((s) => s.isConnected);
  const chainId = useStoreWallet((s) => s.chain);
  const myFrontendProviderIndex = useFrontendProvider(
    (s) => s.currentFrontendProviderIndex
  );
  const networkName = constants.Strk20Networks[myFrontendProviderIndex];
  const isStrk20Network = networkName !== undefined;
  const chainVerifiedMainnet = isMainnetChainId(chainId);

  const [recipient, setRecipient] = useState<string>("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  // Parse + validate the recipient address at every render. Self-transfer is
  // allowed here as a diagnostic fallback: Ready X's current build does not
  // expose the machinery to open a channel to an arbitrary registered
  // recipient (returns "Missing channel context"), so the only known-working
  // STRK20 private-transfer path is sender == recipient (self-channel, which
  // the docs describe as "a deposit is a channel from yourself to yourself").
  // The UI still flags this so the operator never confuses it with A → B.
  const parsedRecipient = useMemo(() => {
    const raw = recipient.trim();
    if (!raw) return { ok: false as const, reason: "empty" };
    try {
      const parsed = validateAndParseAddress(raw);
      if (sameAddress(parsed, "0x0")) {
        return { ok: false as const, reason: "recipient is 0x0" };
      }
      const isSelf =
        !!connectedAddress && sameAddress(parsed, connectedAddress);
      return { ok: true as const, address: parsed, isSelf };
    } catch {
      return { ok: false as const, reason: "not a valid Starknet address" };
    }
  }, [recipient, connectedAddress]);

  const actionsPreview: WALLET_API.STRK20_ACTION[] | null = parsedRecipient.ok
    ? [
        {
          type: "transfer",
          token: TOKEN,
          amount: num.toHex(TRANSFER_AMOUNT),
          recipient: parsedRecipient.address,
        },
      ]
    : null;

  const canSubmit =
    isConnected &&
    isStrk20Network &&
    chainVerifiedMainnet &&
    TOKEN_VERIFIED_MAINNET &&
    parsedRecipient.ok &&
    !!myWalletAccount &&
    phase.kind !== "submitting" &&
    phase.kind !== "submitted" &&
    phase.kind !== "confirming";

  const handleReset = () => setPhase({ kind: "idle" });

  const handleSubmit = async () => {
    if (!canSubmit || !actionsPreview || !myWalletAccount) return;
    // Belt + braces mainnet re-check at the moment of the wallet call.
    if (!chainVerifiedMainnet || !TOKEN_VERIFIED_MAINNET) return;
    // Clear absolutely everything before invoking the wallet: no stale hash,
    // no stale receipt, no stale error.
    setPhase({ kind: "submitting" });

    let walletReturn: unknown;
    try {
      walletReturn = await myWalletAccount.strk20InvokeTransaction(actionsPreview);
    } catch (err: unknown) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    // Hard-validate the shape. No exception is NOT proof of success —
    // Ready X must return a plausible tx hash before we accept anything.
    const rec = walletReturn as { transaction_hash?: unknown } | undefined;
    const txHash = rec?.transaction_hash;
    if (!isValidTxHash(txHash)) {
      setPhase({
        kind: "invalid_return",
        walletReturn,
        message: `Wallet returned no valid transaction hash. Refusing to mark as submitted.`,
      });
      return;
    }

    setPhase({ kind: "submitted", txHash, walletReturn });

    // Wait for the receipt via the frontend RPC provider (not the
    // wallet-connected provider, which is fixed at connect-time).
    const provider = constants.myFrontendProviders[myFrontendProviderIndex];
    setPhase({ kind: "confirming", txHash, walletReturn });

    let receiptRaw: unknown;
    try {
      receiptRaw = await provider.waitForTransaction(txHash, {
        retries: 400,
        retryInterval: 3000,
      });
    } catch (err: unknown) {
      setPhase({
        kind: "error",
        message: `waitForTransaction failed: ${err instanceof Error ? err.message : String(err)}`,
        walletReturn,
      });
      return;
    }

    const raw =
      (receiptRaw as { value?: unknown } | undefined)?.value ?? receiptRaw;
    const rr = raw as
      | {
          execution_status?: string;
          finality_status?: string;
          block_number?: number;
          actual_fee?: { amount?: string } | string;
        }
      | undefined;
    const execStatus = String(rr?.execution_status ?? "");
    const finalityStatus = rr?.finality_status;
    const blockNumber = rr?.block_number;
    let feeStrk = "?";
    try {
      const feeRaw = typeof rr?.actual_fee === "string" ? rr.actual_fee : rr?.actual_fee?.amount;
      if (feeRaw !== undefined) {
        feeStrk = `${fmtStrkBaseUnits(num.toBigInt(feeRaw))} STRK`;
      }
    } catch {
      /* keep "?" */
    }

    if (execStatus === "REVERTED") {
      setPhase({
        kind: "reverted",
        txHash,
        walletReturn,
        receipt: raw,
        executionStatus: execStatus,
      });
      return;
    }
    if (execStatus !== "SUCCEEDED") {
      setPhase({
        kind: "error",
        message: `Unexpected execution_status: "${execStatus}". Refusing to mark as confirmed.`,
        walletReturn,
      });
      return;
    }

    setPhase({
      kind: "confirmed",
      txHash,
      walletReturn,
      receipt: raw,
      executionStatus: execStatus,
      finalityStatus,
      blockNumber,
      feeStrk,
    });
  };

  const explorerTxUrl = (h: string) =>
    myFrontendProviderIndex === 0
      ? `https://voyager.online/tx/${h}`
      : `https://sepolia.voyager.online/tx/${h}`;

  const jsonSafe = (v: unknown) => {
    try {
      return JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val), 2);
    } catch {
      return String(v);
    }
  };

  return (
    <div>
      <div className={styles.inputBlock}>
        <div className={styles.inputLabel}>Debug transfer — one A → B private transfer</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
          Bypasses the demo generator and payroll batching. Sends a single
          STRK20 <code>transfer</code> action of <b>0.001 STRK</b> from the
          connected wallet to a different pre-registered recipient. Every
          Wallet API call and return value is displayed verbatim.
        </div>
      </div>

      <div className={styles.inputBlock} style={{ marginTop: 12 }}>
        <div className={styles.inputLabel}>1. Sender (connected wallet)</div>
        <div style={{ fontFamily: "var(--font-mono-ui)", fontSize: 13, marginTop: 6, wordBreak: "break-all" }}>
          {connectedAddress || <span style={{ opacity: 0.6 }}>— not connected —</span>}
        </div>
      </div>

      <div className={styles.inputBlock} style={{ marginTop: 12 }}>
        <div className={styles.inputLabel}>2. Recipient (must be a different pre-registered wallet)</div>
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x…"
          spellCheck={false}
          style={{
            width: "100%",
            marginTop: 6,
            padding: "8px 10px",
            border: "1px solid var(--line)",
            borderRadius: 8,
            fontFamily: "var(--font-mono-ui), monospace",
            fontSize: 13,
          }}
        />
        {recipient.trim() && !parsedRecipient.ok && (
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--danger)" }}>
            Invalid recipient: {parsedRecipient.reason}
          </div>
        )}
        {parsedRecipient.ok && (
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            parsed: <code>{parsedRecipient.address}</code>
          </div>
        )}
        {parsedRecipient.ok && parsedRecipient.isSelf && (
          <div
            className={styles.warn}
            style={{ marginTop: 8, fontSize: 12 }}
          >
            <b>Self-transfer path:</b> recipient equals sender. This exercises
            the self-channel (opened at your first shield) and is the only
            STRK20 private-transfer flow Ready X currently supports in this
            build. It is NOT evidence of an A → B transfer to a different
            wallet.
          </div>
        )}
      </div>

      <div className={styles.inputBlock} style={{ marginTop: 12 }}>
        <div className={styles.inputLabel}>3. Amount</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>
          {fmtStrkBaseUnits(TRANSFER_AMOUNT)} STRK ·{" "}
          <span style={{ opacity: 0.65 }}>
            base units: {TRANSFER_AMOUNT.toString()} · hex: {num.toHex(TRANSFER_AMOUNT)}
          </span>
        </div>
      </div>

      <div className={styles.inputBlock} style={{ marginTop: 12 }}>
        <div className={styles.inputLabel}>4. Wallet API method + action array</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>
          <b>Method:</b>{" "}
          <code>WalletAccountV6.strk20InvokeTransaction</code> →{" "}
          <code>wallet_strk20InvokeTransaction</code>
        </div>
        <pre
          style={{
            marginTop: 8,
            padding: 10,
            border: "1px solid var(--line)",
            borderRadius: 8,
            fontFamily: "var(--font-mono-ui)",
            fontSize: 12,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            overflowX: "auto",
          }}
        >
{actionsPreview ? jsonSafe(actionsPreview) : "// fill in a valid recipient first"}
        </pre>
      </div>

      {/* Guardrail summary before we let the button fire */}
      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <VerifyBadge ok={isConnected} label={isConnected ? "Wallet connected" : "Wallet not connected"} />
        <VerifyBadge ok={isStrk20Network} label={isStrk20Network ? `Network: ${networkName}` : "Wrong network"} />
        <VerifyBadge
          ok={chainVerifiedMainnet}
          label={chainVerifiedMainnet ? "Chain verified: Mainnet" : `Wrong chain: ${chainId || "?"}`}
        />
        <VerifyBadge
          ok={TOKEN_VERIFIED_MAINNET}
          label={TOKEN_VERIFIED_MAINNET ? "Token verified: STRK" : "UNVERIFIED token"}
        />
        <VerifyBadge ok={parsedRecipient.ok} label={parsedRecipient.ok ? "Recipient valid" : "Recipient invalid"} />
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          className={styles.btnCta}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {phase.kind === "submitting"
            ? "Signing…"
            : phase.kind === "submitted" || phase.kind === "confirming"
            ? "Waiting on-chain…"
            : "Send private transfer"}
        </button>
        {(phase.kind !== "idle" && phase.kind !== "submitting" && phase.kind !== "submitted" && phase.kind !== "confirming") && (
          <button className={styles.btn} onClick={handleReset}>
            Clear result
          </button>
        )}
      </div>

      {/* Live phase readout */}
      <div style={{ marginTop: 16 }}>
        <PhaseCard phase={phase} explorerTxUrl={explorerTxUrl} jsonSafe={jsonSafe} />
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.65 }}>
        Independent verification: after a hash appears, open the Voyager
        link, confirm the tx is classified as a STRK20 private-transfer
        (approve + entrypoint call, no ERC20 <code>Transfer(6 STRK)</code>{" "}
        event), then connect the recipient wallet and check its private
        balance changed by <b>+0.001 STRK</b>.
      </div>
    </div>
  );
}

function PhaseCard({
  phase,
  explorerTxUrl,
  jsonSafe,
}: {
  phase: Phase;
  explorerTxUrl: (h: string) => string;
  jsonSafe: (v: unknown) => string;
}) {
  if (phase.kind === "idle") return null;
  const isFail =
    phase.kind === "error" ||
    phase.kind === "invalid_return" ||
    phase.kind === "reverted";
  const isDone = phase.kind === "confirmed";
  return (
    <div
      className={`${styles.receipt} ${
        isFail ? styles.receiptError : isDone ? styles.receiptOk : styles.receiptPending
      }`}
    >
      <div className={styles.receiptHead}>
        <span className={styles.receiptIcon}>
          {isDone ? "✓" : isFail ? "!" : "⋯"}
        </span>
        <span>
          {phase.kind === "submitting" && "Awaiting wallet signature…"}
          {phase.kind === "submitted" && "Submitted — waiting for confirmation…"}
          {phase.kind === "confirming" && "Waiting for on-chain confirmation…"}
          {phase.kind === "confirmed" && "Private transfer confirmed on-chain"}
          {phase.kind === "reverted" && "Transaction reverted on-chain"}
          {phase.kind === "invalid_return" && "Wallet returned an invalid result"}
          {phase.kind === "error" && "Execution error"}
        </span>
      </div>
      <div className={styles.receiptRows}>
        {"txHash" in phase && phase.txHash && (
          <div className={styles.receiptRow}>
            <span className={styles.receiptLabel}>Transaction</span>
            <a
              className={styles.receiptLink}
              href={explorerTxUrl(phase.txHash)}
              target="_blank"
              rel="noreferrer"
            >
              {phase.txHash} ↗
            </a>
          </div>
        )}
        {phase.kind === "confirmed" && (
          <>
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>execution_status</span>
              <span className={styles.receiptValue}>{phase.executionStatus}</span>
            </div>
            {phase.finalityStatus && (
              <div className={styles.receiptRow}>
                <span className={styles.receiptLabel}>finality_status</span>
                <span className={styles.receiptValue}>{phase.finalityStatus}</span>
              </div>
            )}
            {phase.blockNumber !== undefined && (
              <div className={styles.receiptRow}>
                <span className={styles.receiptLabel}>block_number</span>
                <span className={styles.receiptValue}>{phase.blockNumber}</span>
              </div>
            )}
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>actual_fee</span>
              <span className={styles.receiptValue}>{phase.feeStrk}</span>
            </div>
          </>
        )}
        {phase.kind === "reverted" && (
          <div className={styles.receiptRow}>
            <span className={styles.receiptLabel}>execution_status</span>
            <span className={styles.receiptValue}>{phase.executionStatus}</span>
          </div>
        )}
      </div>
      {"message" in phase && phase.message && (
        <pre className={styles.receiptNote}>{phase.message}</pre>
      )}
      {"walletReturn" in phase && phase.walletReturn !== undefined && (
        <div style={{ padding: "0 12px 12px" }}>
          <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 4 }}>Wallet return (verbatim):</div>
          <pre
            style={{
              margin: 0,
              padding: 8,
              border: "1px solid var(--line)",
              borderRadius: 6,
              fontFamily: "var(--font-mono-ui)",
              fontSize: 11,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              overflowX: "auto",
            }}
          >
            {jsonSafe(phase.walletReturn)}
          </pre>
        </div>
      )}
      {"receipt" in phase && phase.receipt !== undefined && (
        <div style={{ padding: "0 12px 12px" }}>
          <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 4 }}>Receipt (raw):</div>
          <pre
            style={{
              margin: 0,
              padding: 8,
              border: "1px solid var(--line)",
              borderRadius: 6,
              fontFamily: "var(--font-mono-ui)",
              fontSize: 11,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              overflowX: "auto",
              maxHeight: 240,
            }}
          >
            {jsonSafe(phase.receipt)}
          </pre>
        </div>
      )}
    </div>
  );
}

function VerifyBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        border: `1px solid ${ok ? "var(--green)" : "var(--danger)"}`,
        color: ok ? "var(--green)" : "var(--danger)",
        background: ok ? "var(--green-soft)" : "#fdecec",
      }}
    >
      <span aria-hidden>{ok ? "✓" : "✗"}</span>
      {label}
    </span>
  );
}
