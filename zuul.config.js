
var zuulConfig = module.exports = {
  ui: 'mocha-bdd',
  server: './test/support/server.js',
  local: true, // test on localhost by default
  builder: 'zuul-builder-webpack',
  webpack: require('./support/webpack.config.js')
};

if (process.env.CI === 'true') {
  zuulConfig.local = false;
  zuulConfig.tunnel = {
    type: 'ngrok',
    authtoken: '6Aw8vTgcG5EvXdQywVvbh_3fMxvd4Q7dcL2caAHAFjV',
    proto: 'tcp'
  };
}
