
/**
 * Packet types.
 */

var packets = exports.packets = {
    'open': 0
  , 'close': 1
  , 'heartbeat': 2
  , 'message': 3
  , 'probe': 4
  , 'error': 5
  , 'noop': 6
};

var packetslist = Object.keys(packets);

/**
 * Encodes a packet.
 *
 * @api private
 */

exports.encodePacket = function (type, data) {
  var encoded = packets[type]

  // data fragment is optional
  if ('string' == typeof data) {
    encoded += ':' + data;
  }

  return encoded;
};

/**
 * Decodes a packet.
 *
 * @return {Object} with `type` and `data` (if any)
 * @api private
 */

exports.decodePacket = function (data) {
  if (~data.indexOf(':')) {
    var pieces = data.split(':');
    return { type: packetslist[pieces[0]], data: pieces[1] };
  } else {
    return { type: packetslist[data] };
  }
};

/**
 * Encodes multiple messages (payload).
 *
 * @param {Array} messages
 * @api private
 */

exports.encodePayload = function (packets) {
  var encoded = '';

  if (packets.length == 1) {
    return packets[0];
  }

  for (var i = 0, l = packets.length; i < l; i++) {
    encoded += '\ufffd' + packets[i].length + '\ufffd' + packets[i]
  }

  return encoded;
};

/*
 * Decodes data when a payload is maybe expected.
 *
 * @param {String} data
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
        ret.push(data.substr(i + 1).substr(0, length));
        i += Number(length) + 1;
        length = '';
      } else {
        length += data[i];
      }
    }

    return ret;
  } else {
    return [data];
  }
}
