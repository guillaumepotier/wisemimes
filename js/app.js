(function($, _, undefined) {

	function App() {
		this.games = [];
		return this;
	}

	App.prototype = {
		/*
		 * Initialize
		 */

		init: function () {
			$('#game').addClass('hide');
			this.duration = 120;

			this.setBestScore(window.localStorage.best);
			this.bindEvents();
		},

		/*
		 * Events
		 */

		bindEvents: function () {
			$(window).on('keyup', _.bind(this.onKeyUp, this));
			$('body').on('slides:empty', _.bind(this.onSlideEmpty, this));
			$('#start').on('click', _.bind(this.onNewGame, this));
		},

		onNewGame: function (event) {
			if (this.game)
				return;
			// show game panel
			$('#game').removeClass('hide');

			// create new game
			this.game = new Game('#game');
			this.games.push(this.game);

			// start game
			this.game.start(3)
				.done(_.bind(this.start, this));
		},

		onKeyUp: function (event) {
			event.preventDefault();
			switch (event.keyCode) {
				case 32: // space
				case 39: // ->
				case 13: // enter
					if (this.game)
						this.game.next();
					break;
				case 27: // esc
					if (this.game && this.game.isStarted)
						this.stop();
					break;
				case 88: // x
					if (this.game)
						this.game.ko();
					break;
				case 86: // v
					if (this.game)
						this.game.ok();
					break;
				case 82: // r
					if (!this.game)
						this.setBestScore(0, true);
					break;

			}
		},

		onSlideEmpty: function (event) {
			if (this.game)
				this.timeout = -1;
			alert('no more slide ....');
		},

		/*
		 * Actions
		 */

		start: function () {
			if (!this.game)
				return;

			// launch timer
			this.timer(this.duration)
				.done(_.bind(this.stop, this));

			// show first slide
			this.game.showSlide();
		},

		stop: function () {
			// stop timer
			this.timeout = -1;

			// stop game
			this.game.stop(5)
				.done(_.bind(function () {
					// save best score
					this.setBestScore(this.game.score);

					// close game
					this.game = null;
					$('#game').addClass('hide');
				}, this));
		},

		timer: function (timeout) {
			var dfd = $.Deferred();
			if (this.timeout >= 0) {
				dfd.reject();
				return dfd.promise();
			}
			this.timeout = timeout;
			var fn = _.bind(function () {
				if (this.timeout >= 0) {
					this.setTime(this.timeout--);
					setTimeout(function () { fn(); }, 1000);
				} else {
					dfd.resolve();
				}
			}, this);
			fn();
			return dfd.promise();
		},

		setBestScore: function (score, force) {
			this.best = force !== true ? Math.max(this.best || 0, score || 0) : score;
			window.localStorage.best = this.best;
			$('#best').html(this.best ? 'best score: <strong>' + this.best + '</strong>' : '');
		},

		setTime: function (time) {
			var pad = function (n) {
				return (n < 10 ? '0' + n : n);
			};
			var min = Math.floor((time / 3600) % 1 * 60),
				sec = Math.floor((time / 60) % 1 * 60);

			$('#timer').html(pad(min) + ':' + pad(sec));
		}
	};

	function Game(selector, users) {
		this.$el = $(selector).eq(0);
		this.$ = function (selector) { return this.$el.find(selector); };
		this.el = this.$el.get(0);

		// reset
		this.isStarted = false;
		this.setScore(0);

		// todo
		this.users = users || [];
	}

	Game.prototype = {

		start: function (timeout) {
			this.$el.removeClass('ok ko best').attr('data-status', 'countdown');
			this.preloadSlide();

			var dfd = $.Deferred(),
				$countdown = this.$('#countdown'),
				fn = _.bind(function (timeout) {
					if (timeout >= 0) {
						$countdown
							.removeClass('spread')
							.addClass('hide')
							.html(timeout || 'Go !');
						setTimeout(function () {
							$countdown
								.removeClass('hide')
								.addClass('spread');
						}, 10);
						setTimeout(function () { fn(timeout - 1); }, 1000);
					} else {
						this.$('#countdown').addClass('hide');
						this.setScore(0);
						this.isStarted = true;
						this.$el.attr('data-status', 'started');
						dfd.resolve();
					}
				}, this);
			fn(timeout);
			return dfd.promise();
		},

		preloadSlide: function (force) {
			if (force !== true && this.preloadDfd)
				return this.preloadDfd;

			var dfd = $.Deferred();
			this.preloadDfd = dfd;

			if (!window.slides.length) {
				dfd.reject();
				return dfd.promise();
			}

			var index = _.random(window.slides.length - 1),
				url = window.slides[index],
				$slide = $('<div />').addClass('slide next hide').appendTo('#slider'),
				img = new Image();

			console.log('preload slide', index, url, img);

			$(img)
				.addClass('img-thumbnail')
				.one('load', _.bind(function (event) {
					// append img to next slide
					$slide.append(img);
					// resolve
					console.log('slide prelaoded', index, url,  $slide.get(0), img);
					dfd.resolve(index, url, $slide.get(0), img);
				}, this))
				.one('error', _.bind(function (event) {
					console.error('invalid url at index', index, url);
					// remove invalid slide url
					window.slides.splice(index, 1);
					// preload another slide
					this.preloadSlide(true)
						.done(dfd.resolve)
						.fail(dfd.reject);
				}, this))
				.attr('src', url);
			return dfd.promise();
		},


		showSlide: function () {
			var $current = this.$('#slider .slide.current');

			console.log('show slide', this.preloadDfd.state());

			return (this.preloadDfd || this.preloadSlide())
				.done(_.bind(function (index, url, slide, img) {
					console.log('ready to show slide', index, url, slide, img);
					// remove loaded slide url
					window.slides.splice(index, 1);
					$(slide).removeClass('hide');
					setTimeout(_.bind(function () {
						// set next slide as current
						$(slide).removeClass('next').addClass('current');
						// set current slide as previous
						$current.removeClass('current').addClass('previous');
						// remove previous slide
						setTimeout(function () {
							$current.remove();
						}, 500);
						// preload next slide
						this.preloadSlide(true);
					}, this), 10);
				}, this))
				.fail(_.bind(function () {
					this.isStarted = false;
					$('body').trigger('slides:empty');
				}, this));
		},

		next: function () {
			if (!this.isStarted || !(this.$el.hasClass('ok') || this.$el.hasClass('ko')))
				return;

			// show next slide
			this.showSlide()
				.always(_.bind(function () {
					// update score
					if (this.$el.hasClass('ok'))
						this.setScore(this.score + 1);
					this.$el.removeClass('ok ko');
				}, this));
		},

		ok: function () {
			this.$el.removeClass('ko').addClass('ok');
		},

		ko: function () {
			this.$el.removeClass('ok').addClass('ko');
		},

		stop: function (timeout) {
			var dfd = $.Deferred();

			if (!this.isStarted) {
				dfd.reject();
				return dfd.promise();
			}
			this.isStarted = false;

			// chek if last slide has been validated or not
			if (!this.$el.hasClass('ok') && !this.$el.hasClass('ko'))
				this.$el.addClass('ok ko');

			var fn = _.bind(function () {
					// wait until last slide has been validated or not
					if (this.$el.hasClass('ok') && this.$el.hasClass('ko'))
						return setTimeout(function () { fn(); }, 100);

					// update score
					if (this.$el.hasClass('ok'))
						this.setScore(this.score + 1);
					this.$el.removeClass('ok ko');

					// end
					this.$el.attr('data-status', 'ended');
					setTimeout(_.bind(function () {
						dfd.resolve();
					}, this), timeout * 1000 || 0);
				}, this);
			fn();
			return dfd.promise();
		},

		setScore: function (score) {
			this.score = Math.max(0, score);
			var best = parseInt(window.localStorage.best, 10) || 0,
				$score = this.$('#score').html('');
			$('<div />').html('score: <strong>' + this.score + '</strong>').appendTo($score);
			if (best)
				$('<div />').addClass('best').html('best: <strong>' + best + '</strong>').appendTo($score);
			if (this.score > best)
				this.$el.addClass('best');
		}
	};

	window.App = new App();
	window.App.init();

})(jQuery, _);
