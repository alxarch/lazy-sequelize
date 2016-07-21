'use strict';
const Sequelize = require('sequelize');
const DataTypes = require('sequelize/lib/data-types');
const Lazybox = require('lazybox');
const assert = require('assert');

const isPlainFunction = fn => 'function' === typeof fn && 'Function' === fn.constructor.name;

const ASSOCIATIONS = Symbol('associations');
const MODELS = Symbol('models');

class LazySequelize extends Sequelize {

	constructor (options) {
		super(options);
		this.initialized = false;
		this[ASSOCIATIONS] = new Set();
		this[MODELS] = new Set();
		this.container = new Lazybox();
		// Intercept define attributes and properties
		this.addHook('beforeDefine', 'lazymodel', this.defineModel.bind(this));
	}

	define (name, attributes, options, associations) {
		// Augment define() with an fourth associations parameter
		this.defineAssociations(name, associations);
		// Intercept define attributes and properties
		super.define(name, attributes, options);
	}

	extend () {
		this.container.extend.apply(this.container, arguments);
		return this;
	}

	initialize () {
		if (this.initialized) {
			return;
		}
		this.initialized = true;
		// Clear the define interceptor
		this.removeHook('beforeDefine', 'lazymodel');
		for (let name of this[MODELS]) {
			this.container.get(name);
		}
		this.container.set(this.models, this.models);
		for (let name of this[ASSOCIATIONS]) {
			this.container.get(name);
		}
		return this.models;
	}

	defineAssociations (name, associations) {
		if (isPlainFunction(associations)) {
			if (this.initialized) {
				associations(this.models);
			}
			else {
				const key = `${name}.associations`
				this[ASSOCIATIONS].add(key);
				this.container.define(key, [this.models, associations]);
			}
		}
	}

	defineModel (attributes, options) {
		if (this.initialized) {
			this.define(attributes, options);
		}
		else {
			const name = options.modelName;
			const attr = `${name}.attributes`;
			const opts = `${name}.options`;
			this[MODELS].add(name);
			this.container.rebase(attr, () => attributes);
			this.container.rebase(opts, () => options);
			this.container.define(name, [attr, opts, (attributes, options) => {
				assert(this.initialized, 'Not yet initialized');
				return this.define(name, attributes, options);
			}]);
		}
	}

}

module.exports = LazySequelize;
