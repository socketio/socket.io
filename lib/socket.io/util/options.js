// Based on Mixin.js from MooTools (MIT)
// Copyright (c) 2006-2009 Valerio Proietti, <http://mad4milk.net/>
var object = require('./object'), sys = require('sys');

this.Options = {
	
	options: {},
	
	setOption: function(key, value){
		object.merge(this.options, key, value);
		return this;
	},
	
	setOptions: function(options){
		for (var key in options) this.setOption(key, options[key]);
		if (this.addListener){
			for (var i in this.options){				
				if (!(/^on[A-Z]/).test(i) || typeof this.options[i] != 'function') continue;
				this.addListener(i.replace(/^on([A-Z])/, function(full, first){
					return first.toLowerCase();
				}), this.options[i]);
				this.options[i] = null;
			}
		}
		return this;
	}
	
};