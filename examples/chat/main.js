$(function() {
  // Initialize varibles
  var $window = $(window);
  var $messages = $('.messages'); // Messages area
  var $sendMessage = $('.sendMessage'); // Send message button
  var $inputMessage = $('.inputMessage'); // Input message input box

  var username;
  addChatMessage('CHAT', 'Enter your username below...');
  $inputMessage.attr('placeholder', 'username').focus();
  $sendMessage.html('set username');

  var socket = io();

  // Sets the client's username
  function setUsername () {
    username = $inputMessage.val().trim();
    if (username) {
      $inputMessage.val('');
      $inputMessage.attr('placeholder', 'message');
      $sendMessage.html('send');

      // Tell the server your username
      socket.emit('add user', username);
    }
  }

  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    // if there is a non-empty message and a socket connection
    if (message && socket) {
      $inputMessage.val('');
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', message);
    }
  }

  // Adds the visual chat message to the message list
  function addChatMessage (username, message) {
    var usernameDiv = '<div class="username">' + username + '</div>';
    var messageBodyDiv = '<div class="messageBody">' + message + '</div>';
    var messageDiv = '<div class="message">' + usernameDiv + messageBodyDiv + '</div>';
    $messages.append(messageDiv);
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // When the client clicks SEND
  $sendMessage.click(function () {
    if (username) {
      sendMessage();
    } else {
      setUsername();
    }
  });

  // When the client hits ENTER on their keyboard
  $window.keypress(function (e) {
    if (e.which === 13) {
      $sendMessage.click();
    }
  });

  // Auto-focus the chat when a key is typed
  $window.keydown(function (event) {
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $inputMessage.focus();
    }
  });

  // Whenever the server emits 'update chat', update the chat body
  socket.on('update chat', function (username, message) {
    addChatMessage(username, message);
  });
});