# History

| Version                                                                                                     | Release date   |
|-------------------------------------------------------------------------------------------------------------|----------------|
| [3.3.4](#334-2024-07-22) (from the [3.3.x](https://github.com/socketio/socket.io-parser/tree/3.3.x) branch) | July 2024      |
| [4.2.4](#424-2023-05-31)                                                                                    | May 2023       |
| [3.4.3](#343-2023-05-22) (from the [3.4.x](https://github.com/socketio/socket.io-parser/tree/3.4.x) branch) | May 2023       |
| [4.2.3](#423-2023-05-22)                                                                                    | May 2023       |
| [4.2.2](#422-2023-01-19)                                                                                    | January 2023   |
| [3.3.3](#333-2022-11-09) (from the [3.3.x](https://github.com/socketio/socket.io-parser/tree/3.3.x) branch) | November 2022  |
| [3.4.2](#342-2022-11-09) (from the [3.4.x](https://github.com/socketio/socket.io-parser/tree/3.4.x) branch) | November 2022  |
| [4.0.5](#405-2022-06-27) (from the [4.0.x](https://github.com/socketio/socket.io-parser/tree/4.0.x) branch) | June 2022      |
| [4.2.1](#421-2022-06-27)                                                                                    | June 2022      |
| [4.2.0](#420-2022-04-17)                                                                                    | April 2022     |
| [4.1.2](#412-2022-02-17)                                                                                    | February 2022  |
| [3.3.3](#333-2022-11-09) (from the [3.3.x](https://github.com/socketio/socket.io-parser/tree/3.3.x) branch) | November 2022  |
| [3.4.2](#342-2022-11-09) (from the [3.4.x](https://github.com/socketio/socket.io-parser/tree/3.4.x) branch) | November 2022  |
| [4.0.5](#405-2022-06-27) (from the [4.0.x](https://github.com/socketio/socket.io-parser/tree/4.0.x) branch) | June 2022      |
| [4.2.1](#421-2022-06-27)                                                                                    | June 2022      |
| [4.2.0](#420-2022-04-17)                                                                                    | April 2022     |
| [4.1.2](#412-2022-02-17)                                                                                    | February 2022  |
| [4.1.1](#411-2021-10-14)                                                                                    | October 2021   |
| [4.1.0](#410-2021-10-11)                                                                                    | October 2021   |
| [4.0.4](#404-2021-01-15)                                                                                    | January 2021   |
| [3.3.2](#332-2021-01-09) (from the [3.3.x](https://github.com/socketio/socket.io-parser/tree/3.3.x) branch) | January 2021   |
| [4.0.3](#403-2021-01-05)                                                                                    | January 2021   |
| [4.0.2](#402-2020-11-25)                                                                                    | November 2020  |
| [4.0.1](#401-2020-11-05)                                                                                    | November 2020  |
| [3.3.1](#331-2020-09-30) (from the [3.3.x](https://github.com/socketio/socket.io-parser/tree/3.3.x) branch) | September 2020 |
| [**4.0.0**](#400-2020-09-28)                                                                                | September 2020 |
| [3.4.1](#341-2020-05-13)                                                                                    | May 2020       |
| [3.4.0](#340-2019-09-20)                                                                                    | September 2019 |
| [3.3.0](#330-2018-11-07)                                                                                    | November 2018  |


# Release notes

## [3.3.4](https://github.com/Automattic/socket.io-parser/compare/3.3.3...3.3.4) (2024-07-22)


### Bug Fixes

* check the format of the event name ([#125](https://github.com/Automattic/socket.io-parser/issues/125)) ([ee00660](https://github.com/Automattic/socket.io-parser/commit/ee006607495eca4ec7262ad080dd3a91439a5ba4))



## [4.2.4](https://github.com/socketio/socket.io-parser/compare/4.2.3...4.2.4) (2023-05-31)


### Bug Fixes

* ensure reserved events cannot be used as event names ([d9db473](https://github.com/socketio/socket.io-parser/commit/d9db4737a3c8ce5f1f49ecc8d928a74f3da591f7))
* properly detect plain objects ([b0e6400](https://github.com/socketio/socket.io-parser/commit/b0e6400c93b5c4aa25e6a629d6448b8627275213))



## [3.4.3](https://github.com/socketio/socket.io-parser/compare/3.4.2...3.4.3) (2023-05-22)


### Bug Fixes

* check the format of the event name ([2dc3c92](https://github.com/socketio/socket.io-parser/commit/2dc3c92622dad113b8676be06f23b1ed46b02ced))



## [4.2.3](https://github.com/socketio/socket.io-parser/compare/4.2.2...4.2.3) (2023-05-22)


### Bug Fixes

* check the format of the event name ([3b78117](https://github.com/socketio/socket.io-parser/commit/3b78117bf6ba7e99d7a5cfc1ba54d0477554a7f3))



## [4.2.2](https://github.com/socketio/socket.io-parser/compare/4.2.1...4.2.2) (2023-01-19)


### Bug Fixes

* calling destroy() should clear all internal state ([22c42e3](https://github.com/socketio/socket.io-parser/commit/22c42e3545e4adbc5931276c378f5d62c8b3854a))
* do not modify the input packet upon encoding ([ae8dd88](https://github.com/socketio/socket.io-parser/commit/ae8dd88995dbd7f89c97e5cc15e5b489fa0efece))



## [3.3.3](https://github.com/Automattic/socket.io-parser/compare/3.3.2...3.3.3) (2022-11-09)


### Bug Fixes

* check the format of the index of each attachment ([fb21e42](https://github.com/Automattic/socket.io-parser/commit/fb21e422fc193b34347395a33e0f625bebc09983))



## [3.4.2](https://github.com/socketio/socket.io-parser/compare/3.4.1...3.4.2) (2022-11-09)


### Bug Fixes

* check the format of the index of each attachment ([04d23ce](https://github.com/socketio/socket.io-parser/commit/04d23cecafe1b859fb03e0cbf6ba3b74dff56d14))



## [4.2.1](https://github.com/socketio/socket.io-parser/compare/4.2.0...4.2.1) (2022-06-27)


### Bug Fixes

* check the format of the index of each attachment ([b5d0cb7](https://github.com/socketio/socket.io-parser/commit/b5d0cb7dc56a0601a09b056beaeeb0e43b160050))



## [4.0.5](https://github.com/socketio/socket.io-parser/compare/4.0.4...4.0.5) (2022-06-27)


### Bug Fixes

* check the format of the index of each attachment ([b559f05](https://github.com/socketio/socket.io-parser/commit/b559f050ee02bd90bd853b9823f8de7fa94a80d4))



## [4.2.0](https://github.com/socketio/socket.io-parser/compare/4.1.2...4.2.0) (2022-04-17)


### Features

* allow the usage of custom replacer and reviver ([#112](https://github.com/socketio/socket.io-parser/issues/112)) ([b08bc1a](https://github.com/socketio/socket.io-parser/commit/b08bc1a93e8e3194b776c8a0bdedee1e29333680))



## [4.1.2](https://github.com/socketio/socket.io-parser/compare/4.1.1...4.1.2) (2022-02-17)


### Bug Fixes

* allow objects with a null prototype in binary packets ([#114](https://github.com/socketio/socket.io-parser/issues/114)) ([7f6b262](https://github.com/socketio/socket.io-parser/commit/7f6b262ac83bdf43c53a7eb02417e56e0cf491c8))



## [4.1.1](https://github.com/socketio/socket.io-parser/compare/4.1.0...4.1.1) (2021-10-14)


## [4.1.0](https://github.com/socketio/socket.io-parser/compare/4.0.4...4.1.0) (2021-10-11)


### Features

* provide an ESM build with and without debug ([388c616](https://github.com/socketio/socket.io-parser/commit/388c616a9221e4341945f8487e729e93a81d2da5))


## [4.0.4](https://github.com/socketio/socket.io-parser/compare/4.0.3...4.0.4) (2021-01-15)


### Bug Fixes

* allow integers as event names ([1c220dd](https://github.com/socketio/socket.io-parser/commit/1c220ddbf45ea4b44bc8dbf6f9ae245f672ba1b9))



## [3.3.2](https://github.com/Automattic/socket.io-parser/compare/3.3.1...3.3.2) (2021-01-09)


### Bug Fixes

* prevent DoS (OOM) via massive packets ([#95](https://github.com/Automattic/socket.io-parser/issues/95)) ([89197a0](https://github.com/Automattic/socket.io-parser/commit/89197a05c43b18cc4569fd178d56e7bb8f403865))



## [4.0.3](https://github.com/socketio/socket.io-parser/compare/4.0.2...4.0.3) (2021-01-05)


## [4.0.2](https://github.com/socketio/socket.io-parser/compare/4.0.1...4.0.2) (2020-11-25)


### Bug Fixes

* move @types/component-emitter to dependencies ([#99](https://github.com/socketio/socket.io-parser/issues/99)) ([4efa005](https://github.com/socketio/socket.io-parser/commit/4efa005846ae15ecc7fb0a7f27141439113b1179))


## [4.0.1](https://github.com/socketio/socket.io-parser/compare/3.4.1...4.0.1) (2020-11-05)

### Features

* move binary detection back to the parser ([285e7cd](https://github.com/socketio/socket.io-parser/commit/285e7cd0d837adfc911c999e7294788681226ae1))
* add support for a payload in a CONNECT packet ([78f9fc2](https://github.com/socketio/socket.io-parser/commit/78f9fc2999b15804b02f2c22a2b4007734a26af9))

### Bug Fixes

* do not catch encoding errors ([aeae87c](https://github.com/socketio/socket.io-parser/commit/aeae87c220287197cb78370dbd86b950a7dd29eb))
* throw upon invalid payload format ([c327acb](https://github.com/socketio/socket.io-parser/commit/c327acbc3c3c2d0b2b439136cbcb56c81db173d6))

### BREAKING CHANGES

* the encode method is now synchronous ([28d4f03](https://github.com/socketio/socket.io-parser/commit/28d4f0309bdd9e306b78d1946d3e1760941d6544))



## [4.0.1-rc3](https://github.com/socketio/socket.io-parser/compare/4.0.1-rc2...4.0.1-rc3) (2020-10-25)



## [4.0.1-rc2](https://github.com/socketio/socket.io-parser/compare/4.0.1-rc1...4.0.1-rc2) (2020-10-15)


### Features

* move binary detection back to the parser ([285e7cd](https://github.com/socketio/socket.io-parser/commit/285e7cd0d837adfc911c999e7294788681226ae1))



## [4.0.1-rc1](https://github.com/socketio/socket.io-parser/compare/4.0.0...4.0.1-rc1) (2020-10-12)


### Features

* add support for a payload in a CONNECT packet ([78f9fc2](https://github.com/socketio/socket.io-parser/commit/78f9fc2999b15804b02f2c22a2b4007734a26af9))



## [3.3.1](https://github.com/socketio/socket.io-parser/compare/3.3.0...3.3.1) (2020-09-30)


## [4.0.0](https://github.com/socketio/socket.io-parser/compare/3.4.1...4.0.0) (2020-09-28)

This release will be included in Socket.IO v3.

There is a breaking API change (see below), but the exchange [protocol](https://github.com/socketio/socket.io-protocol) is left untouched and thus stays in version 4.

### Bug Fixes

* do not catch encoding errors ([aeae87c](https://github.com/socketio/socket.io-parser/commit/aeae87c220287197cb78370dbd86b950a7dd29eb))
* throw upon invalid payload format ([c327acb](https://github.com/socketio/socket.io-parser/commit/c327acbc3c3c2d0b2b439136cbcb56c81db173d6))


### BREAKING CHANGES

* the encode method is now synchronous ([28d4f03](https://github.com/socketio/socket.io-parser/commit/28d4f0309bdd9e306b78d1946d3e1760941d6544))



## [3.4.1](https://github.com/socketio/socket.io-parser/compare/3.4.0...3.4.1) (2020-05-13)


### Bug Fixes

* prevent DoS (OOM) via massive packets ([#95](https://github.com/socketio/socket.io-parser/issues/95)) ([dcb942d](https://github.com/socketio/socket.io-parser/commit/dcb942d24db97162ad16a67c2a0cf30875342d55))



## [3.4.0](https://github.com/socketio/socket.io-parser/compare/3.3.0...3.4.0) (2019-09-20)



## [3.3.0](https://github.com/socketio/socket.io-parser/compare/3.2.0...3.3.0) (2018-11-07)


### Bug Fixes

* remove any reference to the `global` variable ([b47efb2](https://github.com/socketio/socket.io-parser/commit/b47efb2))
