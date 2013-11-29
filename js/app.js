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
			this.duration = 180;
			$('#game').addClass('hide');
			this.bindEvents();
		},

		/*
		 * Events
		 */

		bindEvents: function () {
			$('#start').on('click', _.bind(this.onNewGame, this));
			$(window).on('keyup', _.bind(this.onKeyUp, this));
			$('body').on('slides:empty', _.bind(this.onSlideEmpty, this));
		},

		onNewGame: function (event) {
			$('#game').removeClass('hide');

			this.game = new Game('#game');
			this.games.push(this.game);
			this.game.start(3)
				.done(_.bind(this.start, this));
		},

		onKeyUp: function (event) {
			event.preventDefault();
			if (!this.game)
				return;
			console.log(event.keyCode);
			switch (event.keyCode) {
				case 32: // space
				case 39: // ->
				case 13: // enter
					this.game.next();
					break;
				case 27: // x
					if (this.game.isStarted)
						this.stop();
					break;
				case 88: // x
					this.game.ko();
					break;
				case 86: // v
					this.game.ok();
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
			this.timer(this.duration)
				.done(_.bind(this.stop, this));
			this.game.popSlide();
		},

		stop: function () {
			this.timeout = -1;
			this.game.stop(5)
				.done(_.bind(function () {
					this.best = Math.max(this.best || 0, this.game.score);
					this.game = null;
					$('#best').html('best score: <strong>' + this.best + '</strong>');
					$('#game').addClass('hide');
				}, this));
		},

		timer: function (timeout) {
			this.timeout = timeout;
			var dfd = $.Deferred(),
				fn = _.bind(function () {
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

		this.users = users || [];
		this.isStarted = false;
		this.setScore(0);
	}

	Game.prototype = {

		start: function (timeout) {
			this.$el.removeClass('ok ko').attr('data-status', 'countdown');
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

		popSlide: function () {
			if (!window.slides.length)
				return $('body').trigger('slides:empty');

			var index = _.random(window.slides.length - 1),
				slide = _.first(window.slides.splice(index, 1));

			var $slider = this.$('#slider'),
				$current = $slider.find('.slide.current'),
				$next = $('<div />').addClass('slide next').appendTo($slider);

			$(new Image())
				.addClass('img-thumbnail')
				.appendTo($next)
				.one('load', function (event) {
					var $this = $(this);
					$next.removeClass('next').addClass('current');
					$current.removeClass('current').addClass('previous');
					setTimeout(function () {
						$current.remove();
					}, 500);
				})
				.attr('src', slide);
		},

		next: function () {
			if (!this.isStarted || !(this.$el.hasClass('ok') || this.$el.hasClass('ko')))
				return;
			if (!slides.length) {
				this.isStarted = false;
				return $('body').trigger('slides:empty');
			}

			var slide = this.popSlide();

			if (this.$el.hasClass('ok'))
				this.setScore(this.score + 1);
			this.$el.removeClass('ok ko');
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

			if (!this.$el.hasClass('ok') && !this.$el.hasClass('ko'))
				this.$el.addClass('ok ko');

			var fn = _.bind(function () {
					if (this.$el.hasClass('ok') && this.$el.hasClass('ko'))
						return setTimeout(function () { fn(); }, 100);
					if (this.$el.hasClass('ok'))
						this.setScore(this.score + 1);
					this.$el.removeClass('ok ko');
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
			this.$('#score').html('score: ' + this.score);
		}
	};

	window.App = new App();
	window.App.init();

})(jQuery, _);
