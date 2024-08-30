# History

| Version                                                                                                     | Release date   |
|-------------------------------------------------------------------------------------------------------------|----------------|
| [5.2.3](#523-2024-07-11)                                                                                    | July 2024      |
| [5.2.2](#522-2024-02-05)                                                                                    | February 2024  |
| [5.2.1](#521-2023-08-01)                                                                                    | August 2023    |
| [5.2.0](#520-2023-07-31)                                                                                    | July 2023      |
| [5.1.0](#510-2023-06-11)                                                                                    | June 2023      |
| [5.0.7](#507-2023-05-24)                                                                                    | May 2023       |
| [5.0.6](#506-2023-01-16)                                                                                    | January 2023   |
| [5.0.5](#505-2023-01-06)                                                                                    | January 2023   |
| [5.0.4](#504-2022-04-30)                                                                                    | April 2022     |
| [5.0.3](#503-2022-01-17)                                                                                    | January 2022   |
| [5.0.2](#502-2021-11-14)                                                                                    | November 2021  |
| [5.0.1](#501-2021-10-15)                                                                                    | October 2021   |
| [**5.0.0**](#500-2021-10-04) (major: TypeScript rewrite)                                                    | October 2021   |
| [4.0.3](#403-2021-08-29)                                                                                    | August 2021    |
| [4.0.2](#402-2020-12-07)                                                                                    | December 2020  |
| [2.2.1](#221-2020-09-30) (from the [2.2.x](https://github.com/socketio/engine.io-parser/tree/2.2.x) branch) | September 2020 |
| [4.0.1](#401-2020-09-10)                                                                                    | September 2020 |
| [**4.0.0**](#400-2020-09-08) (major: Engine.IO v4)                                                          | September 2020 |
| [2.2.0](#220-2019-09-13)                                                                                    | September 2019 |

# Release notes

## [5.2.3](https://github.com/socketio/socket.io/compare/engine.io-parser@5.2.2...engine.io-parser@5.2.3) (2024-07-11)


### Bug Fixes

* do not expose the TransformStream type ([f9cb983](https://github.com/socketio/socket.io/commit/f9cb983ab7050c0a1630cfc97eb30f2dd807186b))



## [5.2.2](https://github.com/socketio/engine.io-parser/compare/5.2.1...5.2.2) (2024-02-05)


### Bug Fixes

* **typescript:** properly import the TransformStream type ([0305b4a](https://github.com/socketio/engine.io-parser/commit/0305b4a7a597e0f070ce8ea17106121f9ab369bc))



## [5.2.1](https://github.com/socketio/engine.io-parser/compare/5.2.0...5.2.1) (2023-08-01)

The format of the WebTransport frame has been slightly updated.



## [5.2.0](https://github.com/socketio/engine.io-parser/compare/5.1.0...5.2.0) (2023-07-31)


### Features

* prepend a header to each WebTransport chunk ([6142324](https://github.com/socketio/engine.io-parser/commit/6142324fa61204393028f3f58f336d053030ea5f))



## [5.1.0](https://github.com/socketio/engine.io-parser/compare/5.0.7...5.1.0) (2023-06-11)


### Features

* implement WebTransport-related encoding/decoding ([bed70a4](https://github.com/socketio/engine.io-parser/commit/bed70a4f2598ebdf96d8ccc1b5d838b1a77a4290))



## [5.0.7](https://github.com/socketio/engine.io-parser/compare/5.0.6...5.0.7) (2023-05-24)

The CommonJS build now includes the TypeScript declarations too, in order to be compatible the "node16" moduleResolution.



## [5.0.6](https://github.com/socketio/engine.io-parser/compare/5.0.5...5.0.6) (2023-01-16)

The `compile` script was not run before publishing `5.0.5`, so the esm build did not include the latest changes.



## [5.0.5](https://github.com/socketio/engine.io-parser/compare/5.0.4...5.0.5) (2023-01-06)


### Bug Fixes

* properly encode empty buffer in base64 encoding ([#131](https://github.com/socketio/engine.io-parser/issues/131)) ([351ba82](https://github.com/socketio/engine.io-parser/commit/351ba8245b1aac795646d7e7a9001c8e1d0cc9f2))



## [5.0.4](https://github.com/socketio/engine.io-parser/compare/5.0.3...5.0.4) (2022-04-30)


### Bug Fixes

* add missing file extension for ESM import ([a421bbe](https://github.com/socketio/engine.io-parser/commit/a421bbec7bf43c567c49c608dee604872f6db823))
* **typings:** update the type of RawData ([039b45c](https://github.com/socketio/engine.io-parser/commit/039b45cc65b50acc1f9da42ad605eaccb8ccbcde))



## [5.0.3](https://github.com/socketio/engine.io-parser/compare/5.0.2...5.0.3) (2022-01-17)



## [5.0.2](https://github.com/socketio/engine.io-parser/compare/5.0.1...5.0.2) (2021-11-14)


### Bug Fixes

* add package name in nested package.json ([7e27159](https://github.com/socketio/engine.io-parser/commit/7e271596c3305fb4e4a9fbdcc7fd442e8ff71200))
* fix vite build for CommonJS users ([5f22ed0](https://github.com/socketio/engine.io-parser/commit/5f22ed0527cc80aa0cac415dfd12db2f94f0a855))



## [5.0.1](https://github.com/socketio/engine.io-parser/compare/5.0.0...5.0.1) (2021-10-15)


### Bug Fixes

* fix vite build ([900346e](https://github.com/socketio/engine.io-parser/commit/900346ea34ddc178d80eaabc8ea516d929457855))



## [5.0.0](https://github.com/socketio/engine.io-parser/compare/4.0.3...5.0.0) (2021-10-04)

This release includes the migration to TypeScript. The major bump is due to the new "exports" field in the package.json file.

See also: https://nodejs.org/api/packages.html#packages_package_entry_points

## [4.0.3](https://github.com/socketio/engine.io-parser/compare/4.0.2...4.0.3) (2021-08-29)


### Bug Fixes

* respect the offset and length of TypedArray objects ([6d7dd76](https://github.com/socketio/engine.io-parser/commit/6d7dd76130690afda6c214d5c04305d2bbc4eb4d))


## [4.0.2](https://github.com/socketio/engine.io-parser/compare/4.0.1...4.0.2) (2020-12-07)


### Bug Fixes

* add base64-arraybuffer as prod dependency ([2ccdeb2](https://github.com/socketio/engine.io-parser/commit/2ccdeb277955bed8742a29f2dcbbf57ca95eb12a))


## [2.2.1](https://github.com/socketio/engine.io-parser/compare/2.2.0...2.2.1) (2020-09-30)


## [4.0.1](https://github.com/socketio/engine.io-parser/compare/4.0.0...4.0.1) (2020-09-10)


### Bug Fixes

* use a terser-compatible representation of the separator ([886f9ea](https://github.com/socketio/engine.io-parser/commit/886f9ea7c4e717573152c31320f6fb6c6664061b))


## [4.0.0](https://github.com/socketio/engine.io-parser/compare/v4.0.0-alpha.1...4.0.0) (2020-09-08)

This major release contains the necessary changes for the version 4 of the Engine.IO protocol. More information about the new version can be found [there](https://github.com/socketio/engine.io-protocol#difference-between-v3-and-v4).

Encoding changes between v3 and v4:

- encodePacket with string
  - input: `{ type: "message", data: "hello" }`
  - output in v3: `"4hello"`
  - output in v4: `"4hello"`

- encodePacket with binary
  - input: `{ type: 'message', data: <Buffer 01 02 03> }`
  - output in v3: `<Buffer 04 01 02 03>`
  - output in v4: `<Buffer 01 02 03>`

- encodePayload with strings
  - input: `[ { type: 'message', data: 'hello' }, { type: 'message', data: '€€€' } ]`
  - output in v3: `"6:4hello4:4€€€"`
  - output in v4: `"4hello\x1e4€€€"`

- encodePayload with string and binary
  - input: `[ { type: 'message', data: 'hello' }, { type: 'message', data: <Buffer 01 02 03> } ]`
  - output in v3: `<Buffer 00 06 ff 34 68 65 6c 6c 6f 01 04 ff 04 01 02 03>`
  - output in v4: `"4hello\x1ebAQID"`

Please note that the parser is now dependency-free! This should help reduce the size of the browser bundle.

### Bug Fixes

* keep track of the buffer initial length ([8edf2d1](https://github.com/socketio/engine.io-parser/commit/8edf2d1478026da442f519c2d2521af43ba01832))


### Features

* restore the upgrade mechanism ([6efedfa](https://github.com/socketio/engine.io-parser/commit/6efedfa0f3048506a4ba99e70674ddf4c0732e0c))



## [4.0.0-alpha.1](https://github.com/socketio/engine.io-parser/compare/v4.0.0-alpha.0...v4.0.0-alpha.1) (2020-05-19)


### Features

* implement the version 4 of the protocol ([cab7db0](https://github.com/socketio/engine.io-parser/commit/cab7db0404e0a69f86a05ececd62c8c31f4d97d5))



## [4.0.0-alpha.0](https://github.com/socketio/engine.io-parser/compare/2.2.0...v4.0.0-alpha.0) (2020-02-04)


### Bug Fixes

* properly decode binary packets ([5085373](https://github.com/socketio/engine.io-parser/commit/50853738e0c6c16f9cee0d7887651155f4b78240))


### Features

* remove packet type when encoding binary packets ([a947ae5](https://github.com/socketio/engine.io-parser/commit/a947ae59a2844e4041db58ff36b270d1528b3bee))


### BREAKING CHANGES

* the packet containing binary data will now be sent without any transformation

Protocol v3: { type: 'message', data: <Buffer 01 02 03> } => <Buffer 04 01 02 03>
Protocol v4: { type: 'message', data: <Buffer 01 02 03> } => <Buffer 01 02 03>



## [2.2.0](https://github.com/socketio/engine.io-parser/compare/2.1.3...2.2.0) (2019-09-13)


* [refactor] Use `Buffer.allocUnsafe` instead of `new Buffer` (#104) ([aedf8eb](https://github.com/socketio/engine.io-parser/commit/aedf8eb29e8bf6aeb5c6cc68965d986c4c958ae2)), closes [#104](https://github.com/socketio/engine.io-parser/issues/104)


### BREAKING CHANGES

* drop support for Node.js 4 (since Buffer.allocUnsafe was added in v5.10.0)

Reference: https://nodejs.org/docs/latest/api/buffer.html#buffer_class_method_buffer_allocunsafe_size
