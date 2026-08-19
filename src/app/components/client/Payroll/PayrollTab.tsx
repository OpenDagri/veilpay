"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

// The wallet-reported STRK private balance is the source of truth for
// whether a payroll can execute. Loading/error/zero are all distinct from
// "ready with 0 STRK" so the UI never claims the balance is zero while it
// is actually still being fetched.
type PrivateBalanceState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; amount: bigint }
  | { status: "error"; message: string };

type PayrollTabProps = {
  /** Ask the parent to switch to the Shield tab so the user can add
   *  private funds. Optional so the tab still renders in isolation. */
  onNavigateToShield?: () => void;
};

export default function PayrollTab({ onNavigateToShield }: PayrollTabProps = {}) {
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
  const [privateBalance, setPrivateBalance] = useState<PrivateBalanceState>({
    status: "idle",
  });
  const [confirming, setConfirming] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  // Self-recipient Demo Mode: every generated recipient's on-chain address is
  // the connected wallet. Names + display salaries stay fictional so judges
  // still see a realistic payroll UI. Default ON because no external
  // pre-registered addresses are needed — the connected wallet is registered
  // as soon as it has ever shielded. Users can flip it off to run a real
  // payroll against DEMO_RECIPIENTS.
  const [demoMode, setDemoMode] = useState<boolean>(true);

  const totalExecution = useMemo(
    () => (payroll ? sumExecutionAmount(payroll.recipients) : 0n),
    [payroll]
  );

  const missingAddresses =
    payroll?.recipients.filter((r) => !r.address).length ?? 0;

  const balanceReadable =
    isConnected &&
    isStrk20Network &&
    chainVerifiedMainnet &&
    TOKEN_VERIFIED_MAINNET &&
    !!myWalletAccount;

  const loadPrivateBalance = useCallback(async () => {
    if (!balanceReadable || !myWalletAccount) return;
    setPrivateBalance({ status: "loading" });
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
      const amount = entry ? BigInt(entry.amount) : 0n;
      setPrivateBalance({ status: "ready", amount });
    } catch (err: unknown) {
      setPrivateBalance({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [balanceReadable, myWalletAccount]);

  // Auto-load whenever the wallet + network preconditions become satisfied.
  // The dependency chain (isConnected/chainId/etc.) is baked into
  // `loadPrivateBalance` via useCallback, so a single effect on it is enough.
  useEffect(() => {
    if (balanceReadable) {
      loadPrivateBalance();
    } else {
      setPrivateBalance({ status: "idle" });
    }
  }, [balanceReadable, loadPrivateBalance]);

  // Derived preflight — never queries; always reflects the latest wallet-reported
  // balance vs the current payroll's required execution total.
  const requiredExecution = totalExecution;
  const executionCoveredByBalance =
    privateBalance.status === "ready" &&
    requiredExecution > 0n &&
    privateBalance.amount >= requiredExecution;
  const executionBlockedByBalance =
    privateBalance.status === "ready" &&
    requiredExecution > 0n &&
    privateBalance.amount < requiredExecution;

  const canRequestExecute =
    isConnected &&
    isStrk20Network &&
    chainVerifiedMainnet &&
    TOKEN_VERIFIED_MAINNET &&
    payroll !== null &&
    payroll.status === "ready" &&
    missingAddresses === 0 &&
    executionCoveredByBalance &&
    !busy &&
    !confirming;

  const selfRecipientForGenerate =
    demoMode && connectedAddress ? connectedAddress : undefined;

  const handleGenerate = () => {
    setConfirming(false);
    setPayroll(
      generatePayroll({
        seed,
        recipientCount: count,
        selfRecipient: selfRecipientForGenerate,
      })
    );
  };

  const handleGenerateAnother = () => {
    const newSeed = `${seed}-${Math.random().toString(36).slice(2, 8)}`;
    setSeed(newSeed);
    setConfirming(false);
    setPayroll(
      generatePayroll({
        seed: newSeed,
        recipientCount: count,
        selfRecipient: selfRecipientForGenerate,
      })
    );
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
    // Re-check the balance guard right before signing — the balance may have
    // been spent in another window since it was last loaded.
    if (!executionCoveredByBalance) return;
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
      // Post-execution balance is authoritative — always requery, even on
      // failure (a submitted-then-reverted tx should still refresh).
      loadPrivateBalance();
    }
  };

  const explorerTxUrl = (h: string) =>
    myFrontendProviderIndex === 0
      ? `https://voyager.online/tx/${h}`
      : `https://sepolia.voyager.online/tx/${h}`;

  return (
    <div>
      {/* Private balance card — top of tab, always visible once a wallet is connected */}
      <PrivateBalanceCard
        state={privateBalance}
        canRead={balanceReadable}
        isConnected={isConnected}
        chainVerifiedMainnet={chainVerifiedMainnet}
        tokenVerifiedMainnet={TOKEN_VERIFIED_MAINNET}
        isStrk20Network={isStrk20Network}
        onRefresh={loadPrivateBalance}
        onAddFunds={onNavigateToShield}
      />

      {/* Generate controls */}
      <div className={styles.inputBlock} style={{ marginTop: 12 }}>
        <div className={styles.inputLabel}>Demo payroll</div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "6px 0 10px",
            fontSize: 12,
          }}
        >
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
              disabled={busy}
            />
            <b>Demo Mode</b>
            <span style={{ opacity: 0.7 }}>
              — every recipient points at your connected wallet (0.001 STRK each,
              real private transfers, reproducible)
            </span>
          </label>
        </div>
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
            {demoMode && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 999,
                  border: "1px solid var(--line)",
                  opacity: 0.85,
                }}
                title="Every recipient is your connected wallet — real private STRK transfers, reproducible for judges."
              >
                DEMO MODE (self)
              </span>
            )}
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
          {" "}
          Turn <b>Demo Mode</b> on to route every recipient to your connected
          wallet, or populate <code>DEMO_RECIPIENTS</code> in{" "}
          <code>src/lib/demo/recipients.ts</code> with Starknet Mainnet
          addresses already registered in the STRK20 privacy pool, then click
          Generate again.{" "}
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

      {/* Derived preflight readout — no button, always in sync with balance state */}
      {payroll && payroll.status === "ready" && (
        <PreflightReadout
          balance={privateBalance}
          required={requiredExecution}
          onRefresh={loadPrivateBalance}
          onAddFunds={onNavigateToShield}
        />
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
              disabled={busy || !chainVerifiedMainnet || !TOKEN_VERIFIED_MAINNET || !executionCoveredByBalance}
            >
              {busy ? "Signing…" : "Sign & submit"}
            </button>
          </div>
          <div
            className={styles.warn}
            style={{ margin: "0 12px 12px", fontSize: 12 }}
          >
            This will pop Ready wallet on Starknet Mainnet and move a total of{" "}
            <b>{fmtStrkBaseUnits(totalExecution)} STRK</b> from your private balance.
            {demoMode && (
              <>
                {" "}
                <span style={{ opacity: 0.8 }}>
                  Demo Mode: every private transfer routes back to your own
                  connected wallet — safe and reproducible.
                </span>
              </>
            )}
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

function PrivateBalanceCard({
  state,
  canRead,
  isConnected,
  chainVerifiedMainnet,
  tokenVerifiedMainnet,
  isStrk20Network,
  onRefresh,
  onAddFunds,
}: {
  state: PrivateBalanceState;
  canRead: boolean;
  isConnected: boolean;
  chainVerifiedMainnet: boolean;
  tokenVerifiedMainnet: boolean;
  isStrk20Network: boolean;
  onRefresh: () => void;
  onAddFunds?: () => void;
}) {
  const heading = (
    <div style={{ fontSize: 12, opacity: 0.65, letterSpacing: 0.4 }}>
      PRIVATE PAYROLL BALANCE
    </div>
  );
  const walletLine = (
    <div style={{ fontSize: 12, opacity: 0.55, marginTop: 6 }}>
      Available in your connected wallet
    </div>
  );

  // Not connected / not ready to read yet — show a placeholder that never
  // implies zero funds.
  if (!isConnected) {
    return (
      <div className={styles.inputBlock}>
        {heading}
        <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>—</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
          Connect a Starknet wallet to see your private STRK balance.
        </div>
      </div>
    );
  }
  if (!chainVerifiedMainnet || !tokenVerifiedMainnet || !isStrk20Network || !canRead) {
    return (
      <div className={styles.inputBlock}>
        {heading}
        <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>—</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
          Switch your wallet to Starknet Mainnet to read your private STRK balance.
        </div>
      </div>
    );
  }

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className={styles.inputBlock}>
        {heading}
        <div style={{ fontSize: 20, fontWeight: 500, marginTop: 4, opacity: 0.7 }}>
          Checking…
        </div>
        {walletLine}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={styles.inputBlock}>
        {heading}
        <div style={{ fontSize: 16, fontWeight: 500, marginTop: 4, color: "var(--danger)" }}>
          Could not read private STRK balance.
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6, wordBreak: "break-word" }}>
          {state.message}
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button className={styles.btn} onClick={onRefresh}>Retry</button>
        </div>
      </div>
    );
  }

  // status === "ready"
  const isZero = state.amount === 0n;
  return (
    <div className={styles.inputBlock}>
      {heading}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
        <div style={{ fontSize: 28, fontWeight: 600 }}>
          {fmtStrkBaseUnits(state.amount)}
        </div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>STRK</div>
      </div>
      {walletLine}
      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={styles.btn} onClick={onRefresh}>Refresh balance</button>
        {isZero && onAddFunds && (
          <button className={styles.btn} onClick={onAddFunds}>Add private funds</button>
        )}
      </div>
      {isZero && (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          No private STRK available. Shield STRK before running payroll.
        </div>
      )}
    </div>
  );
}

function PreflightReadout({
  balance,
  required,
  onRefresh,
  onAddFunds,
}: {
  balance: PrivateBalanceState;
  required: bigint;
  onRefresh: () => void;
  onAddFunds?: () => void;
}) {
  if (balance.status === "loading" || balance.status === "idle") {
    return (
      <div className={styles.verdict} style={{ marginTop: 12 }}>
        <div className={styles.verdictHead}>
          <span>⋯</span> Checking private balance…
        </div>
      </div>
    );
  }
  if (balance.status === "error") {
    return (
      <div className={styles.verdict + " " + styles.verdictFail} style={{ marginTop: 12 }}>
        <div className={styles.verdictHead}>
          <span>!</span> Cannot verify private balance
        </div>
        <div className={styles.verdictRow} style={{ opacity: 0.85 }}>
          {balance.message}
        </div>
        <div className={styles.verdictRow}>
          <button className={styles.btn} onClick={onRefresh}>Retry</button>
        </div>
      </div>
    );
  }
  // balance.status === "ready"
  if (required <= 0n) {
    return null;
  }
  const covered = balance.amount >= required;
  if (covered) {
    return (
      <div className={styles.verdict + " " + styles.verdictPass} style={{ marginTop: 12 }}>
        <div className={styles.verdictHead}>
          <span>✅</span> Ready to execute
        </div>
        <div className={styles.verdictRow}>
          <b>Private balance:</b>
          <span>{fmtStrkBaseUnits(balance.amount)} STRK</span>
        </div>
        <div className={styles.verdictRow}>
          <b>Payroll execution:</b>
          <span>{fmtStrkBaseUnits(required)} STRK</span>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.verdict + " " + styles.verdictFail} style={{ marginTop: 12 }}>
      <div className={styles.verdictHead}>
        <span>❌</span> Insufficient private balance
      </div>
      <div className={styles.verdictRow}>
        <b>Payroll requires:</b>
        <span>{fmtStrkBaseUnits(required)} STRK</span>
      </div>
      <div className={styles.verdictRow}>
        <b>Available:</b>
        <span>{fmtStrkBaseUnits(balance.amount)} STRK</span>
      </div>
      {onAddFunds && (
        <div className={styles.verdictRow}>
          <button className={styles.btn} onClick={onAddFunds}>Add private funds</button>
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
