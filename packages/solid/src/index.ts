import { createSignal, createMemo, onCleanup } from "solid-js";
import { constrain, merge, without, toObject, fromURL } from "@jpahd/qparams";
import type { Schema } from "@jpahd/qparams";

type ParamsInput = URLSearchParams | string | Record<string, string>;

const CHANGE_EVENT = "qparams:change";

function pushURL(search: string): void {
  const url = new URL(window.location.href);
  url.search = search;
  window.history.pushState({}, "", url);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function createQParams(schema: Schema) {
  const [search, setSearch] = createSignal(
    typeof window !== "undefined" ? window.location.search : "",
  );

  const onChange = () => setSearch(window.location.search);
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  onCleanup(() => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  });

  const params = createMemo(() => constrain(schema, search()));

  function update(incoming: ParamsInput): void {
    const next = merge(schema, fromURL(window.location.href), incoming);
    pushURL(next.toString());
  }

  function strip(options: { static?: boolean; forbidden?: boolean } = {}): URLSearchParams {
    return without(schema, params(), options);
  }

  return {
    params,
    update,
    strip,
    toObject: () => toObject(params()),
  };
}
