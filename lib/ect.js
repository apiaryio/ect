/*!
 * ECT CoffeeScript template engine v0.5.9-layout-server
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
	var CoffeeScript;

	var	ECT = function (options) {
		if (!(this instanceof ECT)) {
			return new ECT(options);
		}

		this.options = {
			open : '<%',
			close : '%>',
			ext : '',
			cache : true,
			watch : false,
			root : ''
		};

		var
			ect = this,
			trimExp = /^[ \t]+|[ \t]+$/g,
			newlineExp = /\n/g,
			cache = {},
			names = {},
			watchers = {},
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
					try {
						return fs.readFileSync(file, 'utf8');
					} catch (e) {
						throw new Error ('Failed to load template ' + file);
					}
				}
			},

			compile = function (template) {
				var
					lineNo = 1,
					bufferStack = [ '__ectOutput' ], bufferStackPointer = 0,
					buffer = bufferStack[bufferStackPointer] + ' = \'',
					matches = template.split(new RegExp(regExpEscape(ect.options.open) + '((?:.|[\r\n])+?)(?:' + regExpEscape(ect.options.close) + '|$)')),
					output, text, command, line,
					prefix, postfix, newline,
					indentChar, indentation = '', indent = false, indentStack = [], indentStackPointer = -1, baseIndent, lines, j;

				for (var i = 0; i < matches.length; i++) {
					text = matches[i];
					command = '';
					if (i % 2 === 1) {
						line = '__ectFileInfo.line = ' + lineNo;
						switch (text.charAt(0)) {
						case '=':
							prefix = '\' + (' + line + '\n\'\') + __ectTemplateContext.escape(';
							postfix = ') + \'';
							newline = '';
							text = text.substr(1);
							output = 'escaped';
							break;
						case '-':
							prefix = '\' + (' + line + '\n\'\') + ((';
							postfix = ') ? \'\') + \'';
							newline = '';
							text = text.substr(1);
							output = 'unescaped';
							break;
						default:
							prefix = '\'\n' + line;
							postfix = '\n' + bufferStack[bufferStackPointer] + ' += \'';
							newline = '\n';
							output = 'none';
						}
						text = text.replace(trimExp, '');

						command = text.split(/[^a-z]+/)[0];
						if ((indentChar = indentChars[text.charAt(text.length - 1)])) {
							text = text.replace(/:$/, '').replace(trimExp, '');
							if (indentChar === '>') {
								if (/[$a-z_][0-9a-z_$]*[^=]+(-|=)>/i.test(text.replace(/'.*'|".*"/, ''))) {
									indentStack.push('capture_output_' + output);
									indentStackPointer++;
								}
								bufferStack.push('__ectFunction' + bufferStackPointer);
								bufferStackPointer++;
								postfix = '\n' + bufferStack[bufferStackPointer] + ' = \'';
								command = 'function';
							}
							indentStack.push(command);
							indentStackPointer++;
							indent = true;
						}
						switch (command) {
						case 'include' :
							if (output === 'none') {
								prefix = '\' + (' + line + '\n\'\') + (';
								postfix = ') + \'';
							}
							buffer += prefix.replace(newlineExp, '\n' + indentation) + text + postfix.replace(newlineExp, '\n' + indentation);
							break;
						case 'block' :
							bufferStack.push('__ectTemplateContext.blocks[\'' + text.replace(/block\s+('|")([^'"]+)('|").*/, '$2') + '\']');
							bufferStackPointer++;
							prefix = '\'\n';
							postfix = '\n' + bufferStack[bufferStackPointer] + ' += \'';
							text = 'if ' + text;
							buffer += prefix.replace(newlineExp, '\n' + indentation) + text;
							if (indent) {
								indentation += '  ';
								indent = false;
							}
							buffer += postfix.replace(newlineExp, '\n' + indentation);
							break;
						case 'content' :
							if (output === 'none') {
								prefix = '\' + (' + line + '\n\'\') + (';
								postfix = ') + \'';
							}
							if (text === 'content') {
								text = 'content()'
							}
							buffer += prefix.replace(newlineExp, '\n' + indentation) + text + postfix.replace(newlineExp, '\n' + indentation);
							break;
						case 'end' :
							prefix = '\'';
							switch (indentStack[indentStackPointer]) {
							case 'block' :
								bufferStack.pop();
								bufferStackPointer--;
								prefix = '\'';
								postfix = '\n' + bufferStack[bufferStackPointer] + ' += \'';
								buffer += prefix.replace(newlineExp, '\n' + indentation);
								indentation = indentation.substr(2);
								buffer += postfix.replace(newlineExp, '\n' + indentation);
								break;
							case 'when' :
								postfix = '\n' + bufferStack[bufferStackPointer] + ' += \'\'';
								buffer += prefix.replace(newlineExp, '\n' + indentation) + postfix.replace(newlineExp, '\n' + indentation);
								indentation = indentation.substr(2);
								break;
							case 'function' :
								prefix = '\'\n' + bufferStack[bufferStackPointer];
								buffer += prefix.replace(newlineExp, '\n' + indentation);
								indentation = indentation.substr(2);
								bufferStack.pop();
								bufferStackPointer--;
								postfix = '\n' + bufferStack[bufferStackPointer] + ' += \'';
								switch (indentStack[indentStackPointer - 1]) {
									case 'capture_output_escaped' :
										indentStack.pop();
										indentStackPointer--;
										buffer += ')';
										break;
									case 'capture_output_unescaped' :
										indentStack.pop();
										indentStackPointer--;
										buffer += ') ? \'\')';
										break;
									case 'capture_output_none' :
										indentStack.pop();
										indentStackPointer--;
										break;
								}
								buffer += postfix.replace(newlineExp, '\n' + indentation);
								break;
							case 'switch' :
								prefix = '\n' + line;
							default :
								if (indentStack[indentStackPointer - 1] === 'switch') {
									postfix = '';
								}
								indentation = indentation.substr(2);
								buffer += prefix.replace(newlineExp, '\n' + indentation) + postfix.replace(newlineExp, '\n' + indentation);
							}
							indentStack.pop();
							indentStackPointer--;
							break;
						case 'else' :
							if (indentStack[indentStackPointer - 1] === 'switch') {
								prefix = '';
							} else {
								prefix = '\'';
							}
							buffer += prefix.replace(newlineExp, '\n' + indentation);
							if (indentStack[indentStackPointer - 1] === 'if' || indentStack[indentStackPointer - 1] === 'else' || indentStack[indentStackPointer - 1] === 'unless') {
								indentStack.splice(-2, 1);
								indentStackPointer--;
								indentation = indentation.substr(2);
							}
							buffer += (newline.length ? newline + indentation : '') + text;
							if (indent) {
								indentation += '  ';
								indent = false;
							}
							buffer += postfix.replace(newlineExp, '\n' + indentation);
							break;
						case 'switch' :
							buffer += prefix.replace(newlineExp, '\n' + indentation) + (newline.length ? newline + indentation : '') + text;
							if (indent) {
								indentation += '  ';
								indent = false;
							}
							break;
						case 'when' :
							buffer += (newline.length ? newline + indentation : '') + text;
							if (indent) {
								indentation += '  ';
								indent = false;
							}
							buffer += postfix.replace(newlineExp, '\n' + indentation);
							break;
						case 'extend' :
								text = '__ectExtended = true\n__ectParent = ' + text.replace(/extend\s+/, '');
						default :
							if (/\n/.test(text)) {
								lines = text.split(/\n/);
								buffer += prefix.replace(newlineExp, '\n' + indentation);
								for (j = 0; j < lines.length; j++) {
									if (/^\s*$/.test(lines[j])) {
										continue;
									}
									if (typeof baseIndent === 'undefined') {
										baseIndent = new RegExp('^' + lines[j].substr(0, lines[j].search(/[^\s]/)));
									}
									buffer += (newline.length ? newline + indentation : '') + lines[j].replace(baseIndent, '');
								}
								lines = undefined;
								baseIndent = undefined;
							} else {
								buffer += prefix.replace(newlineExp, '\n' + indentation) + (newline.length ? newline + indentation : '') + text;
							}
							if (indent) {
								indentation += '  ';
								indent = false;
							}
							buffer += postfix.replace(newlineExp, '\n' + indentation);
							break;
						}
					} else {
						if (indentStack[indentStackPointer] !== 'switch') {
							buffer += text.replace(/[\\']/g, '\\$&').replace(/\r/g, '').replace(newlineExp, '\\n').replace(/^\\n/, '');
						}
					}
					lineNo += text.split(newlineExp).length - 1;
				}
				buffer += '\'\nif not __ectExtended\n  return __ectOutput\nelse\n  __ectContainer = __ectTemplateContext.load __ectParent\n  __ectFileInfo.file = __ectContainer.file\n  __ectFileInfo.line = 1\n  __ectTemplateContext.childContent = __ectOutput\n  return __ectContainer.compiled.call(this, __ectTemplateContext, __ectFileInfo, include, content, block)';
				buffer = '__ectExtended = false\n' + buffer;

				return eval('(function __ectTemplate(__ectTemplateContext, __ectFileInfo, include, content, block) {\n' + CoffeeScript.compile(buffer, { bare : true }) + '});');
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

			if (ect.options.cache && !!nameAppend && cache[template + nameAppend]) {
				return cache[template + nameAppend];
			} else if (ect.options.cache && cache[template] && !nameAppend) {
				return cache[template];
			} else {
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
						compiled = compile(data);
					} catch (e) {
						e.message = e.message.replace(/ on line \d+/, '') + ' in ' + file;
						throw e;
					}
				}
				container = { file : file, compiled : compiled, source : '(' + compiled.toString() + ');', lastModified: new Date().toUTCString(), gzip : null };
				if (ect.options.cache) {
					cache[template + nameAppend] = container;
					if (!names[template]) {
						names[template] = [];
					}
					names[template].push(template + nameAppend);
				}
				if (ect.options.watch && typeof watchers[file] === 'undefined') {
					watchers[file] = fs.watch(file, { persistent: false }, function () {
						watchers[file].close();
						delete (watchers[file]);
						for (var i = names[template].length - 1; i >= 0; i--) {
							delete (cache[names[template][i]]);
						};
						names[template] = [];
					});
				}
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
				compiled = compile(template);
				return compiled;
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

		this.clearCache = function (template) {
			if (template) {
				delete (cache[template]);
			} else {
				cache = {};
			}
		};

		if (typeof module !== 'undefined' && module.exports) {
			this.compiler = function (options) {
				var zlib = require('zlib');
				options = options || {};
				options.root = options.root || '/';
				options.root = '/' + options.root.replace(/^\//, '');
				options.root = options.root.replace(/\/$/, '') + '/';
				var rootExp = new RegExp('^' + regExpEscape(options.root));
				return function (req, res, next) {
					if (req.method !== 'GET' && req.method !== 'HEAD') {
						return next();
					}
					if (!options.root || req.url.substr(0, options.root.length) === options.root) {
						var template = req.url.replace(rootExp, '');
						try {
							var context = new TemplateContext();
							var container = context.load(template, options.layout);
							res.setHeader('Content-Type', 'application/x-javascript; charset=utf-8');
							res.setHeader('Last-Modified', container.lastModified);
							if (options.gzip) {
								res.setHeader('Content-Encoding', 'gzip');
								if (container.gzip === null) {
									zlib.gzip(container.source, function (err, buffer) {
										if (!err) {
											container.gzip = buffer;
											res.end(container.gzip);
										} else {
											next(err);
										}
									});
								} else {
									res.end(container.gzip);
								}
							} else {
								res.setHeader('Content-Length', typeof Buffer !== 'undefined' ? Buffer.byteLength(container.source, 'utf8') : container.source.length);
								res.end(container.source);
							}
						} catch (e) {
							next(e);
						}
					} else {
						next();
					}
				}
			};
		}

		this.configure(options);
	};

	if (typeof module !== 'undefined' && module.exports) {
		fs = require('fs');
		path = require('path');

		if (true) {
			CoffeeScript = require('coffee-script');
			module.exports = ECT;
		}
	}
}());
