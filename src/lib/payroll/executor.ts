// Async payroll executor.
//
// One wallet confirmation (batched strk20InvokeTransaction) covers all
// recipients. Per-recipient status is derived from the shared receipt:
//
//   pending → awaiting_wallet → submitted → confirmed | failed
//
// The caller passes an onUpdate callback to observe intermediate states
// (drives the UI). The final Payroll is also the resolved value.

import type { ProviderInterface, WalletAccountV6 } from "starknet";
import { buildPayrollActions } from "./actions";
import type { Payroll, PaymentStatus, PayrollStatus } from "./types";
import {
  assertMainnetChain,
  assertStrkMainnetToken,
} from "../starknet/networks";

export type ExecutePayrollArgs = {
  wallet: WalletAccountV6;
  provider: ProviderInterface;
  tokenAddress: string;
  /** Wallet's current chain ID (from wallet-standard event stream or
   *  walletV6.requestChainId). The executor asserts this is Starknet
   *  Mainnet before submitting. Backstop for a compromised or buggy UI. */
  currentChainId: string;
  onUpdate?: (payroll: Payroll) => void;
  /** Overrides for waitForTransaction. Defaults match the starter kit's
   *  long budget (400 * 3s = ~20 min) because privacy-pool txs verify a
   *  STARK proof on-chain. */
  waitOptions?: { retries?: number; retryInterval?: number };
};

export class PayrollNotReadyError extends Error {
  constructor(public readonly current: PayrollStatus) {
    super(`Payroll is not ready to execute (status: ${current}).`);
    this.name = "PayrollNotReadyError";
  }
}

function updateRecipients(
  payroll: Payroll,
  patch: (r: Payroll["recipients"][number]) => Payroll["recipients"][number],
  overallStatus: PayrollStatus
): Payroll {
  return {
    ...payroll,
    recipients: payroll.recipients.map(patch),
    status: overallStatus,
  };
}

function setAll(
  payroll: Payroll,
  status: PaymentStatus,
  overallStatus: PayrollStatus,
  extras?: { txHash?: string; error?: string }
): Payroll {
  return updateRecipients(
    payroll,
    (r) => ({
      ...r,
      status,
      txHash: extras?.txHash ?? r.txHash,
      error: extras?.error,
    }),
    overallStatus
  );
}

// Reset every recipient to a clean pending state, wiping any tx hash / error
// left over from a previous execution. Applied at the top of executePayroll so
// a stale success hash cannot leak into a new run's UI.
function resetAllRecipients(payroll: Payroll): Payroll {
  return {
    ...payroll,
    status: "ready",
    recipients: payroll.recipients.map((r) => ({
      ...r,
      status: "pending",
      txHash: undefined,
      error: undefined,
    })),
  };
}

// A wallet-returned transaction hash must be a hex string starting with 0x
// and long enough to plausibly be a Starknet transaction hash. Anything else
// (undefined, empty string, garbage) is treated as a wallet-side failure — we
// never render "confirmed" against such a value.
function isValidTxHash(v: unknown): v is string {
  return typeof v === "string" && /^0x[0-9a-fA-F]{60,66}$/.test(v);
}

/**
 * Execute a `ready` payroll. Returns the final Payroll on success. On failure
 * still resolves with a Payroll whose status is "failed" (the error is also
 * thrown after onUpdate fires — callers may catch or await accordingly).
 */
export async function executePayroll(
  payroll: Payroll,
  args: ExecutePayrollArgs
): Promise<Payroll> {
  if (payroll.status !== "ready") {
    throw new PayrollNotReadyError(payroll.status);
  }

  // Belt + braces mainnet checks — refuse to submit if either is wrong.
  // Throwing here surfaces the error to the caller before any wallet popup.
  assertMainnetChain(args.currentChainId);
  assertStrkMainnetToken(args.tokenAddress);

  const actions = buildPayrollActions(payroll, args.tokenAddress);

  // Hard-reset recipient state before signalling awaiting_wallet, so no tx
  // hash from a previous execution can leak into the UI mid-flight.
  const cleanPayroll = resetAllRecipients(payroll);
  let current: Payroll = setAll(cleanPayroll, "awaiting_wallet", "executing");
  args.onUpdate?.(current);

  let txHash: string;
  try {
    const result = await args.wallet.strk20InvokeTransaction(actions);
    if (!isValidTxHash(result?.transaction_hash)) {
      const message = `Wallet returned no valid transaction hash (got: ${JSON.stringify(result)}). Refusing to mark payroll as submitted.`;
      current = setAll(cleanPayroll, "failed", "failed", { error: message });
      args.onUpdate?.(current);
      throw new Error(message);
    }
    txHash = result.transaction_hash;
  } catch (err: unknown) {
    const message = errorMessage(err);
    current = setAll(cleanPayroll, "failed", "failed", { error: message });
    args.onUpdate?.(current);
    throw err;
  }

  current = setAll(cleanPayroll, "submitted", "executing", { txHash });
  args.onUpdate?.(current);

  const retries = args.waitOptions?.retries ?? 400;
  const retryInterval = args.waitOptions?.retryInterval ?? 3000;

  try {
    const receipt = await args.provider.waitForTransaction(txHash, {
      retries,
      retryInterval,
    });
    // Starknet.js returns a wrapped receipt; unwrap defensively.
    const raw = (receipt as { value?: unknown } | undefined)?.value ?? receipt;
    const execStatus = readExecutionStatus(raw);
    // We treat "confirmed" as a strict SUCCEEDED verdict. Any other value
    // (REVERTED / undefined / unexpected string) is a failure — we never
    // infer success from the absence of REVERTED alone.
    if (execStatus === "REVERTED") {
      current = setAll(cleanPayroll, "failed", "failed", {
        txHash,
        error: "Transaction reverted on-chain.",
      });
      args.onUpdate?.(current);
      return current;
    }
    if (execStatus !== "SUCCEEDED") {
      current = setAll(cleanPayroll, "failed", "failed", {
        txHash,
        error: `Unexpected execution_status: ${String(execStatus)}. Refusing to mark as confirmed.`,
      });
      args.onUpdate?.(current);
      return current;
    }
    current = setAll(cleanPayroll, "confirmed", "completed", { txHash });
    args.onUpdate?.(current);
    return current;
  } catch (err: unknown) {
    const message = errorMessage(err);
    current = setAll(cleanPayroll, "failed", "failed", { txHash, error: message });
    args.onUpdate?.(current);
    throw err;
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function readExecutionStatus(raw: unknown): string | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const v = (raw as Record<string, unknown>).execution_status;
  return typeof v === "string" ? v : undefined;
}
