
module.exports = process.env.SUPERAGENT_COV
  ? require('./lib-cov/node')
  : require('./lib/node');