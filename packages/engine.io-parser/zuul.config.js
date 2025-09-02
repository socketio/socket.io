"use strict";

import { pullRequest, all } from "socket.io-browsers";

const zuulConfig = (module.exports = {
  ui: "mocha-bdd",

  // test on localhost by default
  local: true,
  open: true,

  concurrency: 2, // ngrok only accepts two tunnels by default
  // if browser does not sends output in 120s since last output:
  // stop testing, something is wrong
  browser_output_timeout: 120 * 1000,
  browser_open_timeout: 60 * 4 * 1000,
  // we want to be notified something is wrong asap, so no retry
  browser_retries: 1,

  browserify: [
    {
      plugin: ["tsify", {
        target: "es2023"
      }],
      transform: {
        name: "babelify",
        presets: ["@babel/preset-env"]
      }
    }
  ]
});

if (process.env.CI === "true") {
  zuulConfig.local = false;
  zuulConfig.tunnel = {
    type: "ngrok",
    bind_tls: true
  };
}

const isPullRequest =
  process.env.TRAVIS_PULL_REQUEST &&
  process.env.TRAVIS_PULL_REQUEST !== "false";
zuulConfig.browsers = isPullRequest ? pullRequest : all;
