/*
MIT License

Copyright (c) 2019 Rafal Okninski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
*/

const {
	ExpressionEngine,
	Functions
} = require('./expressionEngine');

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

	applyFilter() {
		return true
	}

	custom(expression, row) {
		var customExpression = this.expressions[expression];
		if (!customExpression)
			this.expressions[expression] = customExpression = this.generateExpressionTree(expression);
		return this.executeExpressionTree(customExpression, row);
	}
}

module.exports = Filter