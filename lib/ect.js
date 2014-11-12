/*!
 * ECT CoffeeScript template engine v0.5.9b
 * https://github.com/baryshev/ect
 *
 * Copyright 2012-2014, Vadim M. Baryshev <vadimbaryshev@gmail.com>
 * Licensed under the MIT license
 * https://github.com/baryshev/ect/LICENSE
 *
 * Includes parts of node
 * https://github.com/joyent/node
 * Copyright Joyent, Inc. and other Node contributors
 * Released under the MIT license
 *
 * Includes Cross-Browser Split 1.1.1
 * http://xregexp.com/
 * Copyright 2007-2012 Steven Levithan <stevenlevithan.com>
 * Released under the MIT license
 */
(function () {
	'use strict';
	var fs;
	var path;

	var	ECT = function (options) {
		if (!(this instanceof ECT)) {
			return new ECT(options);
		}

		this.options = {
			open : '<%',
			close : '%>',
			ext : '',
			root : ''
		};

		var
			ect = this,
			trimExp = /^[ \t]+|[ \t]+$/g,
			newlineExp = /\n/g,
			indentChars = { ':' : ':', '>' : '>' },
			escapeExp = /[&<>"]/,
			escapeAmpExp = /&/g,
			escapeLtExp = /</g,
			escapeGtExp = />/g,
			escapeQuotExp = /"/g,
			regExpEscape = function (str) {
				return String(str).replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&');
			},

			read = function (file) {
				if (Object.prototype.toString.call(ect.options.root) === '[object Object]') {
					var data = file.split('.').reduce(function (currentContext, key) { return currentContext[key]; }, ect.options.root);
					if (Object.prototype.toString.call(data) === '[object String]') {
						return data;
					} else {
						throw new Error ('Failed to load template ' + file);
					}
				} else {
						// return fs.readFileSync(file, 'utf8');
						throw new Error ('Failed to load template ' + file);
				}
			};

		var TemplateContext = function (data) {
			this.blocks = {};
			this.data = data || {};
			this.childContent = '';
		};

		TemplateContext.prototype.escape = function (text) {
			if (text == null) {
				return '';
			}
			var result = text.toString();
			if (!escapeExp.test(result)) {
				return result;
			}
			return result.replace(escapeAmpExp, '&#38;').replace(escapeLtExp, '&#60;').replace(escapeGtExp, '&#62;').replace(escapeQuotExp, '&#34;');
		};

		TemplateContext.prototype.block = function (name) {
			if (!this.blocks[name]) { this.blocks[name] = ''; }
			return !this.blocks[name].length;
		};

		TemplateContext.prototype.content = function (block) {
			if (block && block.length) {
				if (!this.blocks[block]) { return ''; }
				return this.blocks[block];
			} else {
				return this.childContent;
			}
		};

		TemplateContext.prototype.load = function (template, layout) {
			var file, compiled, container, data;

			var nameAppend = '';
			if (layout && typeof layout === 'string') {
				nameAppend = '__ectExtendedLayout__' + layout;
			}

			if (true) {
				var extExp = new RegExp(regExpEscape(ect.options.ext) + '$');
				if (Object.prototype.toString.call(ect.options.root) === '[object String]') {
					if (typeof process !== 'undefined' && process.platform === 'win32') {
						file = path.normalize((ect.options.root.length && template.charAt(0) !== '/' && template.charAt(0) !== '\\' && !/^[a-zA-Z]:/.test(template) ? (ect.options.root + '/') : '') + template.replace(extExp, '') + ect.options.ext);
					} else {
						file = path.normalize((ect.options.root.length && template.charAt(0) !== '/' ? (ect.options.root + '/') : '') + template.replace(extExp, '') + ect.options.ext);
					}
				} else {
					file = template;
				}

				data = read(file);
				if (data.substr(0, 24) === '(function __ectTemplate(') {
					try {
						compiled = eval(data);
					} catch (e) {
						e.message = e.message + ' in ' + file;
						throw e;
					}
				} else {
					if (nameAppend !== '') {
						data = ect.options.open + ' extend \'' + layout + '\'' + ect.options.close + '\n' + data;
					}
					try {
						throw new Error('Cannot compile templates on client-side.');
						// compiled = compile(data);
					} catch (e) {
						e.message = e.message.replace(/ on line \d+/, '') + ' in ' + file;
						throw e;
					}
				}
				container = { file : file, compiled : compiled, source : '(' + compiled.toString() + ');', lastModified: new Date().toUTCString(), gzip : null };
				return container;
			}
		};

		TemplateContext.prototype.render = function (template, data) {
			var layout;
			if (this.data && (layout = this.data.layout)) {
				this.data.layout = false;
			}
			else if (data && (layout = data.layout)) {
				data.layout = false;
			}
			else {
				layout = undefined;
			}

			var that = this;
			var container = this.load(template, layout);
			var fileInfo = { file : container.file, line : 1 };

			try {
				return container.compiled.call(
					data || this.data,
					this,
					fileInfo,
					function() { return that.render.apply(that, arguments); },
					function() { return that.content.apply(that, arguments); },
					function() { return that.block.apply(that, arguments); }
				);
			} catch (e) {
				if (!/ in /.test(e.message)) {
					e.message = e.message + ' in ' + fileInfo.file + ' on line ' + fileInfo.line;
				}
				throw e;
			}
		};

		this.configure = function (options) {
			options = options || {};
			for (var option in options) {
				this.options[option] = options[option];
			}
		};

		this.compile = function (template) {
			var compiled;
			try {
				throw new Error('Cannot compile templates on client-side.');
				// compiled = compile(template);
				// return compiled;
			} catch (e) {
				e.message = e.message.replace(/ on line \d+/, '');
				throw e;
			}
		};

		this.render = function (template, data, callback) {
			var context;
			if (typeof arguments[arguments.length - 1] === 'function') {
				if (arguments.length === 2) {
					callback = data;
					data = {};
				}
				context = new TemplateContext(data);
				try {
					callback(undefined, context.render(template));
				} catch (e) {
					callback(e);
				}
			} else {
				context = new TemplateContext(data);
				return context.render(template);
			}
		};


		this.configure(options);
	};

	if (true) {

		if (typeof define === 'function' && define.amd ) {
			define(function() {
				return ECT;
			});
		} else {
			window.ECT = ECT;
		}

		path = (function () {
			var
				normalizeArray = function (parts, allowAboveRoot) {
					var up = 0, i, last;
					for (i = parts.length - 1; i >= 0; i--) {
						last = parts[i];
						if (last === '.') {
							parts.splice(i, 1);
						} else if (last === '..') {
							parts.splice(i, 1);
							up++;
						} else if (up) {
							parts.splice(i, 1);
							up--;
						}
					}
					if (allowAboveRoot) {
						while (up) {
							parts.unshift('..');
							up--;
						}
					}
					return parts;
				},

				normalize = function (path) {
					var
						isAbsolute = path.charAt(0) === '/',
						trailingSlash = path.slice(-1) === '/';
					path = normalizeArray(path.split('/').filter(function (p) {
						return !!p;
					}), !isAbsolute).join('/');
					if (!path && !isAbsolute) {
						path = '.';
					}
					if (path && trailingSlash) {
						path += '/';
					}
					return (isAbsolute ? '/' : '') + path;
				};

			return {
				normalize: normalize
			};
		}());


	}
}());
