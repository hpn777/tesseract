 const { ExpressionEngine } = require('../lib/expressionEngine')

let ee = new ExpressionEngine()
let expression = ee.generateExpressionTree('(1,2,3,4,5,6,7,8,9).toLinq().where(x=>x >= 2).select(y => y *2).toArray()')
let expression2 = ee.generateExpressionTree('3>2?10:20')
let expression3 = ee.generateExpressionTree('a notin (1,5,8)')
console.log(expression2, expression2.toString())
// console.log(expression.toString(), JSON.stringify(expression, null, 2), ee.executeExpressionTree(expression, {dupa: [1,2,3,4,5]}))
// console.log(ee.executeExpressionTree(expression3, {a: 5}))