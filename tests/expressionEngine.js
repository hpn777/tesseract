 const { ExpressionEngine } = require('../lib/expressionEngine')

let ee = new ExpressionEngine()
let expression = ee.generateExpressionTree('a in (1,5,8)')

console.log(ee.executeExpressionTree(expression, {a: 2}))
