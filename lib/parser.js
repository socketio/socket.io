
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

/**
 * Packet types.
 */

var packets = exports.packets = [
    'disconnect'
  , 'connect'
  , 'heartbeat'
  , 'message'
  , 'json'
  , 'event'
  , 'ack'
  , 'error'
  , 'noop'
];

/**
 * Errors reasons.
 */

var reasons = exports.reasons = [
    'transport not supported'
  , 'client not handshaken'
  , 'unauthorized'
];

/**
 * Errors advice.
 */

var advice = exports.advice = [
    'reconnect'
];

/**
 * Encodes a packet.
 *
 * @api private
 */

exports.encodePacket = function (packet) {
  var type = packets.indexOf(packet.type)
    , id = packet.id || ''
    , endpoint = packet.endpoint || ''
    , ack = packet.ack
    , data = null;

  switch (packet.type) {
    case 'error':
      var reason = packet.reason ? reasons.indexOf(packet.reason) : ''
        , adv = packet.advice ? advice.indexOf(packet.advice) : ''

      if (reason !== '' || adv !== '')
        data = reason + (adv !== '' ? ('+' + adv) : '')

      break;

    case 'message':
      if (packet.data !== '')
        data = packet.data;
      break;

    case 'event':
      var ev = { name: packet.name };

      if (packet.args && packet.args.length) {
        ev.args = packet.args;
      }

      data = JSON.stringify(ev);
      break;

    case 'json':
      data = JSON.stringify(packet.data);
      break;

    case 'connect':
      if (packet.qs)
        data = packet.qs;
      break;

    case 'ack':
      data = packet.ackId
        + (packet.args && packet.args.length
            ? '+' + JSON.stringify(packet.args) : '');
      break;
  }

  // construct packet with required fragments
  var encoded = [
      type
    , id + (ack == 'data' ? '+' : '')
    , endpoint
  ];

  // data fragment is optional
  if (data !== null && data !== undefined)
    encoded.push(data);

  return encoded.join(':');
};

/**
 * Encodes multiple messages (payload).
 *
 * @param {Array} messages
 * @api private
 */

exports.encodePayload = function (packets) {
  var decoded = '';

  if (packets.length == 1)
    return packets[0];

  for (var i = 0, l = packets.length; i < l; i++) {
    var packet = packets[i];
    decoded += '\ufffd' + packet.length + '\ufffd' + packets[i]
  }

  return decoded;
};

/**
 * Decodes a packet
 *
 * @api private
 */

var regexp = /([^:]+):([0-9]+)?(\+)?:([^:]+)?:?([\s\S]*)?/;

exports.decodePacket = function (data) {
  var pieces = data.match(regexp);

  if (!pieces) return {};

  var id = pieces[2] || ''
    , data = pieces[5] || ''
    , packet = {
          type: packets[pieces[1]]
        , endpoint: pieces[4] || ''
      };

  // whether we need to acknowledge the packet
  if (id) {
    packet.id = id;
    if (pieces[3])
      packet.ack = 'data';
    else
      packet.ack = true;
  }

  // handle different packet types
  switch (packet.type) {
    case 'error':
      var pieces = data.split('+');
      packet.reason = reasons[pieces[0]] || '';
      packet.advice = advice[pieces[1]] || '';
      break;

    case 'message':
      packet.data = data || '';
      break;

    case 'event':
      try {
        var opts = JSON.parse(data);
        packet.name = opts.name;
        packet.args = opts.args;
      } catch (e) { }

      packet.args = packet.args || [];
      break;

    case 'json':
      try {
        packet.data = JSON.parse(data);
      } catch (e) { }
      break;

    case 'connect':
      packet.qs = data || '';
      break;

    case 'ack':
      var pieces = data.match(/^([0-9]+)(\+)?(.*)/);
      if (pieces) {
        packet.ackId = pieces[1];
        packet.args = [];

        if (pieces[3]) {
          try {
            packet.args = pieces[3] ? JSON.parse(pieces[3]) : [];
          } catch (e) { }
        }
      }
      break;

    case 'disconnect':
    case 'heartbeat':
      break;
  };

  return packet;
};

/**
 * Decodes data payload. Detects multiple messages
 *
 * @return {Array} messages
 * @api public
 */

exports.decodePayload = function (data) {
  if (undefined == data || null == data) {
    return [];
  }

  if (data[0] == '\ufffd') {
    var ret = [];

    for (var i = 1, length = ''; i < data.length; i++) {
      if (data[i] == '\ufffd') {
        ret.push(exports.decodePacket(data.substr(i + 1).substr(0, length)));
        i += Number(length) + 1;
        length = '';
      } else {
        length += data[i];
      }
    }

    return ret;
  } else {
    return [exports.decodePacket(data)];
  }
};
