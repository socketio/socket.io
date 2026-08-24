const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { createTweetSource, parsePollInterval } = require("./xquik");

const tweet = {
  id: "2036000000000000001",
  text: "Socket.IO test",
  createdAt: "2026-08-24T00:00:00.000Z",
  likeCount: 3,
  replyCount: 2,
  retweetCount: 1,
  quoteCount: 0,
  viewCount: 20,
  author: {
    id: "123",
    username: "socketio",
    name: "Socket.IO",
    profilePicture: "https://example.com/avatar.png",
  },
};

describe("Xquik tweet source", () => {
  it("builds an authenticated latest search request", async () => {
    let request;
    const source = createTweetSource({
      apiKey: "secret",
      query: '"socket.io" OR javascript',
      fetchImpl: async (...args) => {
        request = args;
        return response({ tweets: [tweet] });
      },
    });

    assert.deepEqual(await source.fetchLatest(), [tweet]);
    const [url, options] = request;
    assert.equal(
      url.origin + url.pathname,
      "https://xquik.com/api/v1/x/tweets/search",
    );
    assert.equal(url.searchParams.get("q"), '"socket.io" OR javascript');
    assert.equal(url.searchParams.get("queryType"), "Latest");
    assert.equal(url.searchParams.get("limit"), "10");
    assert.equal(url.searchParams.get("replies"), "exclude");
    assert.equal(url.searchParams.get("retweets"), "exclude");
    assert.equal(url.searchParams.has("sinceId"), false);
    assert.deepEqual(options.headers, { "x-api-key": "secret" });
    assert.ok(options.signal instanceof AbortSignal);
  });

  it("uses the newest ID on the next request", async () => {
    const urls = [];
    const source = createTweetSource({
      apiKey: "secret",
      query: "socket.io",
      fetchImpl: async (url) => {
        urls.push(url);
        return response({ tweets: [tweet] });
      },
    });

    assert.deepEqual(await source.fetchLatest(), [tweet]);
    assert.deepEqual(await source.fetchLatest(), []);

    assert.equal(urls[1].searchParams.get("sinceId"), tweet.id);
  });

  it("sorts tweets, removes duplicates, and limits public fields", async () => {
    const older = { ...tweet, id: "2036000000000000000", private: "drop me" };
    const source = createTweetSource({
      apiKey: "secret",
      query: "socket.io",
      fetchImpl: async () => response({ tweets: [tweet, older, older] }),
    });

    const result = await source.fetchLatest();

    assert.deepEqual(
      result.map((item) => item.id),
      [older.id, tweet.id],
    );
    assert.equal("private" in result[0], false);
  });

  it("drops malformed tweet rows and unsafe counts", async () => {
    const source = createTweetSource({
      apiKey: "secret",
      query: "socket.io",
      fetchImpl: async () =>
        response({
          tweets: [
            null,
            { id: "not-an-id", text: "bad" },
            { id: 2036000000000000002, text: "unsafe numeric ID" },
            { ...tweet, likeCount: -1, viewCount: Number.MAX_SAFE_INTEGER + 1 },
          ],
        }),
    });

    const result = await source.fetchLatest();

    assert.equal(result.length, 1);
    assert.equal(result[0].likeCount, null);
    assert.equal(result[0].viewCount, null);
  });

  it("rejects missing configuration", () => {
    assert.throws(
      () => createTweetSource({ apiKey: "", query: "socket.io" }),
      /XQUIK_API_KEY is required/,
    );
    assert.throws(
      () => createTweetSource({ apiKey: "secret", query: "" }),
      /XQUIK_QUERY must not be empty/,
    );
  });

  it("reports HTTP status without exposing the response body", async () => {
    const source = createTweetSource({
      apiKey: "secret",
      query: "socket.io",
      fetchImpl: async () =>
        response({ error: "sensitive upstream detail" }, 429),
    });

    await assert.rejects(source.fetchLatest(), /^Error: HTTP 429$/);
  });

  it("rejects unexpected response bodies", async () => {
    const source = createTweetSource({
      apiKey: "secret",
      query: "socket.io",
      fetchImpl: async () => response({ results: [] }),
    });

    await assert.rejects(source.fetchLatest(), /Unexpected response shape/);
  });

  it("validates the polling interval", () => {
    assert.equal(parsePollInterval(undefined), 60_000);
    assert.equal(parsePollInterval("10000"), 10_000);
    assert.throws(
      () => parsePollInterval("9999"),
      /XQUIK_POLL_INTERVAL_MS must be an integer of at least 10000/,
    );
    assert.throws(
      () => parsePollInterval("not-a-number"),
      /XQUIK_POLL_INTERVAL_MS must be an integer of at least 10000/,
    );
  });
});

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}
