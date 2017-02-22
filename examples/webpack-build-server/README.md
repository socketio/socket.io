
# Socket.IO WebPack build

A sample Webpack build for the server.

## How to use

```
$ npm i
$ npm run build
$ npm start
```

**Note:**

- the `bufferutil` and `utf-8-validate` are optional dependencies from `ws`, compiled from native code, which are meant to improve performance ([ref](https://github.com/websockets/ws#opt-in-for-performance)). You can also omit them, as they have their JS fallback, and ignore the WebPack warning.

- the server is initiated with `serveClient` set to `false`, so it will not serve the client file.
