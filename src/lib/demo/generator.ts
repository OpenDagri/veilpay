// Client-side demo payroll generator.
//
// - Names + display amounts are FICTIONAL (see names.ts). Display amounts look
//   like realistic salary numbers ("137 USDC"); they are not the amount the
//   payroll actually sends.
// - `executionAmount` is a tiny fixed base-unit value (SAFE_EXECUTION_AMOUNT)
//   per recipient. This is what the STRK20 transfer actually moves.
// - Recipient addresses come from DEMO_RECIPIENTS (must be pre-registered in
//   the STRK20 pool). If the caller hasn't populated those, the generator
//   still returns a Payroll, but each recipient's `address` is empty and the
//   payroll is `draft` — the UI must refuse to execute until addresses land.

import {
  Payroll,
  PayrollRecipient,
} from "../payroll/types";
import { firstNames, lastNames } from "./names";
import { DEMO_RECIPIENTS } from "./recipients";
import { DEFAULT_DEMO_SEED, makeRng } from "./rng";

/**
 * Base-unit execution amount per recipient. 1 STRK = 1e18 base units;
 * 1e15 = 0.001 STRK. Small enough to be safe even on mainnet.
 */
export const SAFE_EXECUTION_AMOUNT: bigint = 10n ** 15n;

/** Display-amount range (in the fictional "USDC" units the label shows). */
const DISPLAY_MIN = 90;
const DISPLAY_MAX = 480;

export type GeneratePayrollOptions = {
  seed?: string;
  recipientCount?: number;
  label?: string;
  /** Override the fictional currency label shown next to display amounts. */
  displayCurrency?: string;
  /** Self-recipient Demo Mode: when set, every generated recipient's
   *  `address` is forced to this value (typically the connected wallet).
   *  DEMO_RECIPIENTS is ignored in this mode. Never hardcode — pass the
   *  live wallet address from the caller. */
  selfRecipient?: string;
};

export function generatePayroll(options: GeneratePayrollOptions = {}): Payroll {
  const seed = options.seed ?? DEFAULT_DEMO_SEED;
  const count = Math.max(1, Math.min(options.recipientCount ?? 3, 12));
  const displayCurrency = options.displayCurrency ?? "USDC";
  const isSelfDemo = !!options.selfRecipient;
  const label =
    options.label ??
    (isSelfDemo ? `${defaultLabel()} — self-recipient demo` : defaultLabel());

  const rng = makeRng(seed);
  const usedNames = new Set<string>();
  const recipients: PayrollRecipient[] = [];

  for (let i = 0; i < count; i++) {
    const displayName = pickUniqueName(rng, usedNames);
    const displayValue = rng.intInclusive(DISPLAY_MIN, DISPLAY_MAX);
    const displayAmount = `${displayValue} ${displayCurrency}`;

    let address: string;
    if (isSelfDemo) {
      address = options.selfRecipient as string;
    } else {
      const demo = DEMO_RECIPIENTS[i];
      address = demo?.address ?? "";
    }

    recipients.push({
      id: `${seed}:${i}`,
      displayName,
      address,
      displayAmount,
      executionAmount: SAFE_EXECUTION_AMOUNT,
      status: "pending",
    });
  }

  const allHaveAddresses = recipients.every((r) => r.address !== "");

  return {
    id: `payroll:${seed}:${Date.now()}`,
    label,
    recipients,
    createdAt: Date.now(),
    status: allHaveAddresses ? "ready" : "draft",
    seed,
  };
}

function pickUniqueName(
  rng: ReturnType<typeof makeRng>,
  used: Set<string>
): string {
  for (let attempt = 0; attempt < 32; attempt++) {
    const name = `${rng.pick(firstNames)} ${rng.pick(lastNames)}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  return `${rng.pick(firstNames)} ${rng.pick(lastNames)} #${used.size + 1}`;
}

function defaultLabel(): string {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  return `${month} Payroll`;
}
