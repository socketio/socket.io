
module.exports = process.env.SIO_COV
? require('./lib-cov/')
: require('./lib/');
