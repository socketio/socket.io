exports.options = {
  options: function(options, merge){
    this.options = exports.merge(options || {}, merge || {});
  }
};

exports.merge = function(source, merge){
  for (var i in merge) source[i] = merge[i];
  return source;
};

var frame = '~m~';

function stringify(message){
  if (Object.prototype.toString.call(message) == '[object Object]'){
    return '~j~' + JSON.stringify(message);
  } else {
    return String(message);
  }
};

exports.encode = function(messages){
  var ret = '', message,
      messages = Array.isArray(messages) ? messages : [messages];
  for (var i = 0, l = messages.length; i < l; i++){
    message = messages[i] === null || messages[i] === undefined ? '' : stringify(messages[i]);
    ret += frame + message.length + frame + message;
  }
  return ret;
};

exports.decode = function(data){
  var messages = [], number, n;
  do {
    if (data.substr(0, 3) !== frame) return messages;
    data = data.substr(3);
    number = '', n = '';
    for (var i = 0, l = data.length; i < l; i++){
      n = Number(data.substr(i, 1));
      if (data.substr(i, 1) == n){
        number += n;
      } else {  
        data = data.substr(number.length + frame.length)
        number = Number(number);
        break;
      } 
    }
    messages.push(data.substr(0, number)); // here
    data = data.substr(number);
  } while(data !== '');
  return messages;
};