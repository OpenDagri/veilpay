// Domain types for a VeilPay payroll.
//
// Critical separation (see CLAUDE.md, "Critical separation"): `displayAmount`
// is the fictional label a demo judge sees (e.g. "137 USDC"); `executionAmount`
// is the real base-unit value the STRK20 transfer moves. The UI must never
// silently execute the display amount.

export type PaymentStatus =
  | "pending"
  | "awaiting_wallet"
  | "submitted"
  | "confirmed"
  | "failed";

export type PayrollRecipient = {
  id: string;
  displayName: string;
  address: string;
  displayAmount: string;
  executionAmount: bigint;
  status: PaymentStatus;
  txHash?: string;
  error?: string;
};

export type PayrollStatus =
  | "draft"
  | "ready"
  | "executing"
  | "completed"
  | "failed";

export type Payroll = {
  id: string;
  label: string;
  recipients: PayrollRecipient[];
  createdAt: number;
  status: PayrollStatus;
  seed?: string;
};

export function sumExecutionAmount(recipients: PayrollRecipient[]): bigint {
  return recipients.reduce((acc, r) => acc + r.executionAmount, 0n);
}
