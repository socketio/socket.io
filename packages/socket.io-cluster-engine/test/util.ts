import expect = require("expect.js");

export function url(port: number, sid?: string) {
  let url = `http://localhost:${port}/engine.io/?EIO=4&transport=polling`;
  if (sid) {
    url += `&sid=${sid}`;
  }
  return url;
}

export async function handshake(port: number) {
  const res = await fetch(url(port));
  expect(res.status).to.eql(200);

  const body1 = await res.text();
  return JSON.parse(body1.substring(1)).sid;
}
