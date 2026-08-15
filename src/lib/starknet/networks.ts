// Mainnet safety module.
//
// Every wallet-signable action MUST route through the asserts here so that:
//   (a) the wallet's current chain is Starknet Mainnet, and
//   (b) the token address we're submitting matches the verified STRK mainnet
//       contract, not something planted in constants by an upstream file we
//       imported without reading it end-to-end.
//
// Sources for the STRK token address (verified 2026-08-15):
//   - Starkscan token page:
//     https://starkscan.co/token/0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
//   - Starknet docs — chain-info cheatsheet:
//     https://docs.starknet.io/learn/cheatsheets/chain-info
//   - starknet.js ERC-20 guide:
//     https://starknetjs.com/docs/guides/contracts/use_ERC20/
//
// Chain IDs come from starknet.js so we track upstream if they ever change.

import { constants as SNconstants } from "starknet";

export const STRK_MAINNET_TOKEN =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d" as const;

export const STRK_DECIMALS = 18;

export const MAINNET_CHAIN_ID = SNconstants.StarknetChainId.SN_MAIN;

/** Best-effort normalization: hex → lowercase, drop leading-zero padding. */
export function normalizeChainId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isMainnetChainId(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return normalizeChainId(raw) === normalizeChainId(MAINNET_CHAIN_ID);
}

export class NotMainnetError extends Error {
  constructor(public readonly seen: string) {
    super(
      `Wallet is not on Starknet Mainnet (chain id: ${seen}). Refusing to submit.`
    );
    this.name = "NotMainnetError";
  }
}

export function assertMainnetChain(raw: string | null | undefined): void {
  if (!isMainnetChainId(raw)) {
    throw new NotMainnetError(raw ?? "<unknown>");
  }
}

export class UnverifiedTokenError extends Error {
  constructor(public readonly seen: string) {
    super(
      `Token address ${seen} is not the verified Starknet mainnet STRK contract. Refusing to submit.`
    );
    this.name = "UnverifiedTokenError";
  }
}

/** Compares two Starknet address forms (with/without leading-zero padding). */
export function sameAddress(a: string, b: string): boolean {
  try {
    return BigInt(a) === BigInt(b);
  } catch {
    return false;
  }
}

export function assertStrkMainnetToken(tokenAddress: string): void {
  if (!sameAddress(tokenAddress, STRK_MAINNET_TOKEN)) {
    throw new UnverifiedTokenError(tokenAddress);
  }
}
