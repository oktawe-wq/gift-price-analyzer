// ---------------------------------------------------------------------------
// Gift scoring engine
//
// Formula overview:
//
//   R   = (stars / 5) × 10                                      [0, 10]
//   N   = 10 × exp(−daysSinceAdded / 180)                      (0, 10]
//   Pop = (log₁₀(reviews + 1) / log₁₀(maxReviews + 1)) × 10  [0, 10]
//
//   Score = (R×0.4 + N×0.35 + Pop×0.25) / log₂(price)
//
// Edge-case rules applied before any calculation:
//   • stars          → clamped to [0, 5]
//   • daysSinceAdded → clamped to ≥ 0   (future dates become 0)
//   • reviews        → clamped to ≥ 0
//   • maxReviews ≤ 0 → Pop = 0          (no reference scale yet)
//   • price < 1      → treated as 1     (log₂ of fractions goes negative)
//   • log₂(price)= 0 → raw score returned as-is (no divisor applied)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GiftScoreInput {
  /** Star rating, expected range 0–5. Clamped if out of range. */
  stars: number;
  /** Days elapsed since the item was listed. Clamped to ≥ 0. */
  daysSinceAdded: number;
  /** Number of customer reviews for this item. Clamped to ≥ 0. */
  reviews: number;
  /**
   * Maximum review count observed across the entire catalogue.
   * Used to normalise the popularity component.
   * When 0 the popularity score is set to 0.
   */
  maxReviews: number;
  /** Item price in UAH. Values below 1 are treated as 1. */
  price: number;
}

export interface ScoreComponents {
  /** Rating component:    (stars / 5) × 10 */
  R: number;
  /** Newness component:   10 × exp(−days / 180) */
  N: number;
  /** Popularity component: normalised log-review score × 10 */
  Pop: number;
  /** Weighted sum before price normalisation: R×0.4 + N×0.35 + Pop×0.25 */
  weighted: number;
  /** Final composite score after dividing by log₂(price) */
  score: number;
}

// ---------------------------------------------------------------------------
// calculateGiftScore
// ---------------------------------------------------------------------------

/**
 * Computes a composite gift score from rating, recency, popularity, and price.
 *
 * Returns all intermediate components alongside the final score so callers
 * can display breakdowns or debug the formula.
 *
 * @example
 * const result = calculateGiftScore({
 *   stars: 4.5, daysSinceAdded: 30, reviews: 120,
 *   maxReviews: 500, price: 349,
 * });
 * // result.score ≈ 1.08
 */
export function calculateGiftScore(item: GiftScoreInput): ScoreComponents {
  // ── Sanitise inputs ──────────────────────────────────────────────────────

  // Stars must stay within the defined scale.
  const stars = Math.min(Math.max(item.stars, 0), 5);

  // Negative "days since added" (e.g. clock drift) is nonsensical — treat as 0.
  const days = Math.max(item.daysSinceAdded, 0);

  // Review counts cannot be negative.
  const reviews    = Math.max(item.reviews, 0);
  const maxReviews = Math.max(item.maxReviews, 0);

  // log₂ of values below 1 is negative, which would invert the score sign.
  // log₂(1) = 0 is handled separately below.
  const safePrice = Math.max(item.price, 1);

  // ── Component R — Rating ─────────────────────────────────────────────────
  const R = (stars / 5) * 10;

  // ── Component N — Newness (exponential decay) ─────────────────────────────
  // Approaches 10 when brand new, decays toward 0 over ~18 months.
  const N = 10 * Math.exp(-days / 180);

  // ── Component Pop — Popularity ────────────────────────────────────────────
  // Log-scale prevents a single mega-popular item from dominating linearly.
  // Guard: if maxReviews = 0 there is no reference yet, so popularity = 0.
  const Pop =
    maxReviews <= 0
      ? 0
      : (Math.log10(reviews + 1) / Math.log10(maxReviews + 1)) * 10;

  // ── Weighted sum ──────────────────────────────────────────────────────────
  const weighted = R * 0.4 + N * 0.35 + Pop * 0.25;

  // ── Price normalisation ───────────────────────────────────────────────────
  // log₂(price) makes the penalty grow slowly so a ₴1000 item isn't
  // penalised 10× as hard as a ₴100 item.
  //
  // Special case: log₂(1) = 0 → skip the division and return the raw
  // weighted score, treating ₴1 items as having no price penalty.
  const logPrice = Math.log2(safePrice);
  const score    = logPrice === 0 ? weighted : weighted / logPrice;

  return { R, N, Pop, weighted, score };
}

// ---------------------------------------------------------------------------
// calculateValue
// ---------------------------------------------------------------------------

/**
 * Expresses value-for-money as score earned per 100 UAH spent.
 *
 *   value = score / (price / 100) = score × 100 / price
 *
 * A higher value means you get more "score bang" per unit of currency.
 *
 * Edge cases:
 *   • price ≤ 0  → returns 0  (avoids ±Infinity; price must be positive)
 *   • score = 0  → returns 0  (correct — zero-rated item has no value)
 *
 * @param score - Output of `calculateGiftScore().score`
 * @param price - Item price in UAH
 */
export function calculateValue(score: number, price: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(price) || price <= 0) {
    return 0;
  }
  return score / (price / 100);
}

// ---------------------------------------------------------------------------
// Convenience: score + value in one call
// ---------------------------------------------------------------------------

export interface GiftEvaluation extends ScoreComponents {
  /** calculateValue(score, price) */
  value: number;
  /** Input price (sanitised to ≥ 1) used in calculations */
  effectivePrice: number;
}

/**
 * Runs both {@link calculateGiftScore} and {@link calculateValue} and merges
 * the results into a single object.
 */
export function evaluateGift(item: GiftScoreInput): GiftEvaluation {
  const components = calculateGiftScore(item);
  const effectivePrice = Math.max(item.price, 1);
  const value = calculateValue(components.score, effectivePrice);
  return { ...components, value, effectivePrice };
}
