// Based on Mixin.js from MooTools (MIT)
// Copyright (c) 2006-2009 Valerio Proietti, <http://mad4milk.net/>

var clone = this.clone = function(item){
	var clone;
	if (item instanceof Array){
		clone = [];
		for (var i = 0; i < item.length; i++) clone[i] = clone(item[i]);
		return clone;
	} else if (typeof item == 'object') {
		clone = {};
		for (var key in object) clone[key] = clone(object[key]);
		return clone;
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