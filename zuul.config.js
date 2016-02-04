
module.exports = {
  ui: 'mocha-bdd',
  server: './test/support/server.js',
  tunnel: {
    type: 'ngrok',
    authtoken: '6Aw8vTgcG5EvXdQywVvbh_3fMxvd4Q7dcL2caAHAFjV',
    proto: 'tcp'
  },
  builder: 'zuul-builder-webpack',
  webpack: require('./support/webpack.config.js')
};
