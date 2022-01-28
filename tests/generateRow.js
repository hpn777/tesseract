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
    }, {
        name: 'orderAdd',
        title: 'Order Add',
        type: 'number',
        value: (obj, value, attributName, newValue) => newValue ? (value + newValue) : value,
        defaultValue: 0
    }]
})

messages.update({id: 1, orderAdd: 1})
messages.update({id: 1, orderAdd: 1})
messages.update({id: 1, orderAdd: 1})
messages.update({id: 1, orderAdd: 1})

console.log(messages.getData())