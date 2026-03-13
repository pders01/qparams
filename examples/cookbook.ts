/**
 * qparams cookbook — common patterns and recipes.
 *
 * These are not part of the library API. They show how to compose
 * the existing primitives for typical use cases.
 */

import {
  createSchema,
  constrain,
  merge,
  without,
  get,
  getAll,
  toObject,
  fromURL,
} from "@jpahd/qparams";

// ──────────────────────────────────────────────
// 1. Default values
// ──────────────────────────────────────────────
// Pass defaults as the `base` argument to constrain.
// Regular params from incoming overwrite the defaults;
// missing params keep the default value.

const schema = createSchema({ repeatable: ["tag"], optional: ["q"] });
const defaults = new URLSearchParams("sort=relevance&page=1");
const params = constrain(schema, "q=hello&sort=price", defaults);

params.get("sort"); // "price" — overwritten by incoming
params.get("page"); // "1"     — kept from defaults
params.get("q"); // "hello"

// ──────────────────────────────────────────────
// 2. Typed deserialization with zod
// ──────────────────────────────────────────────
// Use zod (or valibot, arktype, etc.) to parse values
// after reading them from URLSearchParams.

// import { z } from "zod";
//
// const raw = fromURL("https://example.com?page=3&active=true&date=2026-01-01");
//
// const page = z.coerce.number().parse(raw.get("page"));       // 3
// const active = z.coerce.boolean().parse(raw.get("active"));  // true
// const date = z.coerce.date().parse(raw.get("date"));         // Date

// ──────────────────────────────────────────────
// 3. Typed deserialization without a library
// ──────────────────────────────────────────────
// Plain parser functions work just as well.

function parseNumber(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function parseBoolean(v: string | null): boolean | null {
  if (v === null) return null;
  return v === "true";
}

const url = fromURL("https://example.com?page=3&active=true");
const page = parseNumber(get(url, "page")); // 3
const active = parseBoolean(get(url, "active")); // true

// ──────────────────────────────────────────────
// 4. Pick (inverse of without)
// ──────────────────────────────────────────────
// Keep only params that belong to specific schema categories.

function pick(
  schema: ReturnType<typeof createSchema>,
  params: URLSearchParams,
  categories: Array<"forbidden" | "repeatable" | "optional" | "static">,
): URLSearchParams {
  const allowed = new Set(categories.flatMap((c) => [...schema[c]]));
  const result = new URLSearchParams();
  params.forEach((v, k) => {
    if (allowed.has(k)) result.append(k, v);
  });
  return result;
}

const s = createSchema({ repeatable: ["tag"], static: ["limit"] });
const p = new URLSearchParams("tag=a&tag=b&limit=20&q=hello");
const picked = pick(s, p, ["repeatable"]);
picked.toString(); // "tag=a&tag=b"

// ──────────────────────────────────────────────
// 5. Check if params contain any keys from a category
// ──────────────────────────────────────────────

function hasCategory(
  schema: ReturnType<typeof createSchema>,
  params: URLSearchParams,
  category: "forbidden" | "repeatable" | "optional" | "static",
): boolean {
  for (const key of schema[category]) {
    if (params.has(key)) return true;
  }
  return false;
}

const s2 = createSchema({ repeatable: ["tag"] });
hasCategory(s2, new URLSearchParams("tag=a"), "repeatable"); // true
hasCategory(s2, new URLSearchParams("q=hello"), "repeatable"); // false

// ──────────────────────────────────────────────
// 6. Sync to URL without a framework binding
// ──────────────────────────────────────────────
// Useful in vanilla JS or lightweight setups.

function pushParams(params: URLSearchParams): void {
  const url = new URL(window.location.href);
  url.search = params.toString();
  window.history.pushState({}, "", url);
}

// const current = fromURL(window.location.href);
// const next = merge(schema, current, { q: "new search" });
// pushParams(next);
