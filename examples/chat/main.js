$(function() {
  // Initialize varibles
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  // Prompt for setting a username
  var username;
  var color;
  var connected = false;
  var $currentInput = $usernameInput.focus();

  var socket = io();

  // Sets the client's username
  function setUsername () {
    username = $usernameInput.val().trim();

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', username);
    }
  }

  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = $('<div/>').text(message).html() || message;
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        color: color,
        message: message
      });
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', message);
    }
  }

  // Log a message
  function log (message) {
    var el = '<li class="log">' + message + '</li>';
    addMessageElement(el);
  }

  // Adds the visual chat message to the message list
  function addChatMessage (data) {
    var colorStyle = 'style="color:' + data.color + '"';
    var usernameDiv = '<span class="username"' + colorStyle + '>' + data.username + '</span>';
    var messageBodyDiv = '<span class="messageBody">' + data.message + '</span>';
    var messageDiv = '<li class="message">' + usernameDiv + messageBodyDiv + '</li>';
    addMessageElement(messageDiv);
  }

  // Adds a message element to the messages and scrolls to the bottom
  function addMessageElement (el) {
    $messages.append(el);
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Keyboard events

  // When the client hits ENTER on their keyboard
  $window.keypress(function (e) {
    if (e.which === 13) {
      if (username) {
        sendMessage();
      } else {
        setUsername();
      }
    }
  });

  // Auto-focus the current input when a key is typed
  $window.keydown(function (event) {
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
  });

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    // Save the color
    color = data.color;
    // Display the welcome message
    var message = "Welcome to Socket.IO Chat - ";
    if (data.numUsers === 1) {
      message += "there's 1 participant";
    } else {
      message += "there're " + data.numUsers + " participants";
    }
    log(message);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.username + ' joined');
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' left');
  });
});