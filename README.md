# qparams

Schema-driven URL query parameter handling. Define rules for how your params behave — forbidden, repeatable, optional, static — and let `qparams` enforce them.

Zero runtime dependencies. Pure functions. Returns standard `URLSearchParams`.

## Install

```bash
pnpm add @jpahd/qparams
```

## Quick start

```ts
import { createSchema, constrain, merge } from "@jpahd/qparams";

const schema = createSchema({
  forbidden: ["token"],       // silently stripped
  repeatable: ["tag"],        // may appear multiple times
  optional: ["filter"],       // dropped on merge when not re-supplied
  static: ["_page"],          // set once, never overwritten
});

// Constrain raw user input against the schema
const params = constrain(schema, "token=secret&tag=js&tag=ts&name=test");
params.toString(); // "tag=js&tag=ts&name=test"

// Merge new params into existing ones
const next = merge(schema, params, "tag=ts&tag=go&name=updated");
next.getAll("tag"); // ["ts", "go"]  — "js" removed, "go" added
next.get("name");   // "updated"
```

Any param not listed in the schema is treated as a regular param (last-write-wins).

## API

### `createSchema(options?): Schema`

Create a schema that classifies param keys into categories.

```ts
interface SchemaOptions {
  forbidden?: string[];   // Dropped on constrain/merge
  repeatable?: string[];  // Appended, not overwritten; diffed on merge
  optional?: string[];    // Dropped from current state on merge unless re-supplied
  static?: string[];      // Set once, subsequent writes are ignored
  hooks?: Hooks;          // Optional callbacks fired after operations
  validate?: (schema: Schema) => void;  // BYO validation callback
}
```

Returns a `Schema` (an object of `ReadonlySet<string>`s + `hooks`).

### `constrain(schema, incoming, base?): URLSearchParams`

Apply schema rules to raw params. Useful for sanitizing user/URL input before use.

- Forbidden params are dropped.
- Repeatable params are appended.
- Static params are set only if absent in `base`.
- Regular params use last-write-wins.

```ts
const schema = createSchema({ forbidden: ["debug"], static: ["v"] });

// With a base — static param "v" already exists, so incoming "v=2" is ignored
constrain(schema, "v=2&debug=1&q=hello", "v=1");
// => "v=1&q=hello"
```

`incoming` and `base` accept `URLSearchParams | string | Record<string, string>`.

### `merge(schema, current, incoming): URLSearchParams`

Merge incoming params into current params, respecting all schema rules.

| Category   | Behavior on merge                                                   |
|------------|---------------------------------------------------------------------|
| forbidden  | Silently dropped from incoming                                      |
| repeatable | Diffed: shared values kept, new values appended, missing values removed |
| optional   | Dropped from current before merge; survives only if re-supplied     |
| static     | Preserved in current; incoming writes ignored                       |
| regular    | Last-write-wins                                                     |

```ts
const schema = createSchema({
  repeatable: ["tag"],
  optional: ["filter"],
});

const current = new URLSearchParams("tag=a&tag=b&filter=active&sort=name");
const next = merge(schema, current, "tag=b&tag=c&sort=date");

next.getAll("tag");    // ["b", "c"]      — "a" removed, "c" added
next.has("filter");    // false            — optional, not re-supplied
next.get("sort");      // "date"           — regular, overwritten
```

### `without(schema, params, options?): URLSearchParams`

Return a copy with certain schema categories removed.

```ts
const schema = createSchema({ static: ["_page", "_limit"] });
const clean = without(schema, "_page=1&_limit=20&q=hello", { static: true });
clean.toString(); // "q=hello"
```

Options: `{ static?: boolean; forbidden?: boolean }`.

### `fromURL(url): URLSearchParams`

Extract search params from a full URL string or `URL` object.

```ts
import { fromURL } from "@jpahd/qparams";

const params = fromURL("https://example.com/search?q=hello&tag=js");
params.get("q"); // "hello"
```

### `get(params, key): string | null`

Convenience wrapper around `URLSearchParams.get()`.

### `getAll(params, key): string[]`

Convenience wrapper around `URLSearchParams.getAll()`. Useful for repeatable params.

### `toObject(params): Record<string, string | string[]>`

Convert `URLSearchParams` to a plain object. Keys that appear multiple times become arrays; singular keys become strings.

```ts
const params = new URLSearchParams("tag=a&tag=b&name=test");
toObject(params); // { tag: ["a", "b"], name: "test" }
```

## Hooks

Opt-in callbacks fired after operations. Useful for logging, analytics, or debugging.

```ts
import { createSchema } from "@jpahd/qparams";

const schema = createSchema({
  repeatable: ["tag"],
  hooks: {
    onConstrain(incoming, result) {
      console.log("constrain:", result.toString());
    },
    onMerge(current, incoming, result) {
      console.log("merge:", result.toString());
    },
    onWithout(input, result) {
      console.log("without:", result.toString());
    },
  },
});
```

## Schema validation

`createSchema` accepts a `validate` callback for BYO validation. It receives the built schema and can throw if something is wrong.

```ts
import { createSchema } from "@jpahd/qparams";

createSchema({
  forbidden: ["tag"],
  repeatable: ["tag"], // oops — same key in two categories
  validate(schema) {
    const seen = new Set<string>();
    for (const category of [schema.forbidden, schema.repeatable, schema.optional, schema.static]) {
      for (const key of category) {
        if (seen.has(key)) throw new Error(`Key "${key}" in multiple categories`);
        seen.add(key);
      }
    }
  },
});
// throws: Key "tag" in multiple categories
```

See `examples/zod-validator.ts` for a zod-based validator.

## Framework bindings

Companion packages that sync qparams with framework-specific reactivity. All share the same return shape: `params`, `update`, `strip`, `toObject`.

| Package | Install | API |
|---|---|---|
| React | `pnpm add @jpahd/qparams-react` | `useQParams(schema)` |
| Vue | `pnpm add @jpahd/qparams-vue` | `useQParams(schema)` |
| Lit | `pnpm add @jpahd/qparams-lit` | `new QParamsController(host, schema)` |
| Svelte | `pnpm add @jpahd/qparams-svelte` | `createQParams(schema)` |
| Solid | `pnpm add @jpahd/qparams-solid` | `createQParams(schema)` |

```ts
// React example
import { createSchema } from "@jpahd/qparams";
import { useQParams } from "@jpahd/qparams-react";

const schema = createSchema({ repeatable: ["tag"], optional: ["q"] });

function SearchPage() {
  const { params, update, strip, toObject } = useQParams(schema);

  return (
    <input
      value={params.get("q") ?? ""}
      onChange={(e) => update({ q: e.target.value })}
    />
  );
}
```

## Param categories explained

| Category       | Use case                                        | Example keys           |
|----------------|-------------------------------------------------|------------------------|
| **forbidden**  | Secrets, internal tokens — never leak to the URL | `token`, `session_id`  |
| **repeatable** | Multi-select filters, tags                      | `tag`, `category`      |
| **optional**   | Temporary filters that shouldn't persist         | `filter`, `highlight`  |
| **static**     | Pagination or versioning that initializes once   | `_page`, `_per_page`   |
| *(regular)*    | Everything else — normal key/value pairs         | `q`, `sort`, `name`    |

## Design principles

- **Pure functions** — no internal mutable state. Pass data in, get data out.
- **Standard types** — operates on `URLSearchParams` throughout. No wrapper objects to unwrap.
- **Zero dependencies** — only uses the web-standard `URLSearchParams` API.
- **Flexible input** — all operations accept `URLSearchParams`, query strings, or plain objects.
- **Framework-agnostic** — works in browsers, Node, Deno, Bun, or any runtime with `URLSearchParams`.

## Development

```bash
pnpm install
pnpm test          # run tests once
pnpm test:watch    # run tests in watch mode
pnpm lint          # oxlint
pnpm fmt           # oxfmt (write)
pnpm fmt:check     # oxfmt (check, for CI)
pnpm build         # compile to dist/
```

## License

MIT
