// Small deterministic PRNG for repeatable demo payrolls.
//
// mulberry32 — 32-bit state, non-cryptographic. Same seed → same sequence.
// Used only to sample demo names and display amounts; NEVER to derive keys,
// addresses, or nonces.

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a: number): () => number {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = {
  /** Uniform [0, 1). */
  next: () => number;
  /** Uniform integer in [0, maxExclusive). */
  int: (maxExclusive: number) => number;
  /** Uniform integer in [min, maxInclusive]. */
  intInclusive: (min: number, maxInclusive: number) => number;
  /** Random element of arr. */
  pick: <T>(arr: readonly T[]) => T;
};

export function makeRng(seed: string): Rng {
  const hash = xmur3(seed)();
  const rand = mulberry32(hash);
  const int = (max: number) => Math.floor(rand() * max);
  return {
    next: rand,
    int,
    intInclusive: (min, max) => min + int(max - min + 1),
    pick: (arr) => arr[int(arr.length)],
  };
}

/** The canonical seed for reproducible demo payrolls. */
export const DEFAULT_DEMO_SEED = "veilpay-demo";
