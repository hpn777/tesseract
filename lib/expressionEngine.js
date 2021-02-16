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

var { Model } = require('./dataModels/backbone');
const linq = require('linq')

const Functions = {
	'+': function (a, b) { return a + b; },
	'-': function (a, b) { return a - b; },
	'/': function (a, b) { return a / b; },
	'*': function (a, b) { return a * b; },
	'||': function (a, b) { return a || b; },
	'&&': function (a, b) { return a && b; },
	'==': function (a, b) { return a == b; },
	'eq': function (a, b) { return a == b; },
	'neq': function (a, b) { return a != b; },
	'!=': function (a, b) { return a != b; },
	'lt': function (a, b) { return a < b; },
	'<': function (a, b) { return a < b; },
	'gt': function (a, b) { return a > b; },
	'>': function (a, b) { return a > b; },
	'lte': function (a, b) { return a <= b; },
	'<=': function (a, b) { return a <= b; },
	'gte': function (a, b) { return a >= b; },
	'>=': function (a, b) { return a >= b; },
	'regex': function (a, b) { return a.match(b) },
	'~': function (a, b) { return a && b && a.toLowerCase().indexOf(b.toLowerCase()) !== -1; },
	'like': function (a, b) { return a && b && a.toLowerCase().indexOf(b.toLowerCase()) !== -1; },
	'notlike': function (a, b) { return a && b && a.toLowerCase().indexOf(b.toLowerCase()) === -1; },
	'!~': function (a, b) { return a && b && a.toLowerCase().indexOf(b.toLowerCase()) === -1; },
	'in': function (a, b) { return b && b.indexOf(a) !== -1; },
	'notin': function (a, b) { return b && b.indexOf(a) === -1; },
	'?:': function (a, b, c) { return a ? b : c; }
}

class ExpressionEngine extends Model {

    constructor(...args) {
        super(...args)
        this.expressions = []
    }

	generateExpressionTree(entryString) {
		var me = this;
		var bracketsRegex = /([\"\"])/;
		var stringTokens = {};
		var bracketTokens = {};
		var bracketIndex = 0;

		if (entryString.split(bracketsRegex).length > 0) {
			var matches = entryString.split(bracketsRegex);
			for (var i = 0; i < matches.length; i++) {
				if (matches[i] == '"') {
					var start = i;
					var end = -1;
					for (var k = i + 1; k < matches.length; k++) {

						if (matches[k] == '"' && matches[k - 1] != '\\') {
							end = k;
							i = k;
							break;
						}
					}
					var tempSubString = matches.slice(start + 1, end).join('');
					stringTokens['%%' + start + '%'] = (tempSubString);
					entryString = entryString.replace(matches.slice(start, end + 1).join(''), '%%' + start + '%');
				}
			}
		}

		// entryString = entryString.replace(/\s+/g, '');

		var parseExpression = function (entryString) {
			var bracketsRegex = /([\(\)])/;
			var logicalOperatorsRegex = /(\|\||\&\&)/;
			var booleanOperatorsRegex = /(\=\=|\!\=|\>\=|\<\=|\<|\>|~| like |!~| notlike | in | notin )/;
			var conditionalOperatorsRegex = /(\?|\:)/;
			var arithmeticOperatorsRegex = /(\+|\-|\*|\/)/;
			var functionExprRegex = /(^[a-zA-Z0-9]+\%.*\%)/;
			var attributeExprRegex = /(\.)/;
			var lambdaExprRegex = /(\=\>)/;
			var node = {
				Value: null,
				Type: 'object',
				Operand: null,
				children: [],
				expanded: true,
				ToString: me.ToString
			};

			if (entryString.split(bracketsRegex).length > 0) {//tokenizing brackets
				var matches = entryString.split(bracketsRegex);
				for (var i = 0; i < matches.length; i++) {
					if (matches[i] == "(") {
						var start = i;
						var end = -1;
						var level = 0;
						for (var k = i + 1; k < matches.length; k++) {
							if (k > i) {
								if (matches[k] == ")" && level == 0) {
									end = k;
									i = k;
									break;
								}
								else if (matches[k] == ")")
									level--;
								else if (matches[k] == "(")
									level++;
							}
						}
						var parentNode = parseExpression(matches.slice(start + 1, end).join(''), null);
						bracketTokens['%bracket' + bracketIndex + '%'] = parentNode;
						entryString = entryString.replace(matches.slice(start, end + 1).join(''), '%bracket' + bracketIndex + '%');
						bracketIndex++;
					}
				}
			}

			if (entryString.split(lambdaExprRegex).length == 3) {//parsing lambda expressions
				var lambdaAttributes = entryString.split(lambdaExprRegex);
				node.Operand = "=>";
				node.Type = "lambda";
				node.Value = lambdaAttributes[0].trim();
				var subExpressionNode = parseExpression(lambdaAttributes[2].trim());
				subExpressionNode.scope = lambdaAttributes[0].trim();
				node.children.push(subExpressionNode);
			}
			else if (entryString.split(',').length > 1) {//parsing function attributes
				var functionAttrs = entryString.split(',');
				node.Operand = ",";
				node.Type = 'attributes';
				node.text = "Attributes";
				functionAttrs.forEach(function (functionAttr) {
					node.children.push(parseExpression(functionAttr.trim()));
				});
			}
			else if (entryString.split(conditionalOperatorsRegex).length == 5) {//parsing conditional statements
				var conditionalExprs = entryString.split(conditionalOperatorsRegex);
				var parentNodeCondition;
				node.Operand = "?:";
				node.text = "Conditional Expression";
				node.Type = 'condition';

				if (conditionalExprs[1] == "?" && conditionalExprs[3] == ":") {
					for (var i = 0; i <= 4; i += 2) {
						if (!bracketTokens[conditionalExprs[i]])
							parentNodeCondition = parseExpression(conditionalExprs[i].trim());
						else
							parentNodeCondition = bracketTokens[conditionalExprs[i]];
						node.children.push(parentNodeCondition);
					}
					node.subExpression = node.ToString();
				}
			}
			else if (entryString.split(logicalOperatorsRegex).length >= 3) {//parsing logical operators
				var boolExprs = entryString.split(logicalOperatorsRegex);
				var parentNode;
				node.Operand = boolExprs[1].trim();
				node.text = boolExprs[1].trim();
				node.Type = 'operator';

				if (!bracketTokens[boolExprs[0]]) {
					parentNode = parseExpression(boolExprs[0].trim());
				}
				else {
					parentNode = bracketTokens[boolExprs[0]];
				}
				node.children.push(parentNode);
				var temp = parseExpression(boolExprs.slice(2, boolExprs.length).join(''));
				node.children.push(temp);
			}
			else if (entryString.split(booleanOperatorsRegex).length == 3) {//parsing comparison operators
				var equationsSides = entryString.split(booleanOperatorsRegex);
				var leftNode, rightNode;

				node.Operand = equationsSides[1].trim();
				node.Value = "[BoolExpression]";
				node.text = equationsSides[1].trim();
				node.Type = 'operator';

				if (!bracketTokens[equationsSides[0]])
					leftNode = parseExpression(equationsSides[0].trim());
				else
					leftNode = bracketTokens[equationsSides[0]]

				if (!bracketTokens[equationsSides[2]])
					rightNode = parseExpression(equationsSides[2].trim());
				else
					rightNode = bracketTokens[equationsSides[2]]

				node.children.push(leftNode);
				node.children.push(rightNode);
				node.subExpression = node.ToString();

			}
			else if (entryString.split(arithmeticOperatorsRegex).length >= 3) {//parsing arithmetic operators
				var arithmeticSides = entryString.split(arithmeticOperatorsRegex);
				node.Operand = arithmeticSides[1].trim();
				node.Type = 'operator';
				node.text = arithmeticSides[1].trim();
				var arithmeticLeft = arithmeticSides[0].length == 0 ? "0" : arithmeticSides[0];

				if (!bracketTokens[arithmeticLeft])
					leftNode = parseExpression(arithmeticLeft.trim());
				else
					leftNode = bracketTokens[arithmeticLeft];

				rightNode = parseExpression(arithmeticSides.slice(2, arithmeticSides.length).join(''));
				node.children.push(leftNode);
				node.children.push(rightNode);
				node.subExpression = node.ToString();
			}
			else if (entryString.split(attributeExprRegex).length >= 3 && isNaN(entryString)) {//parsing stdout operators; check if isNaN to avoid decimal numbers
				var arithmeticSides = entryString.split(attributeExprRegex);
				node.Operand = arithmeticSides[1].trim();
				node.Type = 'stdout';
				node.text = arithmeticSides[1].trim();
				var arithmeticLeft = arithmeticSides[0].length == 0 ? "0" : arithmeticSides[0];

				if (!bracketTokens[arithmeticLeft])
					leftNode = parseExpression(arithmeticLeft.trim());
				else
					leftNode = bracketTokens[arithmeticLeft];

				rightNode = parseExpression(arithmeticSides.slice(2, arithmeticSides.length).join(''));
				node.children.push(leftNode);
				node.children.push(rightNode);
				node.subExpression = node.ToString();
			}
			else if (entryString.split(functionExprRegex).length == 3) {//parsing functions
				var functionSides = entryString.split(/(^[a-zA-Z0-9]+)/);
				node.Operand = functionSides[1].trim();
				node.text = functionSides[1].trim();
				node.Type = "function";
				var arithmeticLeft = functionSides[2];
				if (!bracketTokens[arithmeticLeft])
					leftNode = parseExpression(arithmeticLeft.trim());
				else
					leftNode = bracketTokens[arithmeticLeft];

				node.children.push(leftNode);
				node.subExpression = node.ToString();
			}
			else {//parsing values and variables
				if (bracketTokens[entryString]) {
					node = bracketTokens[entryString];
				}
				else {
					entryString = entryString.trim()
					if (!isNaN(entryString)) {
						if (entryString === '') {
							node.Value = undefined;
							node.Type = "undefined";
						}
						else {
							node.Value = Number(entryString);
							node.Type = "number";
						}
					}
					else {
						if (stringTokens[entryString]) {
							var parameterName = stringTokens[entryString];
							node.Value = parameterName;
							node.text = parameterName;
							node.Type = "string";
						}
						else {
							node.Value = entryString.trim();
							node.Type = "variable";
						}
					}
					node.text = node.Value;
					node.leaf = true;
				}
			}
			return node;
		}
		return parseExpression(entryString);
	}

	ToString() {
		var tempString = '';

		if (this.Type == 'attributes') {
			tempString += '(' + this.children.map(x => x.ToString()).join(` ${this.Operand} `) + ')'
		}
		else if (this.Type == 'lambda') {
			tempString += this.Value;
			tempString += this.Operand + this.children[0].ToString();
		}
		else if (this.Operand && this.children.length == 1) {
			tempString += this.Operand + '(' + this.children[0].ToString();
			tempString += ')';
		}
		else if (this.children.length && this.Operand !== '?:' && this.Operand !== '.') {
			tempString += '(' + this.children.map(x => x.ToString()).join(` ${this.Operand} `) +')'
		}
		else if (this.children.length && this.Operand === '.') {
			tempString += this.children[0].ToString() + this.Operand + this.children[1].ToString();
		}
		else if (this.children.length == 3 && this.Operand == '?:') {
			tempString += '(' + this.children[0].ToString();
			tempString += ' ? ' + this.children[1].ToString();
			tempString += ' : ' + this.children[2].ToString();
			tempString += ')';
		}
		else {
			if (this.Type == 'string')
				tempString += '"' + this.Value + '"';
			else if (this.Value !== undefined)
				tempString += this.Value;
		}
		return tempString;
	}

	executeExpressionTree(node, args) {
		var self = this;
		var attributes = [];
		switch (node.Type) {
			case 'function':
			case 'contextFunction':
				var scope = { value: args[node.scope], scope: this, args: args };
				switch (node.children[0].Type) {
					case 'attributes':
						for (var i = 0; i < node.children.length; i++)
							attributes.push(self.executeExpressionTree(node.children[i], args));
						return self[node.Operand].apply(scope, attributes);
						break;
					case 'lambda':
						return self[node.Operand].call(scope, node.children[0]);
						break;
					case 'string':
					case 'number':
					case 'undefined':
						return self[node.Operand].call(scope, node.children[0].Value);
						break;
					case 'variable':
						return self[node.Operand].call(scope, args[node.children[0].Value]);
						break;
				}
				break;
			case 'attributes':
				for (var i = 0; i < node.children.length; i++)
					attributes.push(self.executeExpressionTree(node.children[i], args));
				return attributes;
				break;
			case 'operator':
				return Functions[node.Operand](
					self.executeExpressionTree(node.children[0], args),
					self.executeExpressionTree(node.children[1], args)
				);
				break;
			case 'condition':
				return Functions[node.Operand](
					self.executeExpressionTree(node.children[0], args),
					self.executeExpressionTree(node.children[1], args),
					self.executeExpressionTree(node.children[2], args)
				);
				break;
			case 'stdout'://TODO need to optimize for performance, probably add dinamically change type of parent node
				if (node.children[0].Type === 'variable') {
					if (args[node.scope])
						args = args[node.scope];
					node.children[1].scope = node.children[0].Value;
					if (node.children[1].Type === 'variable')
						return args[node.children[1].scope][node.children[1].Value];
					else
						return self.executeExpressionTree(node.children[1], args);
				}
				else {
					node.children[0].scope = node.scope;
					node.children[1].scope = node.subExpression;
					args[node.subExpression] = self.executeExpressionTree(node.children[0], args);
					return self.executeExpressionTree(node.children[1], args);
				}
				break;
			case 'string':
			case 'number':
			case 'undefined':
				return node.Value;
				break;
			case 'variable':
				return args[node.Value];
				break;
		}
	}

	eval(expressionString) {
		if (!this.scope.expressions[expressionString])
			this.scope.expressions[expressionString] = this.scope.generateExpressionTree(expressionString);
		return this.scope.executeExpressionTree(this.scope.expressions[expressionString], []);
	}

	toLinq (x) {
		
		return linq.from(this.value)
	}

	where(node) {
		var scope = this.scope;
		var args = {};
		return this.value.where(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	orderBy(node) {
		var scope = this.scope;
		var args = {};
		return this.value.orderBy(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	orderByDescending(node) {
		var scope = this.scope;
		var args = {};
		return this.value.orderByDescending(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	first(node) {
		var scope = this.scope;
		var args = {};
		return this.value.first(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	firstOrDefaults(node) {
		var scope = this.scope;
		var args = {};
		return this.value.firstOrDefaults(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	last(node) {
		var scope = this.scope;
		var args = {};
		return this.value.last(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	lastOrDefaults(node) {
		var scope = this.scope;
		var args = {};
		return this.value.lastOrDefaults(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	skip(node) {
		var scope = this.scope;
		var args = {};
		return this.value.skip(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	take(node) {
		var scope = this.scope;
		var args = {};
		return this.value.take(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	takeWhile(node) {
		var scope = this.scope;
		var args = {};
		return this.value.takeWhile(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	skip(node) {
		var scope = this.scope;
		var args = {};
		return this.value.skip(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	skipWhile(node) {
		var scope = this.scope;
		var args = {};
		return this.value.skipWhile(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	count(node) {
		var scope = this.scope;
		var args = {};
		return this.value.count(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	max() {
		return this.value.max();
	}

	maxBy(node) {
		var scope = this.scope;
		var args = {};
		return this.value.maxBy(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	min() {
		return this.value.min();
	}

	minBy(node) {
		var scope = this.scope;
		var args = {};
		return this.value.minBy(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	average(node) {
		var scope = this.scope;
		var args = {};
		return this.value.average(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	sum() {
		return this.value.sum();
	}

	toArray() {
		return this.value.toArray();
	}

	toJSON() {
		if(this.value)
			return this.value.toJSON();
	}
}

module.exports = {
    Functions,
    ExpressionEngine
}