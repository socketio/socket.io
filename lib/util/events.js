// Based on Mixin.js from MooTools (MIT)
// Copyright (c) 2006-2009 Valerio Proietti, <http://mad4milk.net/>

io.util.Events = (function(){
	var array = io.util.Array,

	eventsOf = function(object, type){
		type = type.replace(/^on([A-Z])/, function(full, first){
			return first.toLowerCase();
		});
		var events = object.$events;
		return events[type] || (events[type] = []);
	},

	removeEventsOfType = function(object, type){
		array.each(eventsOf(object, type), function(fn){
			object.removeEvent(type, fn);
		});
	};

	return {
		$events: {},

		addEvent: function(type, fn){
			array.include(eventsOf(this, type), fn);
			return this;
		},

		addEvents: function(events){
			for (var name in events) this.addEvent(name, events[name]);
			return this;
		},

		fireEvent: function(type, args){
			args = [].concat(args);
			array.each(eventsOf(this, type), function(fn){
				fn.apply(this, args);
			}, this);
			return this;
		},

		fireEvents: function(){
			for (var i = 0; i < arguments.length; i++) this.fireEvent(arguments[i]);
			return this;
		},

		removeEvent: function(type, fn){
			var events = eventsOf(this, type), index = events.indexOf(fn);
			if (index != -1) events.splice(index, 1);

			return this;
		},

		removeEvents: function(option){
			if (option === null){
				var events = this.$events;
				for (var type in events) removeEventsOfType(this, type);
			} else {
				switch (typeof option){
					case 'string': removeEventsOfType(this, option); break;
					case 'object': for (var name in option) this.removeEvent(name, option[name]); break;
				}
			}  		
			return this;
		}
	};
})();