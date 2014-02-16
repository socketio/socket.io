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
    var messageDiv = '<li class="message">' + usernameDiv + messageBodyDiv + '</li>';
    $messages.append(messageDiv);
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

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

  // Whenever the server emits 'update chat', update the chat body
  socket.on('update chat', function (username, message) {
    addChatMessage(username, message);
  });
});