/**
 * jquery.stylesheet
 * Stylesheet injector utility with workarounds
 * for IE's 31 stylesheet limitation.
 *
 * Copyright (c) 2012 Jensen Tonne
 * www.jstonne.com
 *
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 */

var head = document.getElementsByTagName('head')[0],
	stylesheets = document.styleSheets,
	IE_STYLESHEET = document.createStyleSheet,
	IE_MAX_STYLESHEET = 31,
	IE_MAX_IMPORT = 31,
	IE_MAX_RULE = 4095;

$.stylesheet = (function() {

	var self = function(url, attr) {

		var options = {};

		$.extend(

			options,

			self.defaultOptions,

			($.isPlainObject(url)) ?
				url :
				{
					url: url,
					attr: attr || {}
				}
		);

		// Create a new stylesheet object
		if (options.url===undefined) {

			return self.create(options);
		}

		// Loading an external stylesheet
		return self.load(options);
	};

	$.extend(self, {

		defaultOptions: {

			type: "text/css",

			rel: "stylesheet",

			media: "all",

			title: "",

			// Force link injection, ignores IE workarounds, overrides XHR value.
			forceInject: false,

			// @TODO: XHR loading.
			xhr: false
		},

		setup: function(options) {

			$.extend(self.defaultOptions, options);
		},

		availability: function() {

			// @TODO: Also calculate bleedImports.
			var stat = {},
				links = $('link[rel*="stylesheet"]')
				styles = $('style');

			stat.groups = IE_MAX_STYLESHEET - links.length - styles.length;

			stat.slots = stat.groups * IE_MAX_IMPORT;

			if (self.currentGroup) {
				stat.slots += IE_MAX_IMPORT - self.currentGroup.imports.length;
			}

			return stat;
		},

		create: function(options) {

			var stylesheet,
				length = stylesheets.length;

			if (IE_STYLESHEET) {
				// Unable to create further stylesheets
				if (length>=IE_MAX_STYLESHEET) return;
				stylesheet = document.createStyleSheet();
			} else {
				head.appendChild(document.createElement('style'));
				stylesheet = stylesheets[stylesheets.length - 1];
			}

			// Fill in attributes
			stylesheet.title = options.title;
			stylesheet.media = options.media;
			(stylesheet.ownerNode || stylesheet.owningElement).type = options.type;

			return stylesheet;
		},

		nextAvailable: function(alsoCreateIfUnavailable) {

			var stylesheet,
				length = stylesheets.length;

			if (length) {

				var i;

				for (i=length; i--; i<0) {

					stylesheet = stylesheets[i];

					// If this is IE and the maximum amount of rules have exceeded,
					if (IE_STYLESHEET && ((stylesheet.cssRules || stylesheet.rules).length >= IE_MAX_RULE)) {

						// then this stylesheet cannot be used.
						stylesheet = undefined;

						// try an older stylesheet.
						continue;
					}

					break;
				}
			}

			return stylesheet || ((alsoCreateIfUnavailable) ? self() : undefined);
		},

		load: function(options) {

			if ($.browser.msie && !options.forceInject) {

				return self._import(options);

			} else {

				// @TODO: Use onload/onerror events on browsers that support them.
				var link =
					$('<link>')
						.attr({
							href: options.url,
							type: options.type,
							rel: options.rel,
							media: options.media
						})
						.appendTo('head');

				return link[0];
			}
		},

		_import: function(options) {

			var failed;

			if (self.currentGroup===undefined) {

				var group;

				try {

					group = document.createStyleSheet();

					// It is only a getter on IE.
					// group.type = "text/css";

					group.media = "all";
					group.title = "jquery_stylesheet";

				} catch(e) {

					failed = true;

					if (options.verbose) {
						console.error('There is not enough slots left to create a new stylesheet group.');
					}
				}

				if (failed) return false;

				self.currentGroup = group;
			}

			try {

				self.currentGroup.addImport(options.url);

			} catch(e) {

				failed = true;

				if (options.verbose) {
					console.info('Import slots exceeded. Creating a new stylesheet group.');
				}
			}

			if (failed) {

				self.currentGroup = undefined;

				return self._import(options);
			}

			return true;
		}

	});

	return self;

})();
