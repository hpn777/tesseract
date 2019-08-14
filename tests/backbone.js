var {Model, Collection} = require('../lib/dataModels/backbone')
var collection1 = new Collection()
var collection2 = new Collection()
var item = new Model({id: 1, text: 'dupa'})

collection1.add(item)
collection2.add(item)

item.destroy()

console.log('collection1', collection1)
console.log('collection2', collection2)
