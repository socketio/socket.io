// Based on Mixin.js from MooTools (MIT)
// Copyright (c) 2006-2009 Valerio Proietti, <http://mad4milk.net/>

io.util.Options = {
	
	options: {},
	
	setOption: function(key, value){
		io.util.Object.merge(this.options, key, value);
		return this;
	},
	
	setOptions: function(options){
		for (var key in options) this.setOption(key, options[key]);
		if (this.addEvent){
			for (var i in this.options){
				if (!(/^on[A-Z]/).test(i) || typeof this.options[i] != 'function') return;
				this.addEvent(i, this.options[i]);
				this.options[i] = null;
			}
		} 
		return this;
	}
	
};