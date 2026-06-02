/** Hours a generated recommendation row stays valid before cleanup can remove it. */
export const RECOMMENDATION_CACHE_TTL_HOURS = 24;

export const getRecommendationExpiresAt = (): Date =>
  new Date(Date.now() + RECOMMENDATION_CACHE_TTL_HOURS * 60 * 60 * 1000);
