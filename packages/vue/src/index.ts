import { ref, computed, onMounted, onUnmounted } from "vue";
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

export function useQParams(schema: Schema) {
  const search = ref(typeof window !== "undefined" ? window.location.search : "");
  const params = computed(() => constrain(schema, search.value));

  function onChange() {
    search.value = window.location.search;
  }

  onMounted(() => {
    window.addEventListener("popstate", onChange);
    window.addEventListener(CHANGE_EVENT, onChange);
  });

  onUnmounted(() => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  });

  function update(incoming: ParamsInput) {
    const next = merge(schema, fromURL(window.location.href), incoming);
    pushURL(next.toString());
  }

  function strip(options: { static?: boolean; forbidden?: boolean } = {}) {
    return without(schema, params.value, options);
  }

  return {
    params,
    update,
    strip,
    toObject: () => toObject(params.value),
  };
}
