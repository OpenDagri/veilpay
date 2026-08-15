"use client";

import { useMemo, useState } from "react";
import { num } from "starknet";
import styles from "../../../uni.module.css";
import * as constants from "@/utils/constants";
import { useStoreWallet } from "../../Wallet/walletContext";
import { useFrontendProvider } from "../provider/providerContext";
import { generatePayroll } from "@/lib/demo/generator";
import { DEFAULT_DEMO_SEED } from "@/lib/demo/rng";
import { DEMO_RECIPIENTS } from "@/lib/demo/recipients";
import { executePayroll } from "@/lib/payroll/executor";
import { sumExecutionAmount } from "@/lib/payroll/types";
import type { Payroll } from "@/lib/payroll/types";
import {
  STRK_MAINNET_TOKEN,
  isMainnetChainId,
  sameAddress,
} from "@/lib/starknet/networks";

const TOKEN = constants.addrSTRK;
const TOKEN_VERIFIED_MAINNET = sameAddress(TOKEN, STRK_MAINNET_TOKEN);

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

type PreflightState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; shielded: bigint; required: bigint }
  | { kind: "insufficient"; shielded: bigint; required: bigint }
  | { kind: "error"; message: string };

export default function PayrollTab() {
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

  const [seed, setSeed] = useState<string>(DEFAULT_DEMO_SEED);
  const [count, setCount] = useState<number>(3);
  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [preflight, setPreflight] = useState<PreflightState>({ kind: "idle" });
  const [confirming, setConfirming] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  const totalExecution = useMemo(
    () => (payroll ? sumExecutionAmount(payroll.recipients) : 0n),
    [payroll]
  );

  const missingAddresses =
    payroll?.recipients.filter((r) => !r.address).length ?? 0;
  const canRequestExecute =
    isConnected &&
    isStrk20Network &&
    chainVerifiedMainnet &&
    TOKEN_VERIFIED_MAINNET &&
    payroll !== null &&
    payroll.status === "ready" &&
    missingAddresses === 0 &&
    preflight.kind === "ok" &&
    !busy &&
    !confirming;

  const handleGenerate = () => {
    setPreflight({ kind: "idle" });
    setConfirming(false);
    setPayroll(generatePayroll({ seed, recipientCount: count }));
  };

  const handleGenerateAnother = () => {
    const newSeed = `${seed}-${Math.random().toString(36).slice(2, 8)}`;
    setSeed(newSeed);
    setPreflight({ kind: "idle" });
    setConfirming(false);
    setPayroll(generatePayroll({ seed: newSeed, recipientCount: count }));
  };

  const handlePreflight = async () => {
    if (!myWalletAccount || !payroll) return;
    setPreflight({ kind: "checking" });
    try {
      const raw = await myWalletAccount.strk20Balances([TOKEN]);
      const arr = readBalanceArray(raw);
      const strkKey = BigInt(TOKEN);
      const entry = arr.find((b) => {
        try {
          return BigInt(b.token) === strkKey;
        } catch {
          return false;
        }
      });
      const shielded = entry ? BigInt(entry.amount) : 0n;
      const required = sumExecutionAmount(payroll.recipients);
      setPreflight(
        shielded >= required
          ? { kind: "ok", shielded, required }
          : { kind: "insufficient", shielded, required }
      );
    } catch (err: unknown) {
      setPreflight({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Two-step execute: first click opens the confirmation card; only the
  // second click ("Sign & submit") sends the transaction to the wallet.
  const handleRequestExecute = () => {
    if (!canRequestExecute) return;
    setConfirming(true);
  };

  const handleCancelConfirm = () => setConfirming(false);

  const handleSignAndSubmit = async () => {
    if (!myWalletAccount || !payroll) return;
    // Belt + braces: re-check chain right before the wallet call. The store
    // value may have gone stale since preflight; if the wallet is not on
    // mainnet at THIS moment, refuse.
    if (!chainVerifiedMainnet) return;
    if (!TOKEN_VERIFIED_MAINNET) return;
    setConfirming(false);
    setBusy(true);
    const provider = constants.myFrontendProviders[myFrontendProviderIndex];
    try {
      await executePayroll(payroll, {
        wallet: myWalletAccount,
        provider,
        tokenAddress: TOKEN,
        currentChainId: chainId,
        onUpdate: (p) => setPayroll(p),
      });
    } catch {
      // executor already updated payroll.status via onUpdate; swallow to avoid an
      // unhandled rejection in the UI. The recipient rows carry the error state.
    } finally {
      setBusy(false);
    }
  };

  const explorerTxUrl = (h: string) =>
    myFrontendProviderIndex === 0
      ? `https://voyager.online/tx/${h}`
      : `https://sepolia.voyager.online/tx/${h}`;

  return (
    <div>
      {/* Generate controls */}
      <div className={styles.inputBlock}>
        <div className={styles.inputLabel}>Demo payroll</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", fontSize: 12 }}>
            <span style={{ opacity: 0.65 }}>Seed</span>
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              style={{
                padding: "8px 10px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                fontFamily: "var(--font-mono-ui), monospace",
                fontSize: 13,
                minWidth: 220,
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", fontSize: 12 }}>
            <span style={{ opacity: 0.65 }}>Recipients</span>
            <input
              type="number"
              min={1}
              max={12}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
              style={{
                padding: "8px 10px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                width: 80,
                fontSize: 13,
              }}
            />
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className={styles.btn} onClick={handleGenerate} disabled={busy}>
              Generate
            </button>
            {payroll && (
              <button className={styles.btn} onClick={handleGenerateAnother} disabled={busy}>
                Generate another
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recipient list */}
      {payroll && (
        <div className={styles.receipt} style={{ marginTop: 16 }}>
          <div className={styles.receiptHead}>
            <span>{payroll.label}</span>
            <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
              {payroll.recipients.length} recipient{payroll.recipients.length === 1 ? "" : "s"}
              {" · "}
              {fmtStrkBaseUnits(totalExecution)} STRK total
            </span>
          </div>
          <div className={styles.receiptRows}>
            {payroll.recipients.map((r) => (
              <div key={r.id} className={styles.receiptRow}>
                <span className={styles.receiptLabel}>
                  <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <StatusDot status={r.status} />
                    {r.displayName}
                    <span style={{ opacity: 0.5, fontSize: 11 }}>
                      {r.address ? shortHex(r.address) : "no address"}
                    </span>
                  </span>
                </span>
                <span className={styles.receiptValue} style={{ display: "flex", gap: 12 }}>
                  <span style={{ opacity: 0.55 }}>{r.displayAmount}</span>
                  <span>{fmtStrkBaseUnits(r.executionAmount)} STRK</span>
                  {r.txHash && (
                    <a
                      className={styles.receiptLink}
                      href={explorerTxUrl(r.txHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortHex(r.txHash)} ↗
                    </a>
                  )}
                </span>
              </div>
            ))}
          </div>
          {payroll.status === "executing" && (
            <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>
              Waiting on the wallet / on-chain confirmation. This can take
              minutes because privacy-pool txs verify a STARK proof.
            </div>
          )}
        </div>
      )}

      {/* Display vs execution disclosure */}
      {payroll && (
        <div className={styles.warn} style={{ marginTop: 12 }}>
          Display amounts are fictional labels. The real STRK transfer per
          recipient is <b>{fmtStrkBaseUnits(payroll.recipients[0]?.executionAmount ?? 0n)} STRK</b>
          {" "}(safe demo mode).
        </div>
      )}

      {/* Missing addresses */}
      {payroll && missingAddresses > 0 && (
        <div className={styles.warn} style={{ marginTop: 12 }}>
          {missingAddresses} recipient{missingAddresses === 1 ? "" : "s"} without an address.
          Populate <code>DEMO_RECIPIENTS</code> in{" "}
          <code>src/lib/demo/recipients.ts</code> with pre-registered Sepolia
          wallets, then click Generate again.
          {" "}
          <span style={{ opacity: 0.7 }}>
            (DEMO_RECIPIENTS currently has {DEMO_RECIPIENTS.length} entries.)
          </span>
        </div>
      )}

      {/* Chain + token verification badges (mainnet-only demo) */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <VerifyBadge
          ok={chainVerifiedMainnet}
          label={
            chainVerifiedMainnet
              ? "Chain verified: Starknet Mainnet"
              : `Wrong chain: ${chainId || "not connected"} — must be Starknet Mainnet`
          }
        />
        <VerifyBadge
          ok={TOKEN_VERIFIED_MAINNET}
          label={
            TOKEN_VERIFIED_MAINNET
              ? `Token verified: STRK — ${shortHex(TOKEN)}`
              : `UNVERIFIED token: ${shortHex(TOKEN)}`
          }
        />
      </div>

      {/* Network gate */}
      {!isStrk20Network && (
        <div className={styles.warn} style={{ marginTop: 12 }}>
          STRK20 actions require Mainnet — switch your wallet network to
          Starknet Mainnet.
        </div>
      )}

      {/* Preflight */}
      {payroll && payroll.status === "ready" && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button
            className={styles.btn}
            onClick={handlePreflight}
            disabled={!isConnected || !isStrk20Network || preflight.kind === "checking" || busy}
          >
            {preflight.kind === "checking" ? "Checking balance…" : "Preflight: check shielded balance"}
          </button>
        </div>
      )}
      {preflight.kind === "ok" && (
        <div className={styles.verdict + " " + styles.verdictPass} style={{ marginTop: 12 }}>
          <div className={styles.verdictHead}>
            <span>✅</span>
            Shielded balance covers payroll
          </div>
          <div className={styles.verdictRow}>
            <b>shielded:</b> <span>{fmtStrkBaseUnits(preflight.shielded)} STRK</span>
          </div>
          <div className={styles.verdictRow}>
            <b>required:</b> <span>{fmtStrkBaseUnits(preflight.required)} STRK</span>
          </div>
        </div>
      )}
      {preflight.kind === "insufficient" && (
        <div className={styles.verdict + " " + styles.verdictFail} style={{ marginTop: 12 }}>
          <div className={styles.verdictHead}>
            <span>❌</span>
            Insufficient shielded balance
          </div>
          <div className={styles.verdictRow}>
            <b>shielded:</b> <span>{fmtStrkBaseUnits(preflight.shielded)} STRK</span>
          </div>
          <div className={styles.verdictRow}>
            <b>required:</b> <span>{fmtStrkBaseUnits(preflight.required)} STRK</span>
          </div>
          <div className={styles.verdictRow} style={{ opacity: 0.75 }}>
            Shield more STRK from the Shield tab first, then re-run preflight.
          </div>
        </div>
      )}
      {preflight.kind === "error" && (
        <div className={styles.verdict + " " + styles.verdictFail} style={{ marginTop: 12 }}>
          <div className={styles.verdictHead}>
            <span>!</span>Preflight error
          </div>
          <div className={styles.verdictRow}>{preflight.message}</div>
        </div>
      )}

      {/* Confirmation card (shown between Execute click and wallet call) */}
      {confirming && payroll && (
        <div
          className={styles.receipt}
          style={{ marginTop: 16, borderColor: "var(--pink)" }}
        >
          <div className={styles.receiptHead}>
            <span>Confirm private payroll</span>
          </div>
          <div className={styles.receiptRows}>
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>Chain</span>
              <span className={styles.receiptValue}>
                Starknet Mainnet <span style={{ color: "var(--green)" }}>✓</span>
              </span>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>Token</span>
              <span className={styles.receiptValue}>
                STRK · <span style={{ fontFamily: "var(--font-mono-ui)" }}>{TOKEN}</span>{" "}
                <span style={{ color: "var(--green)" }}>✓</span>
              </span>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>Employer</span>
              <span className={styles.receiptValue}>
                <span style={{ fontFamily: "var(--font-mono-ui)" }}>
                  {connectedAddress ?? "—"}
                </span>
              </span>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>Total execution</span>
              <span className={styles.receiptValue}>
                <b>{fmtStrkBaseUnits(totalExecution)} STRK</b>
              </span>
            </div>
          </div>
          <div style={{ padding: "8px 12px 0" }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
              {payroll.recipients.length} private transfer{payroll.recipients.length === 1 ? "" : "s"}, one batched transaction:
            </div>
            {payroll.recipients.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  fontSize: 12,
                  padding: "3px 0",
                }}
              >
                <span style={{ opacity: 0.6 }}>{r.displayName}</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono-ui)",
                    opacity: 0.85,
                    flex: 1,
                    textAlign: "center",
                  }}
                >
                  → {r.address}
                </span>
                <span>{fmtStrkBaseUnits(r.executionAmount)} STRK</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, padding: 12 }}>
            <button
              className={styles.btn}
              onClick={handleCancelConfirm}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className={styles.btnCta}
              style={{ flex: 1 }}
              onClick={handleSignAndSubmit}
              disabled={busy || !chainVerifiedMainnet || !TOKEN_VERIFIED_MAINNET}
            >
              {busy ? "Signing…" : "Sign & submit"}
            </button>
          </div>
          <div
            className={styles.warn}
            style={{ margin: "0 12px 12px", fontSize: 12 }}
          >
            This will pop Ready wallet on Starknet Mainnet and move a total of{" "}
            <b>{fmtStrkBaseUnits(totalExecution)} STRK</b> from your shielded balance.
          </div>
        </div>
      )}

      {/* Execute (initial request) */}
      {!confirming && (
        <div style={{ marginTop: 16 }}>
          <button
            className={styles.btnCta}
            disabled={!canRequestExecute}
            onClick={handleRequestExecute}
          >
            {busy
              ? "Executing…"
              : payroll?.status === "completed"
              ? "Payroll complete"
              : payroll?.status === "failed"
              ? "Payroll failed — generate another to retry"
              : "Execute privately"}
          </button>
        </div>
      )}

      {/* Final status */}
      {payroll?.status === "completed" && (
        <div className={styles.verdict + " " + styles.verdictPass} style={{ marginTop: 12 }}>
          <div className={styles.verdictHead}>
            <span>✅</span>
            {payroll.recipients.length} private payments executed
          </div>
        </div>
      )}
      {payroll?.status === "failed" && (
        <div className={styles.verdict + " " + styles.verdictFail} style={{ marginTop: 12 }}>
          <div className={styles.verdictHead}>
            <span>❌</span>
            Payroll failed
          </div>
          {payroll.recipients[0]?.error && (
            <div className={styles.verdictRow} style={{ opacity: 0.85 }}>
              {payroll.recipients[0].error}
            </div>
          )}
        </div>
      )}

      {/* Connected-account hint */}
      {isConnected && connectedAddress && (
        <div style={{ marginTop: 16, opacity: 0.5, fontSize: 11, textAlign: "right" }}>
          employer: {shortHex(connectedAddress)}
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

function StatusDot({ status }: { status: string }) {
  const color =
    status === "confirmed" ? "#0e9f6e"
      : status === "submitted" ? "#e56b43"
      : status === "awaiting_wallet" ? "#e56b43"
      : status === "failed" ? "#e5484d"
      : "#c0c0c8";
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
      }}
    />
  );
}

type BalanceEntry = { token: string; amount: string };
function readBalanceArray(raw: unknown): BalanceEntry[] {
  const v = (raw as { value?: unknown } | undefined)?.value ?? raw;
  if (!Array.isArray(v)) return [];
  return v
    .map((b: unknown) => {
      const rec = b as Record<string, unknown>;
      const token =
        (rec.token as string | undefined) ??
        (rec.token_address as string | undefined) ??
        (Array.isArray(b) ? (b as unknown[])[0] : undefined);
      const amount =
        (rec.amount as string | undefined) ??
        (rec.balance as string | undefined) ??
        (Array.isArray(b) ? (b as unknown[])[1] : undefined);
      if (token === undefined || amount === undefined) return null;
      return {
        token: String(token),
        amount: String(amount),
      };
    })
    .filter((x): x is BalanceEntry => x !== null);
}
