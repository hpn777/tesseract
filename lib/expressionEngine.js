/**
 * Core
 *
 * @module Core
 * @requires linq
 */
var Model = require('./dataModels/model');

const Functions = {
	/**
	 * Description
	 * @param {} a
	 * @param {} b
	 * @return BinaryExpression
	 */
	'+': function (a, b) { return a + b; },
	/**
	 * Description
	 * @param {} a
	 * @param {} b
	 * @return BinaryExpression
	 */
	'-': function (a, b) { return a - b; },
	/**
	 * Description
	 * @param {} a
	 * @param {} b
	 * @return BinaryExpression
	 */
	'/': function (a, b) { return a / b; },
	/**
	 * Description
	 * @param {} a
	 * @param {} b
	 * @return BinaryExpression
	 */
	'*': function (a, b) { return a * b; },

	/**
	 * Description
	 * @param {} a
	 * @param {} b
	 * @return LogicalExpression
	 */
	'||': function (a, b) { return a || b; },
	/**
	 * Description
	 * @param {} a
	 * @param {} b
	 * @return LogicalExpression
	 */
	'&&': function (a, b) { return a && b; },
	/**
	 * Description
	 * @param {} a
	 * @param {} b
	 * @return BinaryExpression
	 */
	'==': function (a, b) { return a == b; },
	'eq': function (a, b) { return a == b; },
	/**
	 * Description
	 * @param {} a
	 * @param {} b
	 * @return BinaryExpression
	 */
	'neq': function (a, b) { return a != b; },
	'!=': function (a, b) { return a != b; },
	/**
	 * Description
	 * @param {} a
	 * @param {} b
	 * @return BinaryExpression
	 */
	'lt': function (a, b) { return a < b; },
	'<': function (a, b) { return a < b; },
	/**
	 * Description
	 * @param {} a
	 * @param {} b
	 * @return BinaryExpression
	 */
	'gt': function (a, b) { return a > b; },
	'>': function (a, b) { return a > b; },
	/**
	 * Description
	 * @param {} a
	 * @param {} b
	 * @return BinaryExpression
	 */
	'lte': function (a, b) { return a <= b; },
	'<=': function (a, b) { return a <= b; },
	/**
	 * Description
	 * @param {} a
	 * @param {} b
	 * @return BinaryExpression
	 */
	'gte': function (a, b) { return a >= b; },
	'>=': function (a, b) { return a >= b; },
	/**
	 * Description
	 * @param {} a
	 * @param {} b
	 * @return BinaryExpression
	 */
	'~': function (a, b) { return a && b && a.toLowerCase().indexOf(b.toLowerCase()) !== -1; },
	'like': function (a, b) { return a && b && a.toLowerCase().indexOf(b.toLowerCase()) !== -1; },

	'notlike': function (a, b) { return a && b && a.toLowerCase().indexOf(b.toLowerCase()) === -1; },

	'inlike': function (a, b) { return b && b.indexOf(a) !== -1; },
	
	'?:': function (a, b, c) { return a ? b : c; }
}

/**
 * ExpressionEngine and parser
 *
 * @class ExpressionEngine
 * @constructor
 */
class ExpressionEngine extends Model {

    constructor(...args) {
        super(...args)
        this.expressions = []
    }

	/**
	 * Description
	 * @method generateExpressionTree
	 * @param {} entryString
	 * @return CallExpression
	 */
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
					stringTokens['%string' + start + '%'] = (tempSubString);
					entryString = entryString.replace(matches.slice(start, end + 1).join(''), '%string' + start + '%');
				}
			}
		}

		entryString = entryString.replace(/\s+/g, '');

		/**
		 * Description
		 * @method parseExpression
		 * @param {} entryString
		 * @return node
		 */
		var parseExpression = function (entryString) {
			var bracketsRegex = /([\(\)])/;
			var logicalOperatorsRegex = /(\|\||\&\&)/;
			var booleanOperatorsRegex = /(\=\=|\!\=|\>\=|\<\=|\<|\>|~|like|notlike)/;
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
						var tempSubString = matches.slice(start + 1, end).join('');
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
				node.Value = lambdaAttributes[0];
				var subExpressionNode = parseExpression(lambdaAttributes[2]);
				subExpressionNode.scope = lambdaAttributes[0];
				node.children.push(subExpressionNode);
			}
			else if (entryString.split(',').length > 1) {//parsing function attributes
				var functionAttrs = entryString.split(',');
				node.Operand = ",";
				node.Type = 'attributes';
				node.text = "Attributes";
				functionAttrs.forEach(function (functionAttr) {
					node.children.push(parseExpression(functionAttr));
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
							parentNodeCondition = parseExpression(conditionalExprs[i]);
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
				node.Operand = boolExprs[1];
				node.text = boolExprs[1];
				node.Type = 'operator';

				if (!bracketTokens[boolExprs[0]]) {
					parentNode = parseExpression(boolExprs[0]);
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
				var left = equationsSides[0];
				var right = equationsSides[2];
				var leftNode, rightNode;

				node.Operand = equationsSides[1];
				node.Value = "[BoolExpression]";
				node.text = equationsSides[1];
				node.Type = 'operator';

				if (!bracketTokens[equationsSides[0]])
					leftNode = parseExpression(equationsSides[0]);
				else
					leftNode = bracketTokens[equationsSides[0]]

				if (!bracketTokens[equationsSides[2]])
					rightNode = parseExpression(equationsSides[2]);
				else
					rightNode = bracketTokens[equationsSides[2]]

				node.children.push(leftNode);
				node.children.push(rightNode);
				node.subExpression = node.ToString();

			}
			else if (entryString.split(arithmeticOperatorsRegex).length >= 3) {//parsing arithmetic operators
				var arithmeticSides = entryString.split(arithmeticOperatorsRegex);
				node.Operand = arithmeticSides[1];
				node.Type = 'operator';
				node.text = arithmeticSides[1];
				var arithmeticLeft = arithmeticSides[0].length == 0 ? "0" : arithmeticSides[0];
				var parentNodeLeft;
				var parentNodeRight;

				if (!bracketTokens[arithmeticLeft])
					leftNode = parseExpression(arithmeticLeft);
				else
					leftNode = bracketTokens[arithmeticLeft];

				rightNode = parseExpression(arithmeticSides.slice(2, arithmeticSides.length).join(''));
				node.children.push(leftNode);
				node.children.push(rightNode);
				node.subExpression = node.ToString();
			}
			else if (entryString.split(attributeExprRegex).length >= 3 && isNaN(entryString)) {//parsing stdout operators; check if isNaN to avoid decimal numbers
				var arithmeticSides = entryString.split(attributeExprRegex);
				node.Operand = arithmeticSides[1];
				node.Type = 'stdout';
				node.text = arithmeticSides[1];
				var arithmeticLeft = arithmeticSides[0].length == 0 ? "0" : arithmeticSides[0];
				var parentNodeLeft;
				var parentNodeRight;

				if (!bracketTokens[arithmeticLeft])
					leftNode = parseExpression(arithmeticLeft);
				else
					leftNode = bracketTokens[arithmeticLeft];

				rightNode = parseExpression(arithmeticSides.slice(2, arithmeticSides.length).join(''));
				node.children.push(leftNode);
				node.children.push(rightNode);
				node.subExpression = node.ToString();
			}
			else if (entryString.split(functionExprRegex).length == 3) {//parsing functions
				var functionSides = entryString.split(/(^[a-zA-Z0-9]+)/);
				node.Operand = functionSides[1];
				node.text = functionSides[1];
				node.Type = "function";
				var arithmeticLeft = functionSides[2];
				var parentNodeLeft;
				if (!bracketTokens[arithmeticLeft])
					leftNode = parseExpression(arithmeticLeft);
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
							node.Value = entryString;
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

	/**
	 * Description
	 * @method ToString
	 * @return tempString
	 */
	ToString() {
		var tempString = '';

		if (this.Type == 'attributes') {
			tempString += this.children[0].ToString();
			for (var i = 1; i < this.children.length; i++)
				tempString += this.Operand + this.children[i].ToString();
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
			tempString += '(' + this.children[0].ToString();
			
			this.children.forEach((k) => {
				if (k > 0)
					tempString += ' ' + this.Operand + ' ' + this.children[k].ToString();
			})
			tempString += ')';
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

	/**
	 * Description
	 * @method executeExpressionTree
	 * @param {} node
	 * @param {} args
	 * @return 
	 */
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

	//custom functions
	/**
	 * Description
	 * @method eval
	 * @param {} expressionString
	 * @return CallExpression
	 */
	eval(expressionString) {
		if (!this.scope.expressions[expressionString])
			this.scope.expressions[expressionString] = this.scope.generateExpressionTree(expressionString);
		return this.scope.executeExpressionTree(this.scope.expressions[expressionString], []);
	}

	/**
	 * Description
	 * @method sum
	 * @return sum
	 */
	sum() {
		var args = Array.prototype.slice.call(arguments);
		var sum = 0;
		args.forEach(function (item) { sum += item });
		return sum;
	}

	/**
	 * Description
	 * @method where
	 * @param {} node
	 * @return CallExpression
	 */
	where(node) {
		var scope = this.scope;
		var args = {};
		return this.value.where(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method orderBy
	 * @param {} node
	 * @return CallExpression
	 */
	orderBy(node) {
		var scope = this.scope;
		var args = {};
		return this.value.orderBy(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method orderByDescending
	 * @param {} node
	 * @return CallExpression
	 */
	orderByDescending(node) {
		var scope = this.scope;
		var args = {};
		return this.value.orderByDescending(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method first
	 * @param {} node
	 * @return CallExpression
	 */
	first(node) {
		var scope = this.scope;
		var args = {};
		return this.value.first(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method firstOrDefaults
	 * @param {} node
	 * @return CallExpression
	 */
	firstOrDefaults(node) {
		var scope = this.scope;
		var args = {};
		return this.value.firstOrDefaults(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method last
	 * @param {} node
	 * @return CallExpression
	 */
	last(node) {
		var scope = this.scope;
		var args = {};
		return this.value.last(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method lastOrDefaults
	 * @param {} node
	 * @return CallExpression
	 */
	lastOrDefaults(node) {
		var scope = this.scope;
		var args = {};
		return this.value.lastOrDefaults(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method skip
	 * @param {} node
	 * @return CallExpression
	 */
	skip(node) {
		var scope = this.scope;
		var args = {};
		return this.value.skip(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method take
	 * @param {} node
	 * @return CallExpression
	 */
	take(node) {
		var scope = this.scope;
		var args = {};
		return this.value.take(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method takeWhile
	 * @param {} node
	 * @return CallExpression
	 */
	takeWhile(node) {
		var scope = this.scope;
		var args = {};
		return this.value.takeWhile(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method skip
	 * @param {} node
	 * @return CallExpression
	 */
	skip(node) {
		var scope = this.scope;
		var args = {};
		return this.value.skip(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method skipWhile
	 * @param {} node
	 * @return CallExpression
	 */
	skipWhile(node) {
		var scope = this.scope;
		var args = {};
		return this.value.skipWhile(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method count
	 * @param {} node
	 * @return CallExpression
	 */
	count(node) {
		var scope = this.scope;
		var args = {};
		return this.value.count(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method max
	 * @param {} node
	 * @return CallExpression
	 */
	max(node) {
		var scope = this.scope;
		var args = {};
		return this.value.max(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method maxBy
	 * @param {} node
	 * @return CallExpression
	 */
	maxBy(node) {
		var scope = this.scope;
		var args = {};
		return this.value.maxBy(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method min
	 * @param {} node
	 * @return CallExpression
	 */
	min(node) {
		var scope = this.scope;
		var args = {};
		return this.value.min(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method minBy
	 * @param {} node
	 * @return CallExpression
	 */
	minBy(node) {
		var scope = this.scope;
		var args = {};
		return this.value.minBy(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method average
	 * @param {} node
	 * @return CallExpression
	 */
	average(node) {
		var scope = this.scope;
		var args = {};
		return this.value.average(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method sum
	 * @param {} node
	 * @return CallExpression
	 */
	sum(node) {
		var scope = this.scope;
		var args = {};
		return this.value.sum(function (x) {
			args[node.Value] = x;
			return scope.executeExpressionTree.call(scope, node.children[0], args);
		});
	}

	/**
	 * Description
	 * @method toArray
	 * @return CallExpression
	 */
	toArray() {
		return this.value.toArray();
	}

	/**
	 * Description
	 * @method toJSON
	 * @return CallExpression
	 */
	toJSON() {
		if(this.value)
			return this.value.toJSON();
	}
}

module.exports = {
    Functions,
    ExpressionEngine
}