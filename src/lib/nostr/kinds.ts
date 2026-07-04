/**
 * Event kinds used by localstr.
 *
 * Interop notes:
 * - GEO_CHAT (20000) is the ephemeral geohash chat kind used by bitchat and
 *   Nymchat. We deliberately reuse it (with ["g", geohash] + ["n", nick] tags)
 *   instead of inventing a custom kind.
 * - CALENDAR_DATE / CALENDAR_TIME are NIP-52.
 *
 * TODO(reviews): place reviews are planned as NIP-32 labels (kind 1985 with
 * ["L", namespace] / ["l", label] + g tags). The subscription manager below is
 * keyed by scope name, so adding a "reviews" scope is a one-liner in
 * SCOPE_FILTERS once the label schema is settled.
 */
export const KIND_PROFILE = 0;
export const KIND_NOTE = 1;
export const KIND_REACTION = 7; // NIP-25
export const KIND_ZAP_RECEIPT = 9735; // NIP-57
export const KIND_GEO_CHAT = 20000; // ephemeral, bitchat-compatible
export const KIND_CALENDAR_DATE = 31922; // NIP-52 date-based
export const KIND_CALENDAR_TIME = 31923; // NIP-52 time-based
