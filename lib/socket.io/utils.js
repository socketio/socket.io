var Options = exports.options = function(){};

Options.prototype = {
	options: function(options, merge){
		this.options = exports.merge(options || {}, merge || {});
	}
};

exports.merge = function(source, merge){
	for (var i in merge) source[i] = merge[i];
	return source;
};