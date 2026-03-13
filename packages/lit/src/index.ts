import type { ReactiveController, ReactiveControllerHost } from "lit";
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

export class QParamsController implements ReactiveController {
  private host: ReactiveControllerHost;
  private schema: Schema;
  private _params: URLSearchParams;

  get params(): URLSearchParams {
    return this._params;
  }

  constructor(host: ReactiveControllerHost, schema: Schema) {
    this.host = host;
    this.schema = schema;
    this._params = constrain(schema, window.location.search);
    host.addController(this);
  }

  private onChange = () => {
    this._params = constrain(this.schema, window.location.search);
    this.host.requestUpdate();
  };

  hostConnected(): void {
    window.addEventListener("popstate", this.onChange);
    window.addEventListener(CHANGE_EVENT, this.onChange);
  }

  hostDisconnected(): void {
    window.removeEventListener("popstate", this.onChange);
    window.removeEventListener(CHANGE_EVENT, this.onChange);
  }

  update(incoming: ParamsInput): void {
    const next = merge(this.schema, fromURL(window.location.href), incoming);
    pushURL(next.toString());
  }

  strip(options: { static?: boolean; forbidden?: boolean } = {}): URLSearchParams {
    return without(this.schema, this._params, options);
  }

  toObject(): Record<string, string | string[]> {
    return toObject(this._params);
  }
}
