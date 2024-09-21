# Socket.IO Contributing Guide

Thanks a lot for your interest in contributing to Socket.IO!

Before submitting your contribution, please make sure to take a moment and read through the following guidelines:

<!-- TOC -->
  * [Before you start](#before-you-start)
  * [Guidelines for reporting a bug](#guidelines-for-reporting-a-bug)
  * [Guidelines for requesting a feature](#guidelines-for-requesting-a-feature)
  * [Guidelines for creating a pull request](#guidelines-for-creating-a-pull-request)
    * [Bug fix](#bug-fix)
    * [New feature](#new-feature)
  * [Project structure](#project-structure)
  * [Development setup](#development-setup)
  * [Commands](#commands)
    * [Compile with TypeScript](#compile-with-typescript)
    * [Apply formatting](#apply-formatting)
    * [Run the tests](#run-the-tests)
<!-- TOC -->

## Before you start

Our [issues list](https://github.com/socketio/socket.io/issues) is exclusively reserved for bug reports and feature requests. For usage questions, please use the following resources:

- read the [docs](https://socket.io/docs/v4/)
- check the [troubleshooting guide](https://socket.io/docs/v4/troubleshooting-connection-issues/)
- look for/ask questions on [Stack Overflow](https://stackoverflow.com/questions/tagged/socket.io)
- create a new [discussion](https://github.com/socketio/socket.io/discussions/new?category=q-a)

## Guidelines for reporting a bug

If you think that you have found a security vulnerability in our project, please do not create an issue in this GitHub repository, but rather refer to our [security policy](./SECURITY.md).

Please make sure that the bug hasn't already been reported in our [issues list](https://github.com/socketio/socket.io/issues?q=label%3Abug+), as it may already have been fixed in a recent version. However, if the bug was reported in an old, closed issue but persists, you should open a new issue instead of commenting on the old issue.

After these checks, please [create a new bug report](https://github.com/socketio/socket.io/issues/new/choose) with all the necessary details:

- package versions
- platform (device, browser, operating system)
- a minimal reproduction (you can fork [this repository](https://github.com/socketio/socket.io-fiddle))

Without a clear way to reproduce the bug, we unfortunately won't be able to help you.

## Guidelines for requesting a feature

Please make sure that the feature hasn't already been requested in our [issues list](https://github.com/socketio/socket.io/labels/enhancement).

After these checks, please [create a new feature request](https://github.com/socketio/socket.io/issues/new/choose) with all the necessary details:

- what the problem is
- what you want to happen
- any alternative solutions or features you have considered

## Guidelines for creating a pull request

### Bug fix

- if you fix a bug which is described in our [issues list](https://github.com/socketio/socket.io/issues), please add a reference to it in the description of your pull request. Otherwise, please provide all necessary details to reproduce the bug, as described [above](#guidelines-for-reporting-a-bug).
- add one or more test cases, in order to avoid any regression in the future
- make sure existing tests still pass

### New feature

- we strongly suggest that you first open a [feature request](#guidelines-for-requesting-a-feature) and have it approved before working on it. In that case, please add a reference to it in the description of your pull request.
- add one or more test cases, in order to avoid any regression in the future
- make sure existing tests still pass

## Project structure

This repository is a [monorepo](https://en.wikipedia.org/wiki/Monorepo) which contains the source of the following packages:

| Package                        | Description                                                                                                                           |
|--------------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| `engine.io`                    | The server-side implementation of the low-level communication layer.                                                                  |
| `engine.io-client`             | The client-side implementation of the low-level communication layer.                                                                  |
| `engine.io-parser`             | The parser responsible for encoding and decoding Engine.IO packets, used by both the `engine.io` and `engine.io-client` packages.     |
| `socket.io`                    | The server-side implementation of the bidirectional channel, built on top on the `engine.io` package.                                 |
| `socket.io-adapter`            | An extensible component responsible for broadcasting a packet to all connected clients, used by the `socket.io` package.              |
| `socket.io-client`             | The client-side implementation of the bidirectional channel, built on top on the `engine.io-client` package.                          |
| `@socket.io/cluster-engine`    | A cluster-friendly engine to share load between multiple Node.js processes (without sticky sessions)                                  |
| `@socket.io/component-emitter` | An `EventEmitter` implementation, similar to the one provided by [Node.js](https://nodejs.org/api/events.html) but for all platforms. |
| `socket.io-parser`             | The parser responsible for encoding and decoding Socket.IO packets, used by both the `socket.io` and `socket.io-client` packages.     |

## Development setup

You will need [Node.js](https://nodejs.org) **version 18+**, and [`npm`](https://docs.npmjs.com/about-npm) **version 7+**, as we make use of npm's [workspaces feature](https://docs.npmjs.com/cli/v10/using-npm/workspaces).

After cloning the repository, please run:

```bash
npm ci
```

to install all dependencies.

Here is the list of tools that we use:

- [TypeScript](https://www.typescriptlang.org/) as the development language
- [Rollup](https://rollupjs.org/) for production bundling
- [Prettier](https://prettier.io/) for code formatting
- [Mocha](https://mochajs.org/) for testing
- [WebdriverIO](https://webdriver.io/) for browser and mobile testing

## Commands

Each npm workspace corresponds to a package. You can run the command:

- on all workspaces with the `--workspace` command-line argument (abbreviated `-ws`)
- on a specific workspace with the `--workspace=<some-workspace>` command-line argument

### Compile with TypeScript

For all workspaces:

```bash
npm run compile -ws --if-present
```

For a specific workspace:

```bash
npm run compile --workspace=socket.io
```

### Apply formatting

For all workspaces:

```bash
npm run format:fix -ws
```

For a specific workspace:

```bash
npm run format:fix --workspace=socket.io
```

### Run the tests

For all workspaces:

```bash
npm test -ws
```

For a specific workspace:

```bash
npm test --workspace=socket.io
```

### Generate the changelog

Install the [`conventional-changelog-cli`](https://www.npmjs.com/package/conventional-changelog-cli) package:

```bash
npm i -g conventional-changelog-cli
```

Then run:

```bash
cd packages/engine.io-client
conventional-changelog -p angular --tag-prefix "engine.io-client@" --commit-path .
```
