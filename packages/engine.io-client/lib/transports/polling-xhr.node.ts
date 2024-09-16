import * as XMLHttpRequestModule from "xmlhttprequest-ssl";
import { BaseXHR, Request, RequestOptions } from "./polling-xhr.js";

const XMLHttpRequest = XMLHttpRequestModule.default || XMLHttpRequestModule;

/**
 * HTTP long-polling based on the `XMLHttpRequest` object provided by the `xmlhttprequest-ssl` package.
 *
 * Usage: Node.js, Deno (compat), Bun (compat)
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
 */
export class XHR extends BaseXHR {
  request(opts: Record<string, any> = {}) {
    Object.assign(
      opts,
      { xd: this.xd, cookieJar: this.socket?._cookieJar },
      this.opts,
    );
    return new Request(
      (opts) => new XMLHttpRequest(opts),
      this.uri(),
      opts as RequestOptions,
    );
  }
}
