
const path = require('path');

module.exports = {
  entry: {
    client1: './src/client1.js',
    client2: './src/client2.js',
    client3: './src/client3.js',
    client4: './src/client4.js'
  },
  output: {
    path: path.resolve(__dirname, '../public'),
    filename: '[name].bundle.js'
  }
};
