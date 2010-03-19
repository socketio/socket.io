// Methods from Array.js from MooTools (MIT)
// Copyright (c) 2006-2009 Valerio Proietti, <http://mad4milk.net/>

(function(){

	var array = io.util.Array = {

		include: function(arr, item){
			if (!array.contains(arr, item)) arr.push(item);
			return arr;
		},

		each: function(arr, fn, bind){
			for (var i = 0, l = arr.length; i < l; i++) fn.call(bind, arr[i], i, arr);
		},

		contains: function(arr, item, from){
			return array.indexOf(arr, item, from) != -1;
		},

		indexOf: function(arr, item, from){
			for (var l = arr.length, i = (from < 0) ? Math.max(0, l + from) : from || 0; i < l; i++){
				if (arr[i] === item) return i;
			}
			return -1;
		}

	};

})();