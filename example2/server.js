var http = require('http'), 
    url = require('url'),
    fs = require('fs'),
    io = require('../'),
    sys = require('sys'),
    qs = require("querystring"),

    send404 = function(res){
      res.writeHead(404);
      res.write('404');
      res.end();
    },
    
    sendJSON = function (res, code, obj) {
      var body = JSON.stringify(obj);
      res.writeHead(code, { "Content-Type": "text/json"
                          , "Content-Length": body.length
                          });
      res.end(body);
    },


/************************************************************************
 * Subscriptions manages the connected clients. A client will generally be 
 * connected longer than a callback is so we need to manage them. Each 
 * time a callback connects with a particular ID we poke its timestamp.
 * Subscriptions will get removed if their timestamp is too old.
 ************************************************************************/
subscriptions = {
  memberships: [],
  channels: {},

  newSubscription: function (client, username, channelNames) {
    if (username.length > 50) return null;
    if (/[^\w_\-^!]/.exec(username)) return null;
  
    // Create or add to the channel and add the client to it.
    for (var i=0; i< channelNames.length; i++) {
      cn = channelNames[i];
      if (!subscriptions.channels[cn]) subscriptions.channels[cn] = [];
      subscriptions.channels[cn].push(client);
    }
  
    // Store the details of the subscription
    var membership = { 
      username: username, 
      channels: channelNames,
      id: client.sessionId,
      timestamp: new Date(),
  
      poke: function () {
        membership.timestamp = new Date();
      },
  
      destroy: function () {
        var clientChannels = subscriptions.memberships[client.sessionId].channels;
        for (var i=0; i< clientChannels.length; i++) {
          var channel = clientChannels[i],
              idx = subscriptions.channels[channel].indexOf(client);
          subscriptions.channels[channel].splice(idx,1);
        }
        delete subscriptions.memberships[client.sessionId];
      }
    };
  
    subscriptions.memberships[membership.id] = membership;
  },

  publish: function (channels,message) {
    var receivedClients = [];
    for (var i = 0; i < channels.length; i++) {
        var clients = this.channels[channels[i]];
        if (clients === undefined) continue;
        for (var j = 0; j < clients.length; j++) {
          if (receivedClients.indexOf(clients[j]) > -1) continue;
          clients[j].send(message);
          receivedClients.push(clients[j]);
        }
    }
  }
},

  processMessage = function(client,obj){
    if (client != null && obj.subscribe && obj.username) {
      sys.log("Rx: subscribing to " +obj.subscribe+ " by "+obj.username);
      subscriptions.newSubscription(client,obj.username,obj.subscribe);
      var membership = subscriptions.memberships[client.sessionId],
          message = { announcement: membership.username + ' connected' };
      subscriptions.publish(membership.channels,message);
      client.send({ subscribed: true });
    } else if (client != null && obj.publish && obj.message) { 
      var membership = subscriptions.memberships[client.sessionId],
          message = {message: [membership.username, obj.message]};
      sys.log("Rx: publishing to " +obj.publish+ " by "+membership.username);
      subscriptions.publish(obj.publish,message);
    } else if (client == null && obj.publish && obj.message && obj.username) { 
      var message = {message: [obj.username, obj.message]};
      sys.log("Rx: publishing TEXT to " +obj.publish+ " by "+obj.username);
      subscriptions.publish(obj.publish,message);
    } else if (client == null && obj.publish && obj.json && obj.username) { 
      var message = {json: [obj.username, obj.json]};
      sys.log("Rx: publishing JSON to " +obj.publish+ " by "+obj.username);
      subscriptions.publish(obj.publish,message);
    } else {
      var obj_str = [],
          error = new Error("API:processMessage:unknownParams -");
      for(a in obj) obj_str.push(" obj["+ a + "] => " + obj[a]);
      error.message += obj_str.join();
      error['code'] = 100;
      throw error;
    }
  },

server = http.createServer(function(req, res){
  // your normal server code
  var path = url.parse(req.url).pathname;
  switch (path){
    case '/':
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.write('<h1>Welcome. Try the <a href="/chat.html">chat</a> example.</h1>');
      res.end();
      break;
    case '/json.js':
    case '/chat.html':
      fs.readFile(__dirname + path, function(err, data){
      if (err) return send404(res);
        res.writeHead(200, {'Content-Type': path == 'json.js' ? 'text/javascript' : 'text/html'})
        res.write(data, 'utf8');
        res.end();
      });
      break;
    case "/api/who":
      var usernames = [];
      for (var id in subscriptions.memberships) {
        if (!subscriptions.memberships.hasOwnProperty(id)) continue;
        var membership = subscriptions.memberships[id];
        usernames.push(membership.username);
      }
      sendJSON(res, 200, { usernames: usernames, stat: "ok" });
      break;

    case "/api/send":
      var obj = {
          username: qs.parse(url.parse(req.url).query).username,
          message: qs.parse(url.parse(req.url).query).text,
          publish: qs.parse(url.parse(req.url).query).channels
      }
      
      try {
        processMessage(null,obj);
        sendJSON(res,200,{stat: "ok"});
      } catch(e) {
        sendJSON(res,200,{stat: "fail", code: e.code, message: e.message});	
      }
      break;
    default: send404(res);
  }
});

server.listen(8080);
var io = io.listen(server);

io.on('connection', function(client){

  client.on('message', function(obj) {
    processMessage(client,obj);
  });

  client.on('disconnect', function(){
    if (subscriptions.memberships.hasOwnProperty(client.sessionId)) {
        var membership = subscriptions.memberships[client.sessionId],
            message = { announcement: membership.username + ' disconnected' };
        subscriptions.publish(membership.channels,message);
        subscriptions.memberships[client.sessionId].destroy();
    }
  });

});
