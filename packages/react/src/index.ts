import { useSyncExternalStore, useCallback, useMemo } from "react";
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

function subscribe(cb: () => void): () => void {
  window.addEventListener("popstate", cb);
  window.addEventListener(CHANGE_EVENT, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(CHANGE_EVENT, cb);
  };
}

function getSnapshot(): string {
  return window.location.search;
}

function getServerSnapshot(): string {
  return "";
}

export function useQParams(schema: Schema) {
  const search = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const params = useMemo(() => constrain(schema, search), [schema, search]);

  const update = useCallback(
    (incoming: ParamsInput) => {
      const next = merge(schema, fromURL(window.location.href), incoming);
      pushURL(next.toString());
    },
    [schema],
  );

  const strip = useCallback(
    (options: { static?: boolean; forbidden?: boolean } = {}) => {
      return without(schema, params, options);
    },
    [schema, params],
  );

  return {
    params,
    update,
    strip,
    toObject: () => toObject(params),
  };
}
