# History

| Version                      | Date         |
|------------------------------|--------------|
| [3.1.2](#312-2024-04-26)     | April 2024   |
| [3.1.1](#311-2024-04-10)     | April 2024   |
| [**4.0.0**](#400-2022-11-22) | October 2021 |
| [3.1.0](#310-2022-04-17)     | April 2022   |
| [**3.0.0**](#300-2021-10-14) | October 2021 |

# Release notes

## [3.1.2](https://github.com/socketio/emitter/compare/3.1.1...3.1.2) (2024-04-26)


### Bug Fixes

* point towards the CommonJS types ([e6aa1a3](https://github.com/socketio/emitter/commit/e6aa1a331c37697b9de7e91b7db286eac245c8d7))



## [3.1.1](https://github.com/socketio/emitter/compare/4.0.0...3.1.1) (2024-04-10)

This release contains a rework of the dual CommonJS/ES packages. Instead of relying on the `.mjs` file extension, which causes [some problems](https://github.com/socketio/socket.io-client/issues/1598), we will use two `package.json` files, one with `"type": "commonjs"` and the other with `"type": "module"`.



## [4.0.0](https://github.com/socketio/emitter/compare/3.1.0...4.0.0) (2022-11-22)

### BREAKING CHANGES

`emitReserved()` is renamed to `_emitReserved()` in order to enable proper mangling.

New syntax:

```js
import { Emitter } from "@socket.io/component-emitter";

class MyEmitter extends Emitter {
  foo() {
    this._emitReserved("input");
  }
}
```



## [3.1.0](https://github.com/socketio/emitter/compare/3.0.0...3.1.0) (2022-04-17)


### Features

* add ESM version ([54468cf](https://github.com/socketio/emitter/commit/54468cf7a3753f4fde435b70f5df57974588ed68))



## [3.0.0](https://github.com/socketio/emitter/compare/2.0.0...3.0.0) (2021-10-14)


### Features

* add support for typed events ([84397cb](https://github.com/socketio/emitter/commit/84397cb0cd6265e0ee79adbf1607beff12ca9f16))


### BREAKING CHANGES

* we now use a named export instead of a default export

```js
// before
import Emitter from "@socket.io/component-emitter"

// after
import { Emitter } from "@socket.io/component-emitter"
```

[1]: https://github.com/socketio/socket.io-client/blob/a9e5b85580e8edca0b0fd2850c3741d3d86a96e2/lib/typed-events.ts




1.3.0 / 2018-04-15
==================

 * removed bower support
 * expose emitter on `exports`
 * prevent de-optimization from using `arguments`

1.2.1 / 2016-04-18
==================

 * enable client side use

1.2.0 / 2014-02-12
==================

 * prefix events with `$` to support object prototype method names

1.1.3 / 2014-06-20
==================

 * republish for npm
 * add LICENSE file

1.1.2 / 2014-02-10
==================

  * package: rename to "component-emitter"
  * package: update "main" and "component" fields
  * Add license to Readme (same format as the other components)
  * created .npmignore
  * travis stuff

1.1.1 / 2013-12-01
==================

  * fix .once adding .on to the listener
  * docs: Emitter#off()
  * component: add `.repo` prop

1.1.0 / 2013-10-20
==================

 * add `.addEventListener()` and `.removeEventListener()` aliases

1.0.1 / 2013-06-27
==================

 * add support for legacy ie

1.0.0 / 2013-02-26
==================

  * add `.off()` support for removing all listeners

0.0.6 / 2012-10-08
==================

  * add `this._callbacks` initialization to prevent funky gotcha

0.0.5 / 2012-09-07
==================

  * fix `Emitter.call(this)` usage

0.0.3 / 2012-07-11
==================

  * add `.listeners()`
  * rename `.has()` to `.hasListeners()`

0.0.2 / 2012-06-28
==================

  * fix `.off()` with `.once()`-registered callbacks
