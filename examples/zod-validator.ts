/**
 * Example: using zod to validate a qparams schema.
 *
 * Install zod first: pnpm add zod
 */
import { z } from "zod";
import { createSchema, type Schema } from "../src/index.js";

const categorySet = z.set(z.string());

const schemaValidator = z
  .object({
    forbidden: categorySet,
    repeatable: categorySet,
    optional: categorySet,
    static: categorySet,
  })
  .refine(
    (s) => {
      const seen = new Set<string>();
      for (const category of [s.forbidden, s.repeatable, s.optional, s.static]) {
        for (const key of category) {
          if (seen.has(key)) return false;
          seen.add(key);
        }
      }
      return true;
    },
    { message: "A key must not appear in multiple categories" },
  );

function zodValidate(schema: Schema): void {
  schemaValidator.parse(schema);
}

// Usage:
const schema = createSchema({
  forbidden: ["token"],
  repeatable: ["tag"],
  optional: ["filter"],
  static: ["_page"],
  validate: zodValidate,
});

console.log("Schema created:", schema);
