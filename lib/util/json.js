// Based on JSON.js from MooTools (MIT)
// Copyright (c) 2006-2009 Valerio Proietti, <http://mad4milk.net/>

(function(){

	var array = io.util.Array,
	special = {'\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r', '"' : '\\"', '\\': '\\\\'},    
	json = io.util.JSON = {},

	escape = function(chr){
		return special[chr] || '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
	},

	isSecure = function(string){
		string = string.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@').
		replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
		replace(/(?:^|:|,)(?:\s*\[)+/g, '');

		return (/^[\],:{}\s]*$/).test(string);
	};

	json.encode = function(obj){
	  if (JSON.stringify) return JSON.stringify(obj);
		if (obj && obj.toJSON) obj = obj.toJSON();

		if (obj === null){
			return 'null';
		}

		if (obj instanceof Array){
			return '[' + array.map(obj, json.encode) + ']';
		}

		switch (typeof obj){
			case 'string':
			return '"' + obj.replace(/[\x00-\x1f\\"]/g, escape) + '"';
			case 'object':
			var string = [];
			for (var key in obj){
				var json = json.encode(obj[key]);
				if (json) string.push(json.encode(key) + ':' + json);
			}
			return '{' + string + '}';
			case 'number': 
			case 'boolean': 
			return '' + obj;
		}

		return null;
	};

	json.decode = function(string, secure){
		if (!string || typeof(string) != 'string') return null;

		if (secure || json.secure){
			if (JSON.parse) return JSON.parse(string);
			if (!isSecure(string)) throw new Error('io.util.JSON could not decode the input; security is enabled and the value is not secure.');
		}

		return eval('(' + string + ')');
	};

})();