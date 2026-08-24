const { createTweetSource, parsePollInterval } = require("./xquik");

let tweets = [];
const MAX_TWEETS = 10;
const source = createTweetSource({
  apiKey: process.env.XQUIK_API_KEY,
  query: process.env.XQUIK_QUERY || '"socket.io" OR javascript',
});
const pollInterval = parsePollInterval(process.env.XQUIK_POLL_INTERVAL_MS);
const io = require("socket.io")(process.env.PORT || 3000, {
  cors: {
    origin: true,
  },
});
let polling = false;

io.on("connection", (socket) => {
  socket.emit("buffer", tweets);
});

async function poll() {
  if (polling) {
    return;
  }

  polling = true;
  try {
    for (const tweet of await source.fetchLatest()) {
      io.emit("tweet", tweet);
      tweets.unshift(tweet);
    }
    tweets = tweets.slice(0, MAX_TWEETS);
  } catch (err) {
    console.error(`Xquik request failed: ${err.message}`);
  } finally {
    polling = false;
  }
}

poll();
setInterval(poll, pollInterval);
