var YTLC = function() {
	var Comment = function(author, text, timeText) {
		const idPrefix = 'comment_';
		const hash = function(s) {
			for(var i = 0, h = 0; i < s.length; i++)
				h = Math.imul(31, h) + s.charCodeAt(i) | 0;
			return h;
		};
		var parseTime = function(t) {
			return t.split(':').map(e => parseInt(e))
				.reduce((a, e) => a * 60 + e, 0);
		};
		var identifier = idPrefix + hash(author + ":" + text);
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
		const pollt = 250;
		const timeRegex = new RegExp
			("(?:[^:\\d]|^)((?:\\d{1,2}:[0-5]|[0-5]?)\\d:[0-5]\\d)", "g");
		const cc = 'ytd-comment-thread-renderer>ytd-comment-renderer>#body>#main';
		const parseCmt = function(ct) {
			let c = [];
			for (let comment of ct) {
				let author = comment.querySelector
					('#header #author-text span').innerText;
				let commentElem = comment.querySelector
					('#content yt-formatted-string#content-text');
				let commentText = commentElem.innerText;
				// let commentMarkup = commentElem.innerHTML;
				var m; while(m = timeRegex.exec(commentText))
					c.push(new Comment(author, /*commentMarkup*/ commentText, m[1]));
			}
			return c.sort((x, y) => x.getTime() - y.getTime());
		};
		const scrapeComments = function(fn) {
			var cmt = document.querySelector('ytd-comments');
			if (cmt && cmt.wrappedJSObject.loadComments) {
				new MutationObserver(function(ms) {
					let res = cmt.querySelectorAll(cc);
					let cmts = parseCmt(res);
					fn(cmts);
					if (cmts.length < 100 && res.length < 1000)
						cmt.wrappedJSObject.loadComments();
				}).observe(cmt, {subtree: true, childList: true});
				cmt.wrappedJSObject.loadComments();
			} else setTimeout(() => scrapeComments(fn), pollt);
		};
		this.request = () => scrapeComments(callback);
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
			viewer.refreshProgressBar(comments.map(t => t.getTime()), Math.round(q.duration)|0);
		};
		init(callback);
	};
	var CommentsView = function() {
		const coeffs = new Array(6);
		for (let i = 0; i < 6; i++)
			coeffs[i] = Math.pow(Math.cos(i / 12.0 * Math.PI), 2);
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
				s.bottom = '75px';
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
			pc = document.createElement('canvas');
			var s = pc.style;
				s.position = 'absolute';
				s.display = 'block';
				s.width = '100%';
				s.height = '25px';
				s.zIndex = 70;
				s.top = '-25px';
				s.left = '0';
				s.pointerEvents = 'none';
		};
		this.refreshProgressBar = function(pts, l) {
			if (!pc) return;
			var marks = new Array(l * 2).fill(0);
			for (x of pts) {
				let t = x * 2;
				marks[t] += coeffs[0];
				for (let i = 1; i < coeffs.length; i++) {
					if (t + i < marks.length) marks[t + i] += coeffs[i];
					if (t - i >= 0) marks[t - i] += coeffs[i];
				}
			}
			var max = 1; for (x of marks) if (x > max) max = x;
			var ctx = pc.getContext('2d');
			var positionInfo = pc.getBoundingClientRect();
			var h = positionInfo.height;
			var w = positionInfo.width;
			pc.width = w;
			pc.height = h;
			var grad= ctx.createLinearGradient(0, 0, 0, h);
			grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
			grad.addColorStop(0.33, 'rgba(255, 255, 255, 1)');
			ctx.strokeStyle = grad;
			for (p of pts) {
				let x = w * 2 * p / (marks.length - 1);
				ctx.beginPath();
				ctx.moveTo(x, 0);
				ctx.lineTo(x, h);
				ctx.stroke();
			}
			ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
			ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'
			ctx.beginPath();
			ctx.moveTo(0, h);
			for (let i = 0; i < marks.length; i++) {
				let lh = 1 - marks[i] / max;
				let y = h * Math.pow(lh, 2);
				let x = w * i / (marks.length - 1);
				ctx.lineTo(x, y);
			}
			ctx.lineTo(w, h);
			ctx.fill();
			ctx.stroke();
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
			var f = () => tracker.markTimes(viewer);
			f();
			window.addEventListener("resize", f);
			window.addEventListener("fullscreenchange", f);
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
