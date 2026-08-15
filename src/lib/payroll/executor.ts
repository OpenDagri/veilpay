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

  let current: Payroll = setAll(payroll, "awaiting_wallet", "executing");
  args.onUpdate?.(current);

  let txHash: string;
  try {
    const result = await args.wallet.strk20InvokeTransaction(actions);
    txHash = result.transaction_hash;
  } catch (err: unknown) {
    const message = errorMessage(err);
    current = setAll(payroll, "failed", "failed", { error: message });
    args.onUpdate?.(current);
    throw err;
  }

  current = setAll(payroll, "submitted", "executing", { txHash });
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
    const reverted = readExecutionStatus(raw) === "REVERTED";
    if (reverted) {
      current = setAll(payroll, "failed", "failed", {
        txHash,
        error: "Transaction reverted on-chain.",
      });
      args.onUpdate?.(current);
      return current;
    }
    current = setAll(payroll, "confirmed", "completed", { txHash });
    args.onUpdate?.(current);
    return current;
  } catch (err: unknown) {
    const message = errorMessage(err);
    current = setAll(payroll, "failed", "failed", { txHash, error: message });
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
