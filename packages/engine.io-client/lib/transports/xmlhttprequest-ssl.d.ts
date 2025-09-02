declare module "xmlhttprequest-ssl" {
  type Options = {
	pfx?: any;
	key?: any;
	passphrase?: string;
	cert?: any;
	ca?: any;
	ciphers?: string;
	rejectUnauthorized?: boolean;
	autoUnref?: boolean;
	agent?: any;
	allowFileSystemResources?: boolean;
	maxRedirects?: number;
	syncPolicy?: "warn" | "strict" | "none";
	disableHeaderCheck?: boolean;
	xmlParser?: (text: string) => any;
	textDecoder?: (buf: Buffer, enc: string) => string;
	origin?: string;
  };
  class XMLHttpRequestSSL extends XMLHttpRequest {
    constructor(opts?: Options);
  }
  export = XMLHttpRequestSSL;
}
