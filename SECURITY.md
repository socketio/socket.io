# Security Policy

<!-- TOC -->
  * [Supported Versions](#supported-versions)
  * [Reporting a Vulnerability](#reporting-a-vulnerability)
  * [History](#history)
    * [For the `socket.io` package](#for-the-socketio-package)
    * [For the `socket.io-client` package](#for-the-socketio-client-package)
<!-- TOC -->

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 4.x     | :white_check_mark: |
| 3.x     | :white_check_mark: |
| 2.4.x   | :white_check_mark: |
| < 2.4.0 | :x:                |

## Reporting a Vulnerability

To report a security vulnerability in this package, please send an email to [@darrachequesne](https://github.com/darrachequesne) (see address in profile) describing the vulnerability and how to reproduce it.

We will get back to you as soon as possible and publish a fix if necessary.

:warning: IMPORTANT :warning: please do not create an issue in this repository, as attackers might take advantage of it. Thank you in advance for your responsible disclosure.

## History

### For the `socket.io` package

| Date         | Description                                                                  | CVE number       | Affected versions                   | Patched versions      |
|--------------|------------------------------------------------------------------------------|------------------|-------------------------------------|-----------------------|
| July 2012    | [Insecure randomness](https://github.com/advisories/GHSA-qv2v-m59f-v5fw)     | `CVE-2017-16031` | `<= 0.9.6`                          | `0.9.7`               |
| January 2021 | [CORS misconfiguration](https://github.com/advisories/GHSA-fxwf-4rqh-v8g3)   | `CVE-2020-28481` | `< 2.4.0`                           | `2.4.0`               |
| June 2024    | [Unhandled 'error' event](https://github.com/advisories/GHSA-25hc-qcg6-38wj) | `CVE-2024-38355` | `< 2.5.1` <br/> `>= 3.0.0, < 4.6.2` | `2.5.1` <br/> `4.6.2` |

From the transitive dependencies:

| Date          | Dependency         | Description                                                                                                   | CVE number       |
|---------------|--------------------|---------------------------------------------------------------------------------------------------------------|------------------|
| January 2016  | `ws`               | [Buffer vulnerability](https://github.com/advisories/GHSA-2mhh-w6q8-5hxw)                                     | `CVE-2016-10518` |
| January 2016  | `ws`               | [DoS due to excessively large websocket message](https://github.com/advisories/GHSA-6663-c963-2gqg)           | `CVE-2016-10542` |
| November 2017 | `ws`               | [DoS in the `Sec-Websocket-Extensions` header parser](https://github.com/advisories/GHSA-5v72-xg48-5rpm)      | `-`              |
| February 2020 | `engine.io`        | [Resource exhaustion](https://github.com/advisories/GHSA-j4f2-536g-r55m)                                      | `CVE-2020-36048` |
| January 2021  | `socket.io-parser` | [Resource exhaustion](https://github.com/advisories/GHSA-xfhh-g9f5-x4m4)                                      | `CVE-2020-36049` |
| May 2021      | `ws`               | [ReDoS in `Sec-Websocket-Protocol` header](https://github.com/advisories/GHSA-6fc8-4gx4-v693)                 | `CVE-2021-32640` |
| January 2022  | `engine.io`        | [Uncaught exception](https://github.com/advisories/GHSA-273r-mgr4-v34f)                                       | `CVE-2022-21676` |
| October 2022  | `socket.io-parser` | [Insufficient validation when decoding a Socket.IO packet](https://github.com/advisories/GHSA-qm95-pgcg-qqfq) | `CVE-2022-2421`  |
| November 2022 | `engine.io`        | [Uncaught exception](https://github.com/advisories/GHSA-r7qp-cfhv-p84w)                                       | `CVE-2022-41940` |
| May 2023      | `engine.io`        | [Uncaught exception](https://github.com/advisories/GHSA-q9mw-68c2-j6m5)                                       | `CVE-2023-31125` |
| May 2023      | `socket.io-parser` | [Insufficient validation when decoding a Socket.IO packet](https://github.com/advisories/GHSA-cqmj-92xf-r6r9) | `CVE-2023-32695` |
| June 2024     | `ws`               | [DoS when handling a request with many HTTP headers](https://github.com/advisories/GHSA-3h5v-q93c-6h6q)       | `CVE-2024-37890` |

### For the `socket.io-client` package

From the transitive dependencies:

| Date          | Dependency         | Description                                                                                                   | CVE number       |
|---------------|--------------------|---------------------------------------------------------------------------------------------------------------|------------------|
| January 2016  | `ws`               | [Buffer vulnerability](https://github.com/advisories/GHSA-2mhh-w6q8-5hxw)                                     | `CVE-2016-10518` |
| January 2016  | `ws`               | [DoS due to excessively large websocket message](https://github.com/advisories/GHSA-6663-c963-2gqg)           | `CVE-2016-10542` |
| October 2016  | `engine.io-client` | [Insecure Defaults Allow MITM Over TLS](https://github.com/advisories/GHSA-4r4m-hjwj-43p8)                    | `CVE-2016-10536` |
| November 2017 | `ws`               | [DoS in the `Sec-Websocket-Extensions` header parser](https://github.com/advisories/GHSA-5v72-xg48-5rpm)      | `-`              |
| January 2021  | `socket.io-parser` | [Resource exhaustion](https://github.com/advisories/GHSA-xfhh-g9f5-x4m4)                                      | `CVE-2020-36049` |
| May 2021      | `ws`               | [ReDoS in `Sec-Websocket-Protocol` header](https://github.com/advisories/GHSA-6fc8-4gx4-v693)                 | `CVE-2021-32640` |
| October 2022  | `socket.io-parser` | [Insufficient validation when decoding a Socket.IO packet](https://github.com/advisories/GHSA-qm95-pgcg-qqfq) | `CVE-2022-2421`  |
| May 2023      | `socket.io-parser` | [Insufficient validation when decoding a Socket.IO packet](https://github.com/advisories/GHSA-cqmj-92xf-r6r9) | `CVE-2023-32695` |
| June 2024     | `ws`               | [DoS when handling a request with many HTTP headers](https://github.com/advisories/GHSA-3h5v-q93c-6h6q)       | `CVE-2024-37890` |
