// Based on Core.js from MooTools (MIT)
// Copyright (c) 2006-2009 Valerio Proietti, <http://mad4milk.net/>

(function(){

	var object = io.util.Object = {

		clone: function(item){
			var clone;
			if (item instanceof Array){
				clone = [];
				for (var i = 0; i < item.length; i++) clone[i] = object.clone(item[i]);
				return clone;
			} else if (typeof item == 'object') {
				clone = {};
				for (var key in object) clone[key] = object.clone(object[key]);
				return clone;
			} else {
				return item;
			}
		},

		merge: function(source, k, v){
			if (typeof k == 'string') return mergeOne(source, k, v);
			for (var i = 1, l = arguments.length; i < l; i++){
				var object = arguments[i];
				for (var key in object) mergeOne(source, key, object[key]);
			}
			return source;
		}

	},

	mergeOne = function(source, key, current){
		if (current instanceof Array){
			source[key] = object.clone(current);
		} else if (typeof current == 'object'){
			if (typeof source[key] == 'object') object.merge(source[key], current);
			else source[key] = object.clone(current);
		} else {
			source[key] = current;
		}
		return source;
	};
  
})();