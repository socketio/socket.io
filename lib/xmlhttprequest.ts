// browser shim for xmlhttprequest module

import hasCORS from "has-cors";
import globalThis from "./globalThis.js";

export default function(opts) {
  const xdomain = opts.xdomain;

  // XMLHttpRequest can be disabled on IE
  try {
    if ("undefined" !== typeof XMLHttpRequest && (!xdomain || hasCORS)) {
      return new XMLHttpRequest();
    }
  } catch (e) {}

  if (!xdomain) {
    try {
      return new globalThis[["Active"].concat("Object").join("X")](
        "Microsoft.XMLHTTP"
      );
    } catch (e) {}
  }
}
