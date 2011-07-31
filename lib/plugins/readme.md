# socket.io-context

Provides updatable JS object (shared context) on top of socket.io connection in unobtrusive way.

## How to use

Server side:

    var io = require('socket.io');
    io.use('context');
    var ws = io.Context(http, {
      // custom options here, will augment ws.settings
    });

    ws.on('connection', function(client) {
      //
      // N.B.
      // `client` here is vanilla connection socket augmented with
      // `.update()` method which allows to mangle the shared context
      // at any level of depth
      //
      // define some context properties
      //
      client.update({
        foo: 'bar',
        deep: {
          method: function(a, b, c, fn) {
            fn(a + b + c);
          }
        },
        callme: function() {
          this.browser.callme('hello from server');
        }
      });

    });

Client side:

    <script src="/socket.io/socket.io.js"></script>
    <script>

    // connect
    var client = io.Context({ /* socket options here, if any */ });
    var server = client.context;
    // N.B. `server` has now property `foo` set to `'bar'`
    // along with property `deep` which has property `method` which is
    // truly callable

    // call remote method
    server.deep.method(1, 2, 3, function(result) {
      console.log('deep.method(1, 2, 3) resulted in ', result);
    });

    // update shared context
    client.update({
      // replace `foo`
      foo: 'baz',
      // augment `deep`
      deep: {
        // with stolen cookies ;)
        cookies: document.cookie
      },
      // define `browser`
      browser: {
        callme: function(text) {
          alert(text);
        }
      }
    }, null, function() {
      // N.B. update is async process so continuation style is allowed
      // now context is updated and we can call remote method which
      // calls back `browser.callme` method
      server.callme();
    });

    </script>

In short, whatever you like. Have fun and profit.

## License 

(The MIT License)

Copyright (c) 2011 Vladimir Dronnikov &lt;dronnikov@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
