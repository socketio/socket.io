import { Polling } from "./polling.js";
import { CookieJar, createCookieJar } from "./xmlhttprequest.js";

/**
 * HTTP long-polling based on `fetch()`
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/fetch
 */
export class Fetch extends Polling {
  private readonly cookieJar?: CookieJar;

  constructor(opts) {
    super(opts);

    if (this.opts.withCredentials) {
      this.cookieJar = createCookieJar();
    }
  }

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

    this.cookieJar?.appendCookies(headers);

    return fetch(this.uri(), {
      method: isPost ? "POST" : "GET",
      body: isPost ? data : null,
      headers,
      credentials: this.opts.withCredentials ? "include" : "omit",
    }).then((res) => {
      if (this.cookieJar) {
        // @ts-ignore getSetCookie() was added in Node.js v19.7.0
        this.cookieJar.parseCookies(res.headers.getSetCookie());
      }

      return res;
    });
  }
}
