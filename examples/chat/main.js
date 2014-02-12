$(function() {
  // Initialize varibles
  var $messages = $('.messages'); // Messages area
  var $sendMessage = $('.sendMessage'); // Send message button
  var $inputMessage = $('.inputMessage'); // Input message input box

  // Prompt for a username
  var username = prompt("What's your name?");

  var socket = io.connect();

  // on connection to server
  socket.on('connect', function() {
    // call the server-side function 'add user' and send along one parameter (the username)
    socket.emit('add user', username);
  });

  // whenever the server emits 'update chat', update the chat body
  socket.on('update chat', function (username, message) {
    var usernameDiv = '<div class="username">' + username + '</div>';
    var messageBodyDiv = '<div class="messageBody">' + message + '</div>';
    var messageDiv = '<div class="message">' + usernameDiv + messageBodyDiv + '</div>';
    $messages.append(messageDiv);
    $messages[0].scrollTop = $messages[0].scrollHeight;
  });

  // when the client clicks SEND
  $sendMessage.click(function () {
    var message = $inputMessage.val();
    // if there is a non-empty message
    if (message) {
      $inputMessage.val('');
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', message);
    }
  });

  // when the client hits ENTER on their keyboard
  $(window).keypress(function (e) {
    if (e.which === 13) {
      $sendMessage.click();
    }
  });
});