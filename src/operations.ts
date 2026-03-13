import type { Schema } from "./schema.js";

type ParamsInput = URLSearchParams | string | Record<string, string>;

function toSearchParams(input: ParamsInput): URLSearchParams {
  if (input instanceof URLSearchParams) return new URLSearchParams(input);
  if (typeof input === "string") return new URLSearchParams(input);
  return new URLSearchParams(Object.entries(input));
}

/**
 * Apply schema constraints to raw params.
 *
 * - Forbidden params are dropped.
 * - Repeatable params are appended (preserving duplicates).
 * - Static params are set only if not already present in `base`.
 * - Everything else is set (last-write-wins).
 */
export function constrain(
  schema: Schema,
  incoming: ParamsInput,
  base: ParamsInput = new URLSearchParams(),
): URLSearchParams {
  const result = toSearchParams(base);
  const params = toSearchParams(incoming);

  params.forEach((value, key) => {
    if (schema.forbidden.has(key)) return;

    if (schema.repeatable.has(key)) {
      result.append(key, value);
    } else if (schema.static.has(key)) {
      if (!result.has(key)) {
        result.set(key, value);
      }
    } else {
      result.set(key, value);
    }
  });

  schema.hooks.onConstrain?.(params, result);

  return result;
}

/**
 * Merge incoming params into current params, respecting schema rules.
 *
 * - Repeatable params are diffed: new values appended, removed values dropped.
 * - Optional params from current are dropped before merging so they don't
 *   linger when the incoming set omits them.
 * - Static params in current are preserved and cannot be overwritten.
 * - Forbidden params in incoming are silently dropped.
 * - Regular params use last-write-wins.
 */
export function merge(
  schema: Schema,
  current: ParamsInput,
  incoming: ParamsInput,
): URLSearchParams {
  const result = toSearchParams(current);
  const next = toSearchParams(incoming);

  // Handle repeatable params via diff
  for (const key of schema.repeatable) {
    const currentValues = result.getAll(key);
    const nextValues = next.getAll(key);

    const currentSet = new Set(currentValues);
    const nextSet = new Set(nextValues);

    const added = nextValues.filter((v) => !currentSet.has(v));
    const removed = currentValues.filter((v) => !nextSet.has(v));

    result.delete(key);
    next.delete(key);

    const merged = currentValues.filter((v) => !removed.includes(v)).concat(added);

    for (const v of merged) {
      result.append(key, v);
    }
  }

  // Drop optional params from result so they don't linger
  for (const key of schema.optional) {
    result.delete(key);
  }

  // Apply remaining incoming params
  next.forEach((value, key) => {
    if (schema.forbidden.has(key)) return;
    if (schema.static.has(key) && result.has(key)) return;
    result.set(key, value);
  });

  schema.hooks.onMerge?.(toSearchParams(current), toSearchParams(incoming), result);

  return result;
}

/**
 * Return a copy of params with certain categories removed.
 */
export function without(
  schema: Schema,
  params: ParamsInput,
  options: { static?: boolean; forbidden?: boolean } = {},
): URLSearchParams {
  const result = toSearchParams(params);

  if (options.static) {
    for (const key of schema.static) {
      result.delete(key);
    }
  }

  if (options.forbidden) {
    for (const key of schema.forbidden) {
      result.delete(key);
    }
  }

  schema.hooks.onWithout?.(toSearchParams(params), result);

  return result;
}

/**
 * Get a single param value (convenience wrapper).
 */
export function get(params: URLSearchParams, key: string): string | null {
  return params.get(key);
}

/**
 * Get all values for a repeatable param.
 */
export function getAll(params: URLSearchParams, key: string): string[] {
  return params.getAll(key);
}

/**
 * Extract search params from a full URL string or URL object.
 */
export function fromURL(url: string | URL): URLSearchParams {
  return new URL(url).searchParams;
}

/**
 * Convert URLSearchParams to a plain object.
 * Repeatable keys become arrays; singular keys become strings.
 */
export function toObject(params: URLSearchParams): Record<string, string | string[]> {
  const obj: Record<string, string | string[]> = {};

  params.forEach((value, key) => {
    const existing = obj[key];
    if (existing !== undefined) {
      obj[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      obj[key] = value;
    }
  });

  return obj;
}
