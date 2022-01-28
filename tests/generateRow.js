var EVH = new(require('../lib/eventHorizon'))({
    // commandPort: {
    //     host: 'exec', 
    //     port: 6789
    // }
})

var messages = EVH.createTesseract('test', {
    columns: [{
        name: 'id',
        primaryKey: true,
    }, {
        name: 'update',
        value: data => new Date(),
    },{
        name: 'price',
        title: 'Price',
        value: (data, value, oldValue) => value || oldValue,
        type: 'price',
    }, {
        name: 'orderAdd',
        title: 'Order Add',
        type: 'number',
        value: (obj, newValue, oldValue) => newValue ? (oldValue + newValue) : oldValue,
        defaultValue: 0
    }]
})

messages.update({id: 1, orderAdd: 1, price: 10})
messages.update({id: 1, price: 10})
messages.update({id: 1, orderAdd: 1, price: 10})
messages.update({id: 1})
messages.update({id: 1})
messages.update({id: 1})

console.log(messages.getData())