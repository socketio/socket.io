/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

io.util = {
	
	inherits: function(ctor, superCtor){
		// todo
	},
	
	indexOf: function(arr, item, from){
		for (var l = arr.length, i = (from < 0) ? Math.max(0, l + from) : from || 0; i < l; i++){
			if (arr[i] === item) return i;
		}
		return -1;
	}
	
};