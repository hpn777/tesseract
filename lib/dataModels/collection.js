var Backbone = require('./backbone');
var Model = require('./model');

class Collection extends Backbone.Collection{
	get model(){ return Model }

	addEventListener (name, handler, ref) {
		this.on(name, handler, ref)
	}

	removeEventListener (name, handler, ref) {
		this.off(name, handler, ref)
	}

	add (model, options) {
		var self = this;
		if (!Array.isArray(model)) {
			model = [model];
		}
		model.forEach((item) => {
			item.collection = self;
		})
		
		return super.add(model, options);
	}

	set (model, options) {
		var self = this;
		if (!Array.isArray(model)) {
			model = [model];
		}
		model.forEach((item) => {
			item.collection = self;
		});
		return super.set(model, options);
	}
}

module.exports = Collection
