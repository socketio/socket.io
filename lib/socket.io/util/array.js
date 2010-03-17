// Based on Mixin.js from MooTools (MIT)
// Copyright (c) 2006-2009 Valerio Proietti, <http://mad4milk.net/>

this.flatten = function(arr){
	var array = [];
	for (var i = 0, l = arr.length; i < l; i++){
		var item = arr[i];
		if (item != null) array = array.concat(item instanceof Array ? array.flatten(item) : item);
	}
	return array;
};

this.include = function(arr, item){
	if (arr.indexOf(item) == -1) arr.push(item);
	return arr;
};