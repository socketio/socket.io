
module.exports = process.env.EIO_COV
  ? require('./lib-cov')
  : require('./lib');
