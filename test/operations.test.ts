import { describe, it, expect } from "vitest";
import { createSchema } from "../src/schema.js";
import { constrain, fromURL, merge, without, get, getAll, toObject } from "../src/operations.js";

describe("constrain", () => {
  it("should drop forbidden params", () => {
    const schema = createSchema({ forbidden: ["token", "secret"] });
    const result = constrain(schema, "token=abc&name=test&secret=xyz");

    expect(result.has("token")).toBe(false);
    expect(result.has("secret")).toBe(false);
    expect(result.get("name")).toBe("test");
  });

  it("should append repeatable params", () => {
    const schema = createSchema({ repeatable: ["tag"] });
    const result = constrain(schema, "tag=a&tag=b&tag=c");

    expect(result.getAll("tag")).toEqual(["a", "b", "c"]);
  });

  it("should not overwrite static params already in base", () => {
    const schema = createSchema({ static: ["version"] });
    const base = new URLSearchParams("version=1");
    const result = constrain(schema, "version=2&name=test", base);

    expect(result.get("version")).toBe("1");
    expect(result.get("name")).toBe("test");
  });

  it("should set static params if not in base", () => {
    const schema = createSchema({ static: ["version"] });
    const result = constrain(schema, "version=1");

    expect(result.get("version")).toBe("1");
  });

  it("should use last-write-wins for regular params", () => {
    const schema = createSchema();
    const result = constrain(schema, "name=first&name=second");

    expect(result.get("name")).toBe("second");
  });

  it("should accept a Record<string, string> as input", () => {
    const schema = createSchema();
    const result = constrain(schema, { name: "test", color: "blue" });

    expect(result.get("name")).toBe("test");
    expect(result.get("color")).toBe("blue");
  });
});

describe("merge", () => {
  it("should diff repeatable params: keep shared, add new, remove old", () => {
    const schema = createSchema({ repeatable: ["tag"] });
    const current = new URLSearchParams("tag=a&tag=b");
    const result = merge(schema, current, "tag=b&tag=c");

    const tags = result.getAll("tag");
    expect(tags).toContain("b");
    expect(tags).toContain("c");
    expect(tags).not.toContain("a");
  });

  it("should drop optional params from current before merging", () => {
    const schema = createSchema({ optional: ["filter"] });
    const current = new URLSearchParams("filter=active&name=test");

    // incoming doesn't mention filter => it gets dropped
    const result = merge(schema, current, "name=updated");
    expect(result.has("filter")).toBe(false);
    expect(result.get("name")).toBe("updated");
  });

  it("should keep optional params when re-supplied in incoming", () => {
    const schema = createSchema({ optional: ["filter"] });
    const current = new URLSearchParams("filter=active");
    const result = merge(schema, current, "filter=inactive");

    expect(result.get("filter")).toBe("inactive");
  });

  it("should not overwrite static params via merge", () => {
    const schema = createSchema({ static: ["_page"] });
    const current = new URLSearchParams("_page=1&name=test");
    const result = merge(schema, current, "_page=99&name=updated");

    expect(result.get("_page")).toBe("1");
    expect(result.get("name")).toBe("updated");
  });

  it("should drop forbidden params from incoming", () => {
    const schema = createSchema({ forbidden: ["token"] });
    const current = new URLSearchParams("name=test");
    const result = merge(schema, current, "token=hack&color=red");

    expect(result.has("token")).toBe(false);
    expect(result.get("color")).toBe("red");
  });

  it("should overwrite regular params (last-write-wins)", () => {
    const schema = createSchema();
    const current = new URLSearchParams("name=old");
    const result = merge(schema, current, "name=new");

    expect(result.get("name")).toBe("new");
  });
});

describe("without", () => {
  it("should strip static params", () => {
    const schema = createSchema({ static: ["_page", "_limit"] });
    const params = new URLSearchParams("_page=1&_limit=20&name=test");
    const result = without(schema, params, { static: true });

    expect(result.has("_page")).toBe(false);
    expect(result.has("_limit")).toBe(false);
    expect(result.get("name")).toBe("test");
  });

  it("should strip forbidden params", () => {
    const schema = createSchema({ forbidden: ["token"] });
    const params = new URLSearchParams("token=abc&name=test");
    const result = without(schema, params, { forbidden: true });

    expect(result.has("token")).toBe(false);
    expect(result.get("name")).toBe("test");
  });

  it("should not mutate the original", () => {
    const schema = createSchema({ static: ["_page"] });
    const original = new URLSearchParams("_page=1&name=test");
    without(schema, original, { static: true });

    expect(original.has("_page")).toBe(true);
  });
});

describe("get / getAll", () => {
  it("should return single values", () => {
    const params = new URLSearchParams("a=1&b=2");
    expect(get(params, "a")).toBe("1");
    expect(get(params, "missing")).toBeNull();
  });

  it("should return all values for repeatable keys", () => {
    const params = new URLSearchParams("tag=a&tag=b&tag=c");
    expect(getAll(params, "tag")).toEqual(["a", "b", "c"]);
  });
});

describe("fromURL", () => {
  it("should extract search params from a URL string", () => {
    const params = fromURL("https://example.com/path?name=test&color=blue");
    expect(params.get("name")).toBe("test");
    expect(params.get("color")).toBe("blue");
  });

  it("should extract search params from a URL object", () => {
    const params = fromURL(new URL("https://example.com?tag=a&tag=b"));
    expect(params.getAll("tag")).toEqual(["a", "b"]);
  });

  it("should return empty params for a URL with no query string", () => {
    const params = fromURL("https://example.com/path");
    expect([...params]).toEqual([]);
  });
});

describe("toObject", () => {
  it("should convert singular keys to strings", () => {
    const params = new URLSearchParams("name=test&color=blue");
    expect(toObject(params)).toEqual({ name: "test", color: "blue" });
  });

  it("should convert repeated keys to arrays", () => {
    const params = new URLSearchParams("tag=a&tag=b&name=test");
    expect(toObject(params)).toEqual({ tag: ["a", "b"], name: "test" });
  });
});

describe("hooks", () => {
  it("should fire onConstrain after constrain", () => {
    const calls: string[][] = [];
    const schema = createSchema({
      forbidden: ["token"],
      hooks: {
        onConstrain(incoming, result) {
          calls.push([...result.keys()]);
        },
      },
    });

    constrain(schema, "token=x&name=test");
    expect(calls).toEqual([["name"]]);
  });

  it("should fire onMerge after merge", () => {
    let captured: { current: string; incoming: string; result: string } | null = null;
    const schema = createSchema({
      hooks: {
        onMerge(current, incoming, result) {
          captured = {
            current: current.toString(),
            incoming: incoming.toString(),
            result: result.toString(),
          };
        },
      },
    });

    merge(schema, "a=1", "b=2");
    expect(captured).toEqual({
      current: "a=1",
      incoming: "b=2",
      result: "a=1&b=2",
    });
  });

  it("should fire onWithout after without", () => {
    let called = false;
    const schema = createSchema({
      static: ["_page"],
      hooks: {
        onWithout(input, result) {
          called = true;
          expect(input.has("_page")).toBe(true);
          expect(result.has("_page")).toBe(false);
        },
      },
    });

    without(schema, "_page=1&name=test", { static: true });
    expect(called).toBe(true);
  });

  it("should not throw when no hooks are defined", () => {
    const schema = createSchema();
    expect(() => constrain(schema, "a=1")).not.toThrow();
    expect(() => merge(schema, "a=1", "b=2")).not.toThrow();
    expect(() => without(schema, "a=1")).not.toThrow();
  });
});
