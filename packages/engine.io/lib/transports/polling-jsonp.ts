import { Polling } from "./polling";
import * as qs from "querystring";
import type { RawData } from "engine.io-parser";
import type { EngineRequest } from "../transport";

const rDoubleSlashes = /\\\\n/g;
const rSlashes = /(\\)?\\n/g;

export class JSONP extends Polling {
  private readonly head: string;
  private readonly foot = ");";

  /**
   * JSON-P polling transport.
   */
  constructor(req: EngineRequest) {
    super(req);

    this.head = "___eio[" + (req._query.j || "").replace(/[^0-9]/g, "") + "](";
  }

  override onData(data: RawData) {
    // we leverage the qs module so that we get built-in DoS protection
    // and the fast alternative to decodeURIComponent
    data = qs.parse(data).d as string;
    if ("string" === typeof data) {
      // client will send already escaped newlines as \\\\n and newlines as \\n
      // \\n must be replaced with \n and \\\\n with \\n
      data = data.replace(rSlashes, (match, slashes) => {
        return slashes ? match : "\n";
      });
      super.onData(data.replace(rDoubleSlashes, "\\n"));
    }
  }

  override doWrite(data: any, options: any, callback: () => void) {
    // we must output valid javascript, not valid json
    // see: http://timelessrepo.com/json-isnt-a-javascript-subset
    const js = JSON.stringify(data)
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");

    // prepare response
    data = this.head + js + this.foot;

    super.doWrite(data, options, callback);
  }
}
