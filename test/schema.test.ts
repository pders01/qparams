import { describe, it, expect } from "vitest";
import { createSchema } from "../src/schema.js";

describe("createSchema", () => {
  it("should create a schema with all categories", () => {
    const schema = createSchema({
      forbidden: ["token"],
      repeatable: ["tag"],
      optional: ["filter"],
      static: ["_page"],
    });

    expect(schema.forbidden.has("token")).toBe(true);
    expect(schema.repeatable.has("tag")).toBe(true);
    expect(schema.optional.has("filter")).toBe(true);
    expect(schema.static.has("_page")).toBe(true);
  });

  it("should call validate with the built schema", () => {
    expect(() =>
      createSchema({
        forbidden: ["tag"],
        repeatable: ["tag"],
        validate(schema) {
          const seen = new Set<string>();
          for (const category of [
            schema.forbidden,
            schema.repeatable,
            schema.optional,
            schema.static,
          ]) {
            for (const key of category) {
              if (seen.has(key)) throw new Error(`Key "${key}" appears in multiple categories`);
              seen.add(key);
            }
          }
        },
      }),
    ).toThrow('Key "tag" appears in multiple categories');
  });

  it("should not throw when validate passes", () => {
    expect(() =>
      createSchema({
        forbidden: ["token"],
        repeatable: ["tag"],
        validate() {
          /* no-op — all good */
        },
      }),
    ).not.toThrow();
  });

  it("should default to empty sets", () => {
    const schema = createSchema();

    expect(schema.forbidden.size).toBe(0);
    expect(schema.repeatable.size).toBe(0);
    expect(schema.optional.size).toBe(0);
    expect(schema.static.size).toBe(0);
  });
});
