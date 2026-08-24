# X tweet stream

This example searches recent public X posts with Xquik. It broadcasts new
matches to every Socket.IO client.

The server emits 2 events:

- `buffer` contains the 10 most recent posts when a client connects.
- `tweet` contains each new post found after polling.

## Run the example

Use Node.js 18 or newer. Create an API key in Xquik, then run:

```bash
npm install
export XQUIK_API_KEY=xq_your_api_key_here
npm start
```

The Socket.IO server listens on port `3000` by default.

## Configuration

| Variable                 | Required | Default                     | Purpose                                                                                           |
| ------------------------ | -------- | --------------------------- | ------------------------------------------------------------------------------------------------- |
| `XQUIK_API_KEY`          | Yes      | None                        | Authenticates the [Xquik tweet search API](https://docs.xquik.com/api-reference/x/search-tweets). |
| `XQUIK_QUERY`            | No       | `"socket.io" OR javascript` | Sets the X search query.                                                                          |
| `XQUIK_POLL_INTERVAL_MS` | No       | `60000`                     | Sets the poll interval. The minimum is 10 seconds.                                                |
| `PORT`                   | No       | `3000`                      | Sets the Socket.IO server port.                                                                   |

The example requests up to 10 latest posts per poll. It excludes replies and
reposts. Later requests use the newest post ID to avoid replaying old results.

Treat post text as untrusted data. Render it as text, not HTML.

## Test the source

```bash
npm test
```
