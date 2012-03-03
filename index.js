
module.exports = process.env.COV
  ? require('./lib-cov/engine-io')
  : require('./lib/engine-io');
