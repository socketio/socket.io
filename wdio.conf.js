const BASE_SAUCE_OPTIONS = {
  build: process.env.GITHUB_RUN_ID || "local",
  name: "socket.io-client",
};

const config = {
  specs: ["./test/index.ts"],

  capabilities: [
    {
      browserName: "chrome",
    },
  ],

  maxInstances: 5,
  logLevel: "warn",
  bail: 0,
  baseUrl: "http://localhost",

  reporters: ["spec"],
  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },
};

if (process.env.CI === "true") {
  config.services = [
    [
      "sauce",
      {
        sauceConnect: true,
      },
    ],
  ];
  config.user = process.env.SAUCE_USERNAME;
  config.key = process.env.SAUCE_ACCESS_KEY;

  // https://saucelabs.com/platform/platform-configurator#/
  config.capabilities = [
    {
      browserName: "chrome",
      browserVersion: "latest",
      platformName: "Windows 11",
      "sauce:options": BASE_SAUCE_OPTIONS,
    },
    {
      browserName: "MicrosoftEdge",
      browserVersion: "latest",
      platformName: "Windows 11",
      "sauce:options": BASE_SAUCE_OPTIONS,
    },
    {
      browserName: "firefox",
      browserVersion: "latest",
      platformName: "Windows 11",
      "sauce:options": BASE_SAUCE_OPTIONS,
    },
    {
      browserName: "internet explorer",
      browserVersion: "10",
      platformName: "Windows 7",
      "sauce:options": BASE_SAUCE_OPTIONS,
    },
    {
      browserName: "safari",
      browserVersion: "latest",
      platformName: "macOS 12",
      "sauce:options": BASE_SAUCE_OPTIONS,
    },
    {
      platformName: "Android",
      browserName: "Chrome",
      "appium:deviceName": "Android GoogleAPI Emulator",
      "appium:platformVersion": "latest",
      "appium:automationName": "UiAutomator2",
      "sauce:options": Object.assign(
        {
          appiumVersion: "1.22.1",
        },
        BASE_SAUCE_OPTIONS
      ),
    },
    {
      platformName: "iOS",
      browserName: "Safari",
      "appium:deviceName": "iPhone Simulator",
      "appium:platformVersion": "latest",
      "appium:automationName": "XCUITest",
      "sauce:options": Object.assign(
        {
          appiumVersion: "2.0.0",
        },
        BASE_SAUCE_OPTIONS
      ),
    },
  ];
}

exports.config = config;
