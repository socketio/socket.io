// nojquery

var FADE_TIME = 150; // ms
var TYPING_TIMER_LENGTH = 300; // ms (erano 400)
var COLORS = [
'#e21400', '#91580f', '#f8a700', '#f78b00',
'#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
'#3b88eb', '#3824aa', '#a700ff', '#d300e7'
];

// Initialize variables

var usernameInput = document.querySelector('.usernameInput');
var messages = document.querySelector('.messages');
var inputMessage = document.querySelector('.inputMessage');

var loginPage = document.querySelector('.login.page');
var chatPage = document.querySelector('.chat.page');

// Prompt for setting a username
var username;
var connected = false;
var typing = false;
var lastTypingTime;

usernameInput.focus();
//var typingMessages;							
var socket = io();


function addParticipantsMessage (data) {
	var message = '';
	if (data.numUsers === 1) {
		message += "there's 1 participant: " +data.userNames;
	} else {
		message += "there are " + data.numUsers + " participants: " +data.userNames;
	}
	log(message);
}

// Replace some special harmful caracters that can be injected 
function escapeHtml(str) {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;")
		.replace(/\//g, "&#x2F;")  
} // 

// Sets the client's username
function setUsername () {
	username = usernameInput.value;
	username = escapeHtml(username);	
//		If the username is valid
	if (username) {
		loginPage.style['display'] = "none";
		chatPage.style['display'] = "block";
//		$loginPage.off('click');					// rimuove il click su loginPage
//		currentInput = inputMessage.focus();
		inputMessage.focus();
//		Tell the server your username
		socket.emit('add user', username);
	}
}

// Sends a chat message
function sendMessage () {
	var message = inputMessage.value;
	message = escapeHtml(message);
	// if there is a non-empty message and a socket connection
	if (message && connected) {
		inputMessage.value = '';
		addChatMessage({
			username: username,
			message: message
		});
//	tell server to execute 'new message' and send along one parameter
		socket.emit('new message', message);
	}
}


// Log a message
function log (message, options) {
	var el = document.createElement('li');
	el.className = 'log';
	el.innerHTML = message;
	addMessageElement(el, options);
}


function addChatMessage (data, options) {
	options = options || {};
	var usernameDiv = document.createElement('span');
	usernameDiv.className = 'username';
	usernameDiv.innerHTML = data.username+ ":";				// firstChild.nodeValue oppure innerHTML
	usernameDiv.style['color'] = getUsernameColor(data.username);

	var messageBodyDiv = document.createElement('span');
	messageBodyDiv.className = 'messageBody';
	messageBodyDiv.innerHTML = data.message;
	
	var typingClass = data.typing ? 'typing' : '';

	var messageDiv = document.createElement('li');
	messageDiv.className = 'message ' +typingClass;
	messageDiv.setAttribute('username', data.username);			// ho impostato l'attributo per 'username' anzichè "data" 
	messageDiv.appendChild(usernameDiv);
	messageDiv.appendChild(messageBodyDiv);
	
	addMessageElement(messageDiv, options);
}


// Adds the visual chat typing message
	function addChatTyping (data) {
	data.typing = true;
	data.message = 'is typing';
	addChatMessage(data);
}


// Removes the visual chat typing message
function removeChatTyping (data) {
	var elem = getTypingMessages(messages);
	var classe = elem.className;
	if(classe === 'message typing') 
		elem.parentNode.removeChild(elem);	 
//	console.log(elem.innerHTML);
//	console.log(elem.getAttribute('username'))
//	console.log(elem.className);
}


// Adds a message element to the messages and scrolls to the bottom
// el - The element to add as a message
// options.prepend - If the element should prepend
//   all other messages (default = false)

function addMessageElement (el, options) {
//	var el = el;	
	// Setup default options
	if (!options) {
		options = {};
	}
	if (typeof options.prepend === 'undefined') {
		options.prepend = false;					// ????
	}
	
	// Apply options
	if (options.prepend) {
		messages.insertBefore(el, messages.lastChild);
	} else {
		messages.appendChild(el);		
	}
	messages.scrollTop = messages.scrollHeight; 
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


function getTypingMessages(nodo){
	var nodeLI;			
	for(nodo=nodo.firstElementChild; nodo !=null; nodo= nodo.nextElementSibling){
		var attr = nodo.getAttribute('username');
		if(nodo.nodeName === 'LI' && attr) 
			nodeLI = nodo;
		getTypingMessages(nodo);
	}
	return nodeLI;
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


// Keyboard events

window.addEventListener("keydown", function (event)	{
//	Auto-focus the current input when a key is typed
	if (!(event.ctrlKey || event.metaKey || event.altKey)) {
		usernameInput.focus();		
	}
	
//	When the client hits ENTER on their keyboard
	if (event.keyCode === 13) {
		if (username) {
			sendMessage();
			socket.emit('stop typing');
			typing = false;
		} else {
			setUsername();
		}
	}
});

// l'evento "input" scatta quando si inizia a digitare  nel campo input 

inputMessage.addEventListener("input", function(){		 
	updateTyping();
},false);


// Click events

// Focus input when clicking on the message input's border
inputMessage.addEventListener('click', function (){
	inputMessage.focus();
})


// Socket events

//	Whenever the server emits 'login', log the login message
socket.on('login', function (data) {
	connected = true;
//	Display the welcome message
	var message = "Welcome to Socket.IO Chat – ";
	log(message, {
		prepend: true
	});
	addParticipantsMessage(data);
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
//	removeChatTyping(data);					// Non serve
});


// Whenever the server emits 'typing', show the typing message
socket.on('typing', function (data) {
	addChatTyping(data);
});


// Whenever the server emits 'stop typing', kill the typing message
socket.on('stop typing', function (data) {
	removeChatTyping(data);
});






