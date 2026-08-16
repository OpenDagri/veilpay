// Controlled demo recipient addresses. STRK20 requires recipients to be
// pre-registered in the pool, so we cannot invent random Starknet addresses
// and pay them — those transfers would fail (see docs/strk20-integration.md).
//
// Populate this list with real Starknet Mainnet addresses that have already
// registered in the STRK20 privacy pool (a wallet registers on its first shield
// via Ready X or Xverse). The demo generator maps fictional names onto these
// addresses in order.

export type DemoRecipient = {
  /** Stable slot id used by the generator ("A", "B", "C", ...). */
  slot: string;
  /** Starknet Mainnet address, hex. Must be pre-registered in the STRK20 pool. */
  address: string;
  /** Optional human note about the address (only shown in dev tools). */
  note?: string;
};

export const DEMO_RECIPIENTS: DemoRecipient[] = [
  // Populate before the first browser run of the payroll flow.
  // Example:
  // { slot: "A", address: "0x…", note: "Mainnet demo wallet A (registered 2026-08-16)" },
  // { slot: "B", address: "0x…", note: "Mainnet demo wallet B" },
  // { slot: "C", address: "0x…", note: "Mainnet demo wallet C" },
];
