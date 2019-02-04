const {ExpressionEngine, Functions} = require('./expressionEngine');

class Filter extends ExpressionEngine {

    constructor(...args) {
        super(...args)

        var value = this.get('value')

		const comparison = this.get('comparison')
        const field = this.get('field')
        const type = this.get('type')

		switch (type) {
			case 'boolean':
				this.applyFilter = row => {
					return row[field] == value;
				}
				break;
			case 'date':
			case 'datetime':
				value = new Date(value).getTime();
				this.applyFilter = row => {
					return Functions[comparison](row[field], value)
				}
				break;
			case 'custom':
				this.applyFilter = row => {
					return this.custom(value, row)
				}
				break;
			default:
				this.applyFilter = row => {
					return Functions[comparison](row[field], value)
				}
		}
    }

	applyFilter() { return true }

	custom(expression, row) {
		var customExpression = this.expressions[expression];
		if (!customExpression)
			this.expressions[expression] = customExpression = this.generateExpressionTree(expression);
		return this.executeExpressionTree(customExpression, row);
	}
}

module.exports = Filter