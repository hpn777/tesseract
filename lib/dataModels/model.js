var Backbone = require('./backbone')

class Model  extends Backbone.Model{
	addEventListener (name, handler, ref) {
		this.on(name, handler, ref)
	}

	removeEventListener (name, handler, ref) {
		this.off(name, handler, ref)
	}

	remove () {
		this.trigger('remove', this)
		this.off('remove')
		this.collection.remove(this)
		this.off()
	}
}
module.exports = Model
