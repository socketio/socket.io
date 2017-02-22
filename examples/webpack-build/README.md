
# Socket.IO WebPack build

A sample Webpack build for the browser.

## How to use

```
$ npm i
$ npm run build-all
```

There are two WebPack configuration:

- the minimal configuration, just bundling the application and its dependencies. The `app.js` file in the `dist` folder is the result of that build.

- a slimmer one, where:
  - the JSON polyfill needed for IE6/IE7 support has been removed.
  - the `debug` calls and import have been removed (the [debug](https://github.com/visionmedia/debug) library is included in the build by default).
  - the source has been uglified (dropping IE8 support), and an associated SourceMap has been generated.
