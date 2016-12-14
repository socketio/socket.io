$(function() {
  var questions = [
    'Hi, I can see you purchase a MacBook Pro today? Is that right?',
    'Awesome! Was it for yourself or was it a gift?',
    'Congratulations! However, I see that you didn\'t purchase AppleCare. Can I recommend an Insurer to protect it?',
    'Can you please send me a photo so I can confirm the spec and I can store',
    'It looks great! That\'s now been saved, so let\'s look for the best insurer',
    'From my search I can see there are 3 options: 1. AppleCare, 2.AVIA, 3.AIA. I can see that 60% of customers who bought this product insured it with AppleCare',
    'Sure, is there anything I can help you with?',
    'Well, I think I can help, there are 2 options for you: 1. visit our personalized retirement simulator. 2. speak to our expert wealth relationship manager. What option do you want to go? 1 or 2?'
  ];
  var answerConnectQuestion = false;
  var connectRM = false;
  var connectQuestion = 'Would you like to connect to our Relationship Manager?';
  var uploadedProfile = false;

  var questionIndex = 0;
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize variables
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages areafuser
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  // Prompt for setting a username
  var robotName = 'robot';
  var username;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();

  var socket = io();

  function addParticipantsMessage (data) {
    var message = '';
    if (data.numUsers === 1) {
      message += "there's 1 participant";
    } else {
      message += "there are " + data.numUsers + " participants";
    }
    log(message);
  }

  // Sets the client's username
  function setUsername () {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', username);

      if(username.toLowerCase() == 'chris') {
        connectRM = true;
      }
    }
  }

  // Sends a chat message
  function sendMessage () {
    var uploadThisTime = false;
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);

    if(message.toLowerCase().indexOf('photo') !== -1) {
      uploadedProfile = true; 
      uploadThisTime = true;
    }

    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message
      });

      // if(uploadThisTime)
      //   return;
      
      if(connectRM) {
        // tell server to execute 'new message' and send along one parameter
        socket.emit('new message', message);
      }
      else if(answerConnectQuestion) {
        socket.emit('answerConnect', message);
      }
      else if(questionIndex < questions.length) {
        socket.emit('robotAnswer', message);
      }
    }
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage (data, options) {
    // Don't fade the message in if there is an 'X was typing'    
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv;
    var floatRight = data.username == username ? ' right' : '';
    var usernameLowercase = data.username.toLowerCase();
    if(usernameLowercase == robotName)
      $usernameDiv = $('<img class="photo" src="robo.jpg">');
    else if(usernameLowercase == 'chris')
      $usernameDiv = $('<img class="photo" src="images.jpg">');
    else {
      if(uploadedProfile) {
        $usernameDiv = $('<img class="photo" src="girl.jpg">');
      }
      else {
        $usernameDiv = $('<img class="photo" src="images.jpg">');
      }
    }

    var $usernameDiv = $usernameDiv
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message' + floatRight + '"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  function addConnecting() {
    var $messageDiv = $('<li class="message"><div class="matchSection"><div class="tickIcon"><span><img src="success.png" alt=""><span></div></div></li>');
    console.log('addConnecting');
    addMessageElement($messageDiv, {fade: true});
  }

  // Adds the visual chat typing message
  function addChatTyping (data) {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).text();
  }

  // Updates the typing event
  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  function getUsernameColor (username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  function askRobotQuestion() {    
    addChatMessage({
        username: robotName,
        message: questions[questionIndex++]
    });
  }

  // Keyboard events

  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    // addParticipantsMessage(data);
  });

  socket.on('robotQuestion', function() {
    askRobotQuestion();
  })

  socket.on('connectRMQuestion', function(){
    questionIndex = questions.length - 1;   
    answerConnectQuestion = true; 
    addChatMessage({
        username: robotName,
        message: connectQuestion
    });
  });

  socket.on('connectRM', function(){
    connectRM = true;
    setTimeout(function(){
      addConnecting();
    }, 1000);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.username + ' joined');
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' left');
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });

  socket.on('disconnect', function () {
    log('you have been disconnected');
  });

  socket.on('reconnect', function () {
    log('you have been reconnected');
    if (username) {
      socket.emit('add user', username);
    }
  });

  socket.on('reconnect_error', function () {
    log('attempt to reconnect has failed');
  });

});
