var assert = require('assert');
var buffer = require('buffer');
var crypto = require('crypto');
var events = require('events');
var http = require('http');
var net = require('net');
var urllib = require('url');
var sys = require('sys');

var FRAME_NO = 0;
var FRAME_LO = 1;
var FRAME_HI = 2;

// Values for readyState as per the W3C spec
var CONNECTING = 0;
var OPEN = 1;
var CLOSING = 2;
var CLOSED = 3;

var debugLevel = parseInt(process.env.NODE_DEBUG, 16);
var debug = (debugLevel & 0x4) ?
    function() { sys.error.apply(this, arguments); } :
    function() { };

// Generate a Sec-WebSocket-* value
var createSecretKey = function() {
    // How many spaces will we be inserting?
    var numSpaces = 1 + Math.floor(Math.random() * 12);
    assert.ok(1 <= numSpaces && numSpaces <= 12);

    // What is the numerical value of our key?
    var keyVal = (Math.floor(
        Math.random() * (4294967295 / numSpaces)
    ) * numSpaces);

    // Our string starts with a string representation of our key
    var s = keyVal.toString();

    // Insert 'numChars' worth of noise in the character ranges
    // [0x21, 0x2f] (14 characters) and [0x3a, 0x7e] (68 characters)
    var numChars = 1 + Math.floor(Math.random() * 12);
    assert.ok(1 <= numChars && numChars <= 12);
    
    for (var i = 0; i < numChars; i++) {
        var pos = Math.floor(Math.random() * s.length + 1);

        var c = Math.floor(Math.random() * (14 + 68));
        c = (c <= 14) ?
            String.fromCharCode(c + 0x21) :
            String.fromCharCode((c - 14) + 0x3a);

        s = s.substring(0, pos) + c + s.substring(pos, s.length);
    }

    // We shoudln't have any spaces in our value until we insert them
    assert.equal(s.indexOf(' '), -1);

    // Insert 'numSpaces' worth of spaces
    for (var i = 0; i < numSpaces; i++) {
        var pos = Math.floor(Math.random() * (s.length - 1)) + 1;
        s = s.substring(0, pos) + ' ' + s.substring(pos, s.length);
    }

    assert.notEqual(s.charAt(0), ' ');
    assert.notEqual(s.charAt(s.length), ' ');

    return s;
};

// Generate a challenge sequence
var createChallenge = function() {
    var c = ''; 
    for (var i = 0; i < 8; i++) {
        c += String.fromCharCode(Math.floor(Math.random() * 255));
    }

    return c;
};

// Get the value of a secret key string
//
// This strips non-digit values and divides the result by the number of
// spaces found.
var secretKeyValue = function(sk) {
    var ns = 0;
    var v = 0;

    for (var i = 0; i < sk.length; i++) {
        var cc = sk.charCodeAt(i);
        
        if (cc == 0x20) {
            ns++;
        } else if (0x30 <= cc && cc <= 0x39) {
            v = v * 10 + cc - 0x30;
        }
    }

    return Math.floor(v / ns);
}

// Get the to-be-hashed value of a secret key string
//
// This takes the result of secretKeyValue() and encodes it in a big-endian
// byte string
var secretKeyHashValue = function(sk) {
    var skv = secretKeyValue(sk);
   
    var hv = '';
    hv += String.fromCharCode((skv >> 24) & 0xff);
    hv += String.fromCharCode((skv >> 16) & 0xff);
    hv += String.fromCharCode((skv >> 8) & 0xff);
    hv += String.fromCharCode((skv >> 0) & 0xff);

    return hv;
};

// Compute the secret key signature based on two secret key strings and some
// handshaking data.
var computeSecretKeySignature = function(s1, s2, hs) { 
    assert.equal(hs.length, 8);

    var hash = crypto.createHash('md5');

    hash.update(secretKeyHashValue(s1));
    hash.update(secretKeyHashValue(s2));
    hash.update(hs);

    return hash.digest('binary');
};

// Return a hex representation of the given binary string; used for debugging
var str2hex = function(str) {
    var hexChars = [
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 
        'a', 'b', 'c', 'd', 'e', 'f'
    ];

    var out = '';
    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        out += hexChars[(c & 0xf0) >>> 4];
        out += hexChars[c & 0x0f];
        out += ' ';
    }

    return out.trim();
};

// Get the scheme for a URL, undefined if none is found
var getUrlScheme = function(url) {
    var i = url.indexOf(':');
    if (i == -1) {
        return undefined;
    }

    return url.substring(0, i);
};

// Set a constant on the given object
var setConstant = function(obj, name, value) {
    Object.defineProperty(obj, name, {
        get : function() {
            return value;
        }
    });
};

// WebSocket object
//
// This is intended to conform (mostly) to http://dev.w3.org/html5/websockets/
//
// N.B. Arguments are parsed in the anonymous function at the bottom of the
//      constructor.
var WebSocket = function(url, proto, opts) {
    events.EventEmitter.call(this);

    // Retain a reference to our object
    var self = this;

    // State of our end of the connection
    var readyState = CONNECTING;

    // Whether or not the server has sent a close handshake
    var serverClosed = false;

    // Our underlying net.Stream instance
    var stream = undefined;

    opts = opts || {
        origin : 'http://www.example.com'
    };

    // Frame parsing functions
    //
    // These read data from the given buffer starting at the given offset,
    // looking for the end of the current frame. If found, the current frame is
    // emitted and the function returns. Only a single frame is processed at a
    // time.
    //
    // The number of bytes read to complete a frame is returned, which the
    // caller is to use to advance along its buffer. If 0 is returned, no
    // completed frame bytes were found, and the caller should probably enqueue
    // the buffer as a continuation of the current message. If a complete frame
    // is read, the function is responsible for resting 'frameType'.

    // Framing data
    var frameType = FRAME_NO;
    var bufs = [];
    var bufsBytes = 0;

    // Frame-parsing functions
    var frameFuncs = [
        // FRAME_NO
        function(buf, off) {
            if (buf[off] & 0x80) {
                frameType = FRAME_HI;
            } else {
                frameType = FRAME_LO;
            }

            return 1;
        },

        // FRAME_LO
        function(buf, off) {
            debug('frame_lo(' + sys.inspect(buf) + ', ' + off + ')');

            // Find the first instance of 0xff, our terminating byte
            for (var i = off; i < buf.length && buf[i] != 0xff; i++)
                ;

            // We didn't find a terminating byte
            if (i >= buf.length) {
                return 0;
            }

            // We found a terminating byte; collect all bytes into a single buffer
            // and emit it
            var mb = null;
            if (bufs.length == 0) {
                mb = buf.slice(off, i);
            } else {
                mb = new buffer.Buffer(bufsBytes + i);

                var mbOff = 0;
                bufs.forEach(function(b) {
                    b.copy(mb, mbOff, 0, b.length);
                    mbOff += b.length;
                });

                assert.equal(mbOff, bufsBytes);

                // Don't call Buffer.copy() if we're coping 0 bytes. Rather
                // than being a no-op, this will trigger a range violation on
                // the destination.
                if (i > 0) {
                    buf.copy(mb, mbOff, off, i);
                }

                // We consumed all of the buffers that we'd been saving; clear
                // things out
                bufs = [];
                bufsBytes = 0;
            }

            process.nextTick(function() {
                var b = mb;
                return function() {
                    var m = b.toString('utf8');

                    self.emit('data', b);
                    self.emit('message', m);        // wss compat

                    if (self.onmessage) {
                        self.onmessage({data: m});
                    }
                };
            }());

            frameType = FRAME_NO;
            return i - off + 1;
        },

        // FRAME_HI
        function(buf, off) {
            debug('frame_hi(' + sys.inspect(buf) + ', ' + off + ')');

            if (buf[off] !== 0) {
                throw new Error('High-byte framing not supported.');
            }

            serverClosed = true;
            return 1;
        }
    ];

    // Handle data coming from our socket
    var dataListener = function(buf) {
        if (buf.length <= 0 || serverClosed) {
            return;
        }

        debug('dataListener(' + sys.inspect(buf) + ')');

        var off = 0;
        var consumed = 0;

        do {
            if (frameType < 0 || frameFuncs.length <= frameType) {
                throw new Error('Unexpected frame type: ' + frameType);
            }

            assert.equal(bufs.length === 0, bufsBytes === 0);
            assert.ok(off < buf.length);

            consumed = frameFuncs[frameType](buf, off);
            off += consumed;
        } while (!serverClosed && consumed > 0 && off < buf.length);

        if (serverClosed) {
            serverCloseHandler();
        }
        
        if (consumed == 0) {
            bufs.push(buf.slice(off, buf.length));
            bufsBytes += buf.length - off;
        }
    };

    // Handle incoming file descriptors
    var fdListener = function(fd) {
        self.emit('fd', fd);
    };

    // Handle errors from any source (HTTP client, stream, etc)
    var errorListener = function(e) {
        process.nextTick(function() {
            self.emit('wserror', e);

            if (self.onerror) {
                self.onerror(e);
            }
        });
    };

    // Finish the closing process; destroy the socket and tell the application
    // that we've closed.
    var finishClose = function() {
        readyState = CLOSED;

        if (stream) {
            stream.end();
            stream.destroy();
            stream = undefined;
        }

        process.nextTick(function() {
            self.emit('close');
            if (self.onclose) {
                self.onclose();
            }
        });
    };

    // Send a close frame to the server
    var sendClose = function() {
        assert.equal(OPEN, readyState);

        readyState = CLOSING;
        stream.write('\xff\x00', 'binary');
    };

    // Handle a close packet sent from the server
    var serverCloseHandler = function() {
        assert.ok(serverClosed);
        assert.ok(readyState === OPEN || readyState === CLOSING);

        bufs = [];
        bufsBytes = 0;

        // Handle state transitions asynchronously so that we don't change
        // readyState before the application has had a chance to process data
        // events which are already in the delivery pipeline. For example, a
        // 'data' event could be delivered with a readyState of CLOSING if we
        // received both frames in the same packet.
        process.nextTick(function() {
            if (readyState === OPEN) {
                sendClose();
            }

            finishClose();
        });
    };

    // External API
    self.close = function(timeout) {
        if (readyState === CONNECTING) {
            // If we're still in the process of connecting, the server is not
            // in a position to understand our close frame. Just nuke the
            // connection and call it a day.
            finishClose();
        } else if (readyState === OPEN) {
            sendClose();

            if (timeout) {
                setTimeout(finishClose, timeout * 1000);
            }
        }
    };

    self.send = function(str, fd) {
        if (readyState != OPEN) {
            return;
        }

        stream.write('\x00', 'binary');
        stream.write(str, 'utf8', fd);
        stream.write('\xff', 'binary');
    };

    // wss compat
    self.write = self.send;

    setConstant(self, 'url', url);

    Object.defineProperty(self, 'readyState',  {
        get : function() {
            return readyState;
        }
    });

    // Connect and perform handshaking with the server
    (function() {
        // Parse constructor arguments 
        if (!url) {
            throw new Error('Url and must be specified.');
        }

        // Secrets used for handshaking
        var key1 = createSecretKey();
        var key2 = createSecretKey();
        var challenge = createChallenge();

        debug(
            'key1=\'' + str2hex(key1) + '\'; ' +
            'key2=\'' + str2hex(key2) + '\'; ' +
            'challenge=\'' + str2hex(challenge) + '\''
        );

        var httpHeaders = {
            'Connection' : 'Upgrade',
            'Upgrade' : 'WebSocket',
            'Sec-WebSocket-Key1' : key1,
            'Sec-WebSocket-Key2' : key2
        };
        if (opts.origin) {
            httpHeaders['Origin'] = opts.origin;
        }
        if (proto) {
            httpHeaders['Sec-WebSocket-Protocol'] = proto;
        }

        var httpPath = '/';

        // Create the HTTP client that we'll use for handshaking. We'll cannabalize
        // its socket via the 'upgrade' event and leave it to rot.
        //
        // N.B. The ws+unix:// scheme makes use of the implementation detail
        //      that http.Client passes its constructor arguments through,
        //      un-inspected to net.Stream.connect(). The latter accepts a
        //      string as its first argument to connect to a UNIX socket.
        var httpClient = undefined;
        switch (getUrlScheme(url)) {
        case 'ws':
            var u = urllib.parse(url);
            httpClient = http.createClient(u.port || 80, u.hostname);
            httpPath = (u.pathname || '/') + (u.search || '');
            httpHeaders.Host = u.hostname + (u.port ? (":" + u.port) : "");
            break;

        case 'ws+unix':
            var sockPath = url.substring('ws+unix://'.length, url.length);
            httpClient = http.createClient(sockPath);
            httpHeaders.Host = 'localhost';
            break;

        default:
            throw new Error('Invalid URL scheme \'' + urlScheme + '\' specified.');
        }

        httpClient.on('upgrade', (function() {
            var data = undefined;

            return function(req, s, head) {
                stream = s;

                stream.on('data', function(d) {
                    if (d.length <= 0) {
                        return;
                    }

                    if (!data) {
                        data = d;
                    } else {
                        var data2 = new buffer.Buffer(data.length + d.length);

                        data.copy(data2, 0, 0, data.length);
                        d.copy(data2, data.length, 0, d.length);

                        data = data2;
                    }

                    if (data.length >= 16) {
                        var expected = computeSecretKeySignature(key1, key2, challenge);
                        var actual = data.slice(0, 16).toString('binary');

                        // Handshaking fails; we're donezo
                        if (actual != expected) {
                            debug(
                                'expected=\'' + str2hex(expected) + '\'; ' +
                                'actual=\'' + str2hex(actual) + '\''
                            );

                            process.nextTick(function() {
                                // N.B. Emit 'wserror' here, as 'error' is a reserved word in the
                                //      EventEmitter world, and gets thrown.
                                self.emit(
                                    'wserror',
                                    new Error('Invalid handshake from server:' +
                                        'expected \'' + str2hex(expected) + '\', ' +
                                        'actual \'' + str2hex(actual) + '\''
                                    )
                                );

                                if (self.onerror) {
                                    self.onerror();
                                }

                                finishClose();
                            });
                        }

                        // Un-register our data handler and add the one to be used
                        // for the normal, non-handshaking case. If we have extra
                        // data left over, manually fire off the handler on
                        // whatever remains.
                        //
                        // XXX: This is lame. We should only remove the listeners
                        //      that we added.
                        httpClient.removeAllListeners('upgrade');
                        stream.removeAllListeners('data');
                        stream.on('data', dataListener);

                        readyState = OPEN;

                        process.nextTick(function() {
                            self.emit('open');

                            if (self.onopen) {
                                self.onopen();
                            }
                        });

                        // Consume any leftover data
                        if (data.length > 16) {
                            stream.emit('data', data.slice(16, data.length));
                        }
                    }
                });
                stream.on('fd', fdListener);
                stream.on('error', errorListener);
                stream.on('close', function() {
                    errorListener(new Error('Stream closed unexpectedly.'));
                });

                stream.emit('data', head);
            };
        })());
        httpClient.on('error', function(e) {
            httpClient.end();
            errorListener(e);
        });

        var httpReq = httpClient.request(httpPath, httpHeaders);

        httpReq.write(challenge, 'binary');
        httpReq.end();
    })();
};
sys.inherits(WebSocket, events.EventEmitter);
exports.WebSocket = WebSocket;

// Add some constants to the WebSocket object
setConstant(WebSocket.prototype, 'CONNECTING', CONNECTING);
setConstant(WebSocket.prototype, 'OPEN', OPEN);
setConstant(WebSocket.prototype, 'CLOSING', CLOSING);
setConstant(WebSocket.prototype, 'CLOSED', CLOSED);

// vim:ts=4 sw=4 et
