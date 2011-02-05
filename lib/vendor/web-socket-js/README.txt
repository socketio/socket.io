* How to try

Assuming you have Web server (e.g. Apache) running at http://example.com/ .

- Download web_socket.rb from:
  http://github.com/gimite/web-socket-ruby/tree/master
- Run sample Web Socket server (echo server) in example.com with: (#1)
  $ ruby web-socket-ruby/samples/echo_server.rb example.com 10081
- If your server already provides socket policy file at port 843, modify the file to allow access to port 10081. Otherwise you can skip this step. See below for details.
- Publish the web-socket-js directory with your Web server (e.g. put it in ~/public_html).
- Change ws://localhost:10081 to ws://example.com:10081 in sample.html.
- Open sample.html in your browser.
- After "onopen" is shown, input something, click [Send] and confirm echo back.

#1: First argument of echo_server.rb means that it accepts Web Socket connection from HTML pages in example.com.


* Troubleshooting

If it doesn't work, try these:

1. Try Chrome and Firefox 3.x.
- It doesn't work on Chrome:
-- It's likely an issue of your code or the server. Debug your code as usual e.g. using console.log.
- It works on Chrome but it doesn't work on Firefox:
-- It's likely an issue of web-socket-js specific configuration (e.g. 3 and 4 below).
- It works on both Chrome and Firefox, but it doesn't work on your browser:
-- Check "Supported environment" section below. Your browser may not be supported by web-socket-js.

2. Add this line before your code:
  WEB_SOCKET_DEBUG = true;
and use Developer Tools (Chrome/Safari) or Firebug (Firefox) to see if console.log outputs any errors.

3. Make sure you do NOT open your HTML page as local file e.g. file:///.../sample.html. web-socket-js doesn't work on local file. Open it via Web server e.g. http:///.../sample.html.

4. If you are NOT using web-socket-ruby as your WebSocket server, you need to place Flash socket policy file on your server. See "Flash socket policy file" section below for details.

5. Check if sample.html bundled with web-socket-js works.

6. Make sure the port used for WebSocket (10081 in example above) is not blocked by your server/client's firewall.

7. Install debugger version of Flash Player available here to see Flash errors:
http://www.adobe.com/support/flashplayer/downloads.html


* Supported environments

It should work on:
- Google Chrome 4 or later (just uses native implementation)
- Firefox 3.x, Internet Explorer 8 + Flash Player 9 or later

It may or may not work on other browsers such as Safari, Opera or IE 6. Patch for these browsers are appreciated, but I will not work on fixing issues specific to these browsers by myself.


* Flash socket policy file

This implementation uses Flash's socket, which means that your server must provide Flash socket policy file to declare the server accepts connections from Flash.

If you use web-socket-ruby available at
http://github.com/gimite/web-socket-ruby/tree/master
, you don't need anything special, because web-socket-ruby handles Flash socket policy file request. But if you already provide socket policy file at port 843, you need to modify the file to allow access to Web Socket port, because it precedes what web-socket-ruby provides.

If you use other Web Socket server implementation, you need to provide socket policy file yourself. See
http://www.lightsphere.com/dev/articles/flash_socket_policy.html
for details and sample script to run socket policy file server. node.js implementation is available here:
http://github.com/LearnBoost/Socket.IO-node/blob/master/lib/socket.io/transports/flashsocket.js

Actually, it's still better to provide socket policy file at port 843 even if you use web-socket-ruby. Flash always try to connect to port 843 first, so providing the file at port 843 makes startup faster.


* Cookie considerations

Cookie is sent if Web Socket host is the same as the origin of JavaScript. Otherwise it is not sent, because I don't know way to send right Cookie (which is Cookie of the host of Web Socket, I heard).

Note that it's technically possible that client sends arbitrary string as Cookie and any other headers (by modifying this library for example) once you place Flash socket policy file in your server. So don't trust Cookie and other headers if you allow connection from untrusted origin.


* Proxy considerations

The WebSocket spec (http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol) specifies instructions for User Agents to support proxied connections by implementing the HTTP CONNECT method.

The AS3 Socket class doesn't implement this mechanism, which renders it useless for the scenarios where the user trying to open a socket is behind a proxy. 

The class RFC2817Socket (by Christian Cantrell) effectively lets us implement this, as long as the proxy settings are known and provided by the interface that instantiates the WebSocket. As such, if you want to support proxied conncetions, you'll have to supply this information to the WebSocket constructor when Flash is being used. One way to go about it would be to ask the user for proxy settings information if the initial connection fails.


* How to host HTML file and SWF file in different domains

By default, HTML file and SWF file must be in the same domain. You can follow steps below to allow hosting them in different domain.

WARNING: If you use the method below, HTML files in ANY domains can send arbitrary TCP data to your WebSocket server, regardless of configuration in Flash socket policy file. Arbitrary TCP data means that they can even fake request headers including Origin and Cookie.

- Unzip WebSocketMainInsecure.zip to extract WebSocketMainInsecure.swf.
- Put WebSocketMainInsecure.swf on your server, instead of WebSocketMain.swf.
- In JavaScript, set WEB_SOCKET_SWF_LOCATION to URL of your WebSocketMainInsecure.swf.


* How to build WebSocketMain.swf

Install Flex 4 SDK:
http://opensource.adobe.com/wiki/display/flexsdk/Download+Flex+4

$ cd flash-src
$ ./build.sh


* License

New BSD License.
