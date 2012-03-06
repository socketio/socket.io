var App = {

	ready : function() {
		App.googleGroupsInput();
		App.googleGroupsMembers();
		App.hashSupport();
		prettyPrint();
	},

	googleGroupsInput : function() {
		var email = document.getElementById('google-subscribe-email'),
			input = document.getElementById('google-subscribe-input');
		if (email && input) {
			email.onfocus = function() { input.className = 'focus' };
			email.onblur = function() { input.className = '' };
		}
	},

	googleGroupsMembers : function(data) {
		if (data) {
			if (!(data && data.query && data.query.results && data.query.results.p)) return;
			var members = document.createElement('span'),
				input = document.getElementById('google-subscribe-input'),
				form = document.getElementsByTagName('form')[0];
			members.id = 'google-members-count';
			members.innerHTML = '('+ data.query.results.p +' members)';
			if (form && input) form.insertBefore(members, input);
		} else {
			var script = document.createElement('script');
			script.src = "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20html%20where%20url%3D%22http%3A%2F%2Fgroups.google.com%2Fgroup%2Fsocket_io%2Fabout%22%20and%20xpath%3D'%2F%2Fdiv%5B%40class%3D%5C'maincontbox%5C'%5D%2Ftable%2Ftr%5B1%5D%2Ftd%2Fp%5B1%5D'%0A&format=json&callback=App.googleGroupsMembers";
			document.head.appendChild(script);
		}
	},

	hashSupport : function() {
		if (!('onhashchange' in window)) return;
		var pages = document.getElementsByClassName('page'), i;
		var onHash = function() {
			var id = window.location.hash.substr(1) || 'home',
				page = document.getElementById('page-' + id),
				menu = document.getElementById('menu-' + id);
				currentMenu = document.getElementsByClassName('current')[0];
			for (i = 0; i < pages.length; i++) pages[i].style.display = 'none';
			if (page) {
				if (currentMenu) currentMenu.className = null;
				page.style.display = 'block';
				if (menu) menu.className = 'current';
			}
		};
		window.onhashchange = onHash;
		onHash();
	}

}

!function(a,b){function l(a){k=1;while(a=c.shift())a()}var c=[],d,e=!1,f=b.documentElement,g=f.doScroll,h="DOMContentLoaded",i="addEventListener",j="onreadystatechange",k=/^loade|c/.test(b.readyState);b[i]&&b[i](h,function a(){b.removeEventListener(h,a,e),l()},e),g&&b.attachEvent(j,d=function a(){/^c/.test(b.readyState)&&(b.detachEvent(j,a),l())}),a.domReady=g?function(a){self!=top?k?a():c.push(a):function(){try{f.doScroll("left")}catch(b){return setTimeout(function(){domReady(a)},50)}a()}()}:function(a){k?a():c.push(a)}}(this,document);

domReady(function() {
	App.ready();
});