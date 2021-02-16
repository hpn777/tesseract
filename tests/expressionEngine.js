 const { ExpressionEngine } = require('../lib/expressionEngine')

let ee = new ExpressionEngine()
let expression = ee.generateExpressionTree('dupa.toLinq().where(x=>x == 3).toArray()')
let expression2 = ee.generateExpressionTree('nomi == 1')
let expression3 = ee.generateExpressionTree('a notin (1,5,8)')
console.log(expression, expression.ToString())
console.log(ee.executeExpressionTree(expression, {dupa: [1,2,3,4,5]}))
// console.log(ee.executeExpressionTree(expression3, {a: 5}))