var YTLC = function() {
	console.error("[YTLC] YARRRP");
	var Comment = function(author, text, timeText, id) {
		const idPrefix = 'comment_';
		var parseTime = function(t) {
			return t.split(':')
				.map(e => parseInt(e))
				.reduce((a, e) => a * 60 + e, 0);
		};
		var identifier = idPrefix + id;
		var time = parseTime(timeText);
		this.getAuthor = function() {
			return author;
		};
		this.getMessage = function() {
			return text;
		};
		this.getTime = function() {
			return time;
		};
		this.getTimeAsString = function() {
			return timeText;
		};
		this.getID = function() {
			return identifier;
		};
	};
	var CommentsRequester = function(callback) {
		const timeRegex = new RegExp("(?:[^:\\d]|^)((?:\\d{1,2}:[0-5]|[0-5]?)\\d:[0-5]\\d)", "g");
		const videoIdRegex = new RegExp("(?:youtube(?:-nocookie)?\\.com\\/(?:[^\\/\\n\\s]+\\"
			+ "/\\S+\\/|(?:v|e(?:mbed)?)\\/|\\S*?[?&]v=)|youtu\\.be\\/)([a-zA-Z0-9_-]{11})");
		const apiRegex = /^AIza[a-zA-Z0-9\_]{35}$/;
		var msgNum = 0;
		var vid = null;
		var unzipMatches = function(a, s) {
			var m;
			while(m = timeRegex.exec(s.content))
				a.push(new Comment(s.author, s.content, m[1], ++msgNum));
			return a;
		};
		var getVideoID = function() {
			var m = videoIdRegex.exec(window.location.href);
			return m ? m[1] : null;
		};
		var invidiousRequest = async function(host) {
			return async function(vidID, cb) {
				var url = host + "/api/v1/comments/" + vidID + "?fields=continuation,comments/author,comments/content"
				var l = [];
				try {
					var cnt = "";
					do {
						var promise = await fetch(url + cnt);
						var res = await promise.json();
						if (res.comments) {
							var r = res.comments.reduce((a, e) => unzipMatches(a, e), [])
								.sort((a, b) => a.getTime() - b.getTime());
							l = l.concat(r);
							if (getVideoID() != vidID) {
								break;
							}
							cb(l);
						}
						cnt = "&continuation=" + res.continuation;
					} while(!!res.continuation);
				} catch (e) {
					console.error("[YTLC] Error occured during fetch(): " + e);
					return;
				}
			};
		};
		var ytApiRequest = async function() {
			var apikey = await browser.storage.local.get("ytlcApiKey");
			var apikey = apikey ? apikey.ytlcApiKey : null;
			if (!apikey || !apiRegex.test(apikey)) {
				console.error("[YTLC] Invalid API key \"" + apikey + "\".");
				return async function(vidID, cb) {
					console.error("[YTLC] Cannot complete request; API key is invalid.");
				};
			}
			return async function(vidID, cb) {
				var url = "https://www.googleapis.com/youtube/v3/commentThreads?key=" + apikey
					+ "&textFormat=plainText&order=relevance&part=snippet&maxResults=100&videoId="
					+ vidID;
				var j;
				try {
					var promise = await fetch(url);
					j = await promise.json();
				} catch (e) {
					console.error("[YTLC] Error occured during fetch(): " + e);
					return;
				}
				var r = j.items
					.map(e => e.snippet.topLevelComment.snippet)
					.map(e => {return {
						author: e.authorDisplayName,
						content: e.textOriginal
					};})
					.reduce((a, e) => unzipMatches(a, e), [])
					.sort((a, b) => a.getTime() - b.getTime());
				cb(r);
			};
		};
		this.request = async function() {
			var vidID = getVideoID();
			if (!vidID) return;
			if (vid == vidID) return;
			vid = vidID;
			// let fn = await invidiousRequest("https://invidio.us");
			let fn = await ytApiRequest();
			fn(vidID, callback);
		};
		this.request();
	};
	var TimeTracker = function(callback) {
		const maxTimeDiff = 3;
		var tf = null;
		var f = null;
		var oldTime = -2 * maxTimeDiff;
		var lastComments = [];
		var comments = [];
		var setHas = function(e, l) {
			return (e && l) ? l.filter(i => i.getID() == e.getID()).length > 0 : false;
		};
		var setDiff = function(x, y) {
			return x ? x.filter(i => !setHas(i, y)) : [];
		};
		var init = function(g) {
			if (f == null)
				f = setInterval(() => {
					if (!tf) return;
					var q = tf();
					if (!q) return;
					var t = q.current;
					if (t !== oldTime) {
						var list = comments.filter(c => Math.abs
							(c.getTime() - t) <= maxTimeDiff);
						var toAdd = setDiff(list, lastComments);
						var toDel = setDiff(lastComments, list);
						if (toAdd.length > 0 || toDel.length > 0)
							g(list, toAdd, toDel);
						lastComments = list;
					}
					oldTime = t;
				}, 100);
		};
		this.setComments = function(c) {
			comments = c;
		};
		this.setTimeFunc = function(timeFunc) {
			tf = timeFunc;
		};
		this.markTimes = function(viewer) {
			if (!tf) return;
			var q = tf();
			if (!q) return;
			var l = q.duration;
			var ranges = comments
				.map(t => t.getTime())
				.map(t => [
					Math.max(0, t - maxTimeDiff) / l,
					Math.min(l, t + maxTimeDiff) / l
				]);
			viewer.refreshProgressBar(ranges);
		};
		init(callback);
	};
	var CommentsView = function() {
		const attrnm = 'ytlcfade';
		var container = null;
		var pc = null;
		var lastTime = null;
		var animLoop = function(ts) {
			if (!lastTime) lastTime = ts;
			var delta = ts - lastTime;
			lastTime = ts;
			for (var i = container.childNodes.length - 1; i >= 0; i--) {
				var x = container.childNodes[i];
				var t = x.getAttribute(attrnm);
				if (!t) continue;
				var m = parseFloat(x.style.opacity);
				if (t == 'out') {
					m = m - delta / 1000.0;
					if (m <= 0.0) container.removeChild(x);
					else x.style.opacity = m;
				} else {
					m = m + delta / 1000.0;
					if (m >= 1.0) {
						m = 1.0;
						x.removeAttribute(attrnm);
					}
					x.style.opacity = m;
				}
			}
			requestAnimationFrame(animLoop);
		};
		var init = function() {
			container = document.createElement('div');
			var s = container.style;
				s.position = 'absolute';
				s.display = 'inline-block';
				s.fontSize = '18px';
				s.textShadow = '0px 0px 2px #000000';
				s.bottom = '60px';
				s.right = '10px';
				s.zIndex = 70;
				s.textAlign = 'right';
				s.verticalAlign = 'bottom';
				s.width = '50%';
			container.className = 'annotation-type-text';
			requestAnimationFrame(animLoop);
			makeProgressMarkBar();
		};
		var makeProgressMarkBar = function() {
			pc = document.createElement('div');
			var s = pc.style;
				s.position = 'absolute';
				s.display = 'block';
				s.width = '100%';
				s.height = '5px';
				s.zIndex = 70;
				s.top = '-5px';
				s.left = '0';
		};
		var makeProgressMark = function(a) {
			var m = document.createElement('div');
			var s = m.style;
				s.position = 'absolute';
				s.display = 'block';
				s.top = '0px';
				s.height = '100%';
				s.background = 'rgba(120, 255, 0, 0.4)';
				s.left = '' + (a[0] * 100.0).toPrecision(5) + '%';
				s.width = '' + ((a[1] - a[0]) * 100.0).toPrecision(5) + '%';
			if (pc) pc.appendChild(m);
		};
		this.refreshProgressBar = function(marks) {
			if (!pc) return;
			while(pc.firstChild)
				pc.removeChild(pc.firstChild);
			for(a of marks)
				makeProgressMark(a);
		};
		var makeCommentDiv = function(e) {
			var cnt = document.createElement('div');
			cnt.id = e.getID();
			cnt.style.opacity = 0;
			cnt.setAttribute(attrnm, 'in');
			var div = document.createElement('div');

			var author = document.createElement('b');
			author.appendChild(document.createTextNode(e.getAuthor()+': '));
			div.appendChild(author);
			
			var msg = document.createElement('span');
			var ll = ('"' + e.getMessage() + '"').split(e.getTimeAsString());
			var ft = false;
			for (h of ll) {
				if (ft) {
					var sp = document.createElement('span');
					sp.style.textDecoration = 'underline';
					sp.style.borderRadius = '2px';
					sp.style.padding = '2px';
					sp.style.background = 'rgba(0, 0, 0, 0.8)';
					sp.appendChild(document.createTextNode(e.getTimeAsString()));
					msg.appendChild(sp);
				}
				ft = true;
				msg.appendChild(document.createTextNode(h));
			}
			div.appendChild(msg);
			div.style.padding = '5px';
			div.style.display = 'inline-block';
			div.style.background = 'rgba(0,0,0,0.5)';
			div.style.borderRadius = '4px';
			div.style.maxWidth = '100%';
			div.style.marginTop = '5px';
			cnt.appendChild(div);
			return cnt;
		};
		var push = function(l) {
			l.forEach(i => {
				var nw = true;
				for (x of container.childNodes)
					if (x.id == i.getID()) {
						x.setAttribute(attrnm, 'in');
						nw = false;
					}
				if (nw) container.appendChild(makeCommentDiv(i));
			});
		};
		var pop = function(l) {
			l.forEach(i => {
				for (x of container.childNodes)
					if (x.id == i.getID())
						x.setAttribute(attrnm, 'out');
			});
		};
		this.update = function(add, rm) {
			pop(rm);
			push(add);
		};
		this.attachTo = function(player, pbar) {
			if (player) player.appendChild(container);
			if (pbar) pbar.appendChild(pc);
		};
		init();
	};
	var PageTracker = function(callback) {
		var lastLoc = null;
		var lastPlayer = null;
		var lastFunc = null;
		var lastPbar = null;
		var setupCalled = false;
		var setup = function() {
			if (setupCalled) return;
			setupCalled = true;
			var f = () => {
				var w = window.wrappedJSObject;
				if (!w) w  = window;
				var pbar   = document.body.querySelector('.ytp-progress-list');
				var player = w.movie_player;
				var func   = player ? player.getProgressState : null;
				var href   = window.location.href;
				
				var playerChanged = player != lastPlayer;
				var pbarChanged   = pbar != lastPbar;
				if (pbarChanged || playerChanged || lastLoc != href || func != lastFunc) {
					lastPlayer = player;
					lastLoc    = href;
					lastFunc   = func;
					lastPbar   = pbar;
					callback(playerChanged ? player : null, func, pbarChanged ? pbar : null);
				}
			};
			setInterval(f, 250);
			f();
		};
		window.addEventListener('load', setup);
		setup();
	};
	var init = function() {
		var viewer    = new CommentsView();
		var tracker   = new TimeTracker((x, a, b) => viewer.update(a, b));
		var requester = new CommentsRequester(r => {
			tracker.setComments(r);
			tracker.markTimes(viewer);
		});
		new PageTracker((player, getTimeFunc, pbar) => {
			viewer.attachTo(player, pbar);
			tracker.setTimeFunc(getTimeFunc);
			requester.request();
		});
	};
	init();
};
var ytlc = new YTLC();
