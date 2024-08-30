const parser = require('.');

parser.encodePayload([
  {
    type: 'message',
    data: '€',
  },
  {
    type: 'message',
    data: Buffer.from([1, 2, 3, 4]),
  },
], true, console.log);
