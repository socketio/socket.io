'use strict';

const webpackConfig = require('./support/prod.config.js');

webpackConfig.module.rules.push({
  test: /\.tsx?$/,
  use: [
    {
      loader: "ts-loader",
      options: {
        compilerOptions: {
          target: "es5",
        }
      }
    },
  ],
  exclude: /node_modules/,
});

const zuulConfig = module.exports = {
  ui: 'mocha-bdd',

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

  server: './test/support/server.js',
  builder: 'zuul-builder-webpack',
  webpack: webpackConfig
};

if (process.env.CI === 'true') {
  zuulConfig.local = false;
  zuulConfig.tunnel = {
    type: 'ngrok',
    bind_tls: true
  };
}

zuulConfig.browsers = [
  {
    name: 'chrome',
    version: 'latest'
  }, {
    name: 'firefox',
    version: 'latest'
  }, {
    name: 'internet explorer',
    version: '9..11'
  }, {
    name: 'safari',
    version: 'latest'
  }, {
    name: 'iphone',
    version: '15.4' // temporary fix
  }, {
    name: 'android',
    version: '5.1..6.0'
  }, {
    name: 'ipad',
    version: '15.4' // temporary fix
  }, {
    name: 'MicrosoftEdge',
    version: 'latest'
  }
];
