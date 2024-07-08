import { Polling } from "./polling.js";
import { CookieJar, createCookieJar } from "../globals.node.js";

/**
 * HTTP long-polling based on the built-in `fetch()` method.
 *
 * Usage: browser, Node.js (since v18), Deno, Bun
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/fetch
 * @see https://caniuse.com/fetch
 * @see https://nodejs.org/api/globals.html#fetch
 */
export class Fetch extends Polling {
  override doPoll() {
    this._fetch()
      .then((res) => {
        if (!res.ok) {
          return this.onError("fetch read error", res.status, res);
        }

        res.text().then((data) => this.onData(data));
      })
      .catch((err) => {
        this.onError("fetch read error", err);
      });
  }

  override doWrite(data: string, callback: () => void) {
    this._fetch(data)
      .then((res) => {
        if (!res.ok) {
          return this.onError("fetch write error", res.status, res);
        }

        callback();
      })
      .catch((err) => {
        this.onError("fetch write error", err);
      });
  }

  private _fetch(data?: string) {
    const isPost = data !== undefined;
    const headers = new Headers(this.opts.extraHeaders);

    if (isPost) {
      headers.set("content-type", "text/plain;charset=UTF-8");
    }

    this.socket._cookieJar?.appendCookies(headers);

    return fetch(this.uri(), {
      method: isPost ? "POST" : "GET",
      body: isPost ? data : null,
      headers,
      credentials: this.opts.withCredentials ? "include" : "omit",
    }).then((res) => {
      // @ts-ignore getSetCookie() was added in Node.js v19.7.0
      this.socket._cookieJar?.parseCookies(res.headers.getSetCookie());

      return res;
    });
  }
}
