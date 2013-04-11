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

				// Fill in attributes
				(stylesheet.ownerNode || stylesheet.owningElement).type = options.type;
				stylesheet.title = options.title;
				stylesheet.media = options.media;

			} else {

				var style = document.createElement('style');
					style.type  = options.type;
					style.title = options.title;
					style.media = options.media;
					head.appendChild(style);

				stylesheet = stylesheets[stylesheets.length - 1];
			}

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

(function(){

var cssRule = function(selector, rules, stylesheet) {
	this.id = $.uid();
	this.stylesheet = stylesheet;

	// If selector is given, automatically add rule.
	// Else assume caller wants a blank rule object.
	if (selector) {
		this.set(selector, rules);
	}
}

$.extend(cssRule.prototype, {

	stylesheet: null,

	selectors: [],

	preRule: "",

	rules: {},

	legacy: $.IE===8,

	set: function(selectors, rules) {

		// Normalize selectors into array
		if ($.isString(selectors)) {
			this.selectors = selectors.split(",");
		}

		// Normalize rules
		if ($.isString(rules)) {
			this.preRule = rules;
			rules = {};
		} else {
			this.preRule = "";
		}

		return this;
	},

	cssText: function() {
		return this.selectors.join(",") + "{" + this.ruleText + "}\n";
	},

	ruleText: function() {
		return this.preRule + "\n" +
		       ((this.legacy) ? "-rule-id:" + this.id + ";" : "") +
			   $.map(this.props, function(val, prop) { return prop + ":" + val; }).join(";");
	},

	update: function() {

		if (this.legacy) return this.updateLegacy();

		// Generate css text
		var cssText = this.cssText();

		// If new, insert textnode
		if (this.textNode===undefined) {
			this.textNode = document.createTextNode(cssText);
			stylesheet.appendChild(this.textNode);

		// Or update existing textnode.
		} else {
			this.textNode.nodeValue = cssText;
		}

		return this;
	},

	updateLegacy: function() {

		var stylesheet = this.stylesheet,
			selectors = this.selectors,
			ruleText = this.ruleText,
			i;

		for (;i<selectors.length;i++) {
			stylesheet.addRule(selectors[i], ruleText);
		}

		return this;
	},

	remove: function() {

		if (this.legacy) return this.removeLegacy();

		// Removing text node is so much quicker
		// than searching for the rule
		this.stylesheet.ownerNode
			.removeChild(this.textNode);

		delete this.textNode;

		return this;
	},

	removeLegacy: function() {

		var stylesheet = this.stylesheet,
			rule = false,
			i = 0;

		do {
			rule = stylesheet.rules[i];

			if (rule.cssText.match(this.id)) {
				stylesheet.removeRule(i);
			}

			i++;

		} while (rule);

		return this;
	},

	css: function(prop, val) {

		// Getter
		if (val===undefined) {
			return this.rules[prop];
		}

		// Setter
		this.rules[prop] = val;
		this.update();

		return this;
	}
});

var self = $.cssRule = function(selector, rules, stylesheet) {

	// Get next available stylesheet if not stylesheet is provided.
	if (!stylesheet) {

		if (self.stylesheet===undefined) {
			self.stylesheet = $.stylesheet();
		}

		stylesheet = self.stylesheet || $.stylesheet.nextAvailable(true);
	}

	// If no stylesheet available at this point, stop.
	if (!stylesheet) return;

	return new cssRule(selector, rules, stylesheet);
};

})();
