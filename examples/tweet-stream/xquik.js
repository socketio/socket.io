const SEARCH_ENDPOINT = "https://xquik.com/api/v1/x/tweets/search";
const MAX_TWEETS = 10;
const MAX_SEEN_TWEETS = 100;

function createTweetSource({ apiKey, query, fetchImpl = globalThis.fetch }) {
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error("XQUIK_API_KEY is required");
  }
  if (typeof query !== "string" || query.trim() === "") {
    throw new Error("XQUIK_QUERY must not be empty");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("Node.js 18 or newer is required");
  }

  let newestId;
  const seenIds = new Set();

  return {
    async fetchLatest() {
      const url = new URL(SEARCH_ENDPOINT);
      url.searchParams.set("q", query);
      url.searchParams.set("queryType", "Latest");
      url.searchParams.set("limit", String(MAX_TWEETS));
      url.searchParams.set("replies", "exclude");
      url.searchParams.set("retweets", "exclude");
      if (newestId) {
        url.searchParams.set("sinceId", newestId);
      }

      const response = await fetchImpl(url, {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (!payload || !Array.isArray(payload.tweets)) {
        throw new Error("Unexpected response shape");
      }

      const uniqueTweets = new Map();
      for (const value of payload.tweets) {
        const tweet = normalizeTweet(value);
        if (tweet && !seenIds.has(tweet.id)) {
          uniqueTweets.set(tweet.id, tweet);
        }
      }

      const result = [...uniqueTweets.values()].sort(compareTweetIds);
      if (result.length > 0) {
        const candidateId = result.at(-1).id;
        if (!newestId || BigInt(candidateId) > BigInt(newestId)) {
          newestId = candidateId;
        }
        for (const tweet of result) {
          seenIds.add(tweet.id);
        }
        while (seenIds.size > MAX_SEEN_TWEETS) {
          seenIds.delete(seenIds.values().next().value);
        }
      }
      return result;
    },
  };
}

function normalizeTweet(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const id = typeof value.id === "string" ? value.id : "";
  if (!/^\d{15,20}$/.test(id) || typeof value.text !== "string") {
    return null;
  }

  return {
    id,
    text: value.text,
    createdAt: stringOrNull(value.createdAt),
    likeCount: countOrNull(value.likeCount),
    replyCount: countOrNull(value.replyCount),
    retweetCount: countOrNull(value.retweetCount),
    quoteCount: countOrNull(value.quoteCount),
    viewCount: countOrNull(value.viewCount),
    author: normalizeAuthor(value.author),
  };
}

function normalizeAuthor(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    id: stringOrNull(value.id),
    username: stringOrNull(value.username),
    name: stringOrNull(value.name),
    profilePicture: stringOrNull(value.profilePicture),
  };
}

function stringOrNull(value) {
  return typeof value === "string" ? value : null;
}

function countOrNull(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function compareTweetIds(left, right) {
  const leftId = BigInt(left.id);
  const rightId = BigInt(right.id);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

function parsePollInterval(value) {
  const interval = Number(value || 60_000);
  if (!Number.isInteger(interval) || interval < 10_000) {
    throw new Error(
      "XQUIK_POLL_INTERVAL_MS must be an integer of at least 10000",
    );
  }
  return interval;
}

module.exports = { createTweetSource, parsePollInterval };
