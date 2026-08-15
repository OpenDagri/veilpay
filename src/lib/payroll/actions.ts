// Pure builder: turn a Payroll into the STRK20_ACTION[] a WalletAccountV6 can
// submit in a single strk20InvokeTransaction call.
//
// The starter kit's WalletAccountV6Tag.tsx demonstrates batched actions
// (echo flow at lines 345-353), so N-recipient payrolls ship as one wallet
// confirmation. See docs/strk20-integration.md for the full rationale.

import { num } from "starknet";
import type { WALLET_API } from "@starknet-io/types-js";
import type { Payroll } from "./types";

/**
 * Build the STRK20 action array for a payroll. Throws if any recipient
 * lacks an address — the demo generator returns a `draft` payroll in
 * that case, and the UI is responsible for refusing to invoke this
 * builder on drafts.
 */
export function buildPayrollActions(
  payroll: Payroll,
  tokenAddress: string
): WALLET_API.STRK20_ACTION[] {
  const missing = payroll.recipients.filter((r) => !r.address);
  if (missing.length) {
    throw new Error(
      `Payroll has ${missing.length} recipient(s) without addresses — refusing to build actions.`
    );
  }
  const zero = payroll.recipients.filter((r) => r.executionAmount <= 0n);
  if (zero.length) {
    throw new Error(
      `Payroll has ${zero.length} recipient(s) with non-positive execution amount.`
    );
  }
  return payroll.recipients.map((r) => ({
    type: "transfer",
    token: tokenAddress,
    amount: num.toHex(r.executionAmount),
    recipient: r.address,
  }));
}
