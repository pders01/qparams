/**
 * Defines how query parameters should be classified.
 *
 * - **forbidden**: Params that are silently stripped on constrain/merge.
 * - **repeatable**: Params that may appear multiple times (e.g. `tag=a&tag=b`).
 * - **optional**: Params that are kept only when explicitly provided; removed otherwise.
 * - **static**: Params that are set once and never overwritten by incoming values.
 *
 * Any param not listed in any category is treated as a regular param
 * (last-write-wins on set).
 */
export interface SchemaOptions {
  forbidden?: string[];
  repeatable?: string[];
  optional?: string[];
  static?: string[];
  hooks?: Hooks;
  validate?: (schema: Schema) => void;
}

export interface Hooks {
  onConstrain?: (incoming: URLSearchParams, result: URLSearchParams) => void;
  onMerge?: (current: URLSearchParams, incoming: URLSearchParams, result: URLSearchParams) => void;
  onWithout?: (input: URLSearchParams, result: URLSearchParams) => void;
}

export interface Schema {
  forbidden: ReadonlySet<string>;
  repeatable: ReadonlySet<string>;
  optional: ReadonlySet<string>;
  static: ReadonlySet<string>;
  hooks: Hooks;
}

export function createSchema(options: SchemaOptions = {}): Schema {
  const schema: Schema = {
    forbidden: new Set(options.forbidden),
    repeatable: new Set(options.repeatable),
    optional: new Set(options.optional),
    static: new Set(options.static),
    hooks: options.hooks ?? {},
  };

  options.validate?.(schema);

  return schema;
}
