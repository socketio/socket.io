// Based on Mixin.js from MooTools (MIT)
// Copyright (c) 2006-2009 Valerio Proietti, <http://mad4milk.net/>

var clone = this.clone = function(item){
	var cloned;
	if (item instanceof Array){
		cloned = [];
		for (var i = 0; i < item.length; i++) cloned[i] = clone(item[i]);
		return cloned;
	} else if (typeof item == 'object') {
		cloned = {};
		for (var key in object) cloned[key] = clone(object[key]);
		return cloned;
	} else {
		return item;
	}
}, 

mergeOne = function(source, key, current){
	if (current instanceof Array){
		source[key] = clone(current);
	} else if (typeof current == 'object'){
		if (typeof source[key] == 'object') object.merge(source[key], current);
		else source[key] = clone(current);
	} else {
		source[key] = current;
	}
	return source;
};

this.merge = function(source, k, v){
	if (typeof k == 'string') return mergeOne(source, k, v);
	for (var i = 1, l = arguments.length; i < l; i++){
		var object = arguments[i];
		for (var key in object) mergeOne(source, key, object[key]);
	}
	return source;
};
