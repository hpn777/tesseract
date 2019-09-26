 const { ExpressionEngine } = require('../lib/expressionEngine')

let ee = new ExpressionEngine()
let expression = ee.generateExpressionTree('a in (1,5,8)')
let expression2 = ee.generateExpressionTree('(a + b) > (a-b)')
let expression3 = ee.generateExpressionTree('a notin (1,5,8)')
console.log(JSON.stringify(expression3, null, 2))
// console.log(ee.executeExpressionTree(expression, {a: 2}))
console.log(ee.executeExpressionTree(expression3, {a: 5}))