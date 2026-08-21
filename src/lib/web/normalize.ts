/**
 * The generated Tauri bindings type every Rust `i64` as a `string` (see the
 * "Type-Safe i64 Serialization" section of AGENTS.md) because JavaScript loses
 * precision above 2^53. The Miniflux REST API returns those same ids as JSON
 * **numbers**, so every response has to be coerced before it can satisfy the
 * generated types.
 *
 * This is a targeted coercion, not a blanket "stringify all numbers": fields
 * like `reading_time`, `parsing_error_count` and `position` are genuinely
 * numeric in the bindings and must stay numbers.
 */

/** Keys that the bindings type as `string` but Miniflux sends as a number. */
const ID_KEYS = new Set([
  'id',
  'user_id',
  'feed_id',
  'category_id',
  'entry_id',
  'icon_id',
  'length',
  'total',
  'unread_count',
]);

/**
 * Recursively converts the id-shaped fields of a decoded Miniflux payload from
 * numbers to strings. Values that are already strings are left alone, as are
 * `null`/`undefined`.
 */
export function normalizeIds<T>(value: unknown): T {
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(walk);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) {
    out[key] = ID_KEYS.has(key) && typeof item === 'number' ? String(item) : walk(item);
  }
  return out;
}

/**
 * Converts a binding-side string id back to the number the REST API expects.
 * Throws rather than silently sending `NaN` down the wire.
 */
export function toNumericId(id: string, label = 'id'): number {
  const parsed = Number(id);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label}: "${id}" is not a number`);
  }
  return parsed;
}
