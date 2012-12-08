
module.exports = process.env.EIO_COV
? require('./lib-cov/engine.io-client')
: require('./lib/engine.io-client');
