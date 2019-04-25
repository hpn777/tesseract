var EVH1 = new (require('../lib/eventHorizon'))();
var EVH2 = new (require('../lib/eventHorizon'))();
const TessCluster = require('../lib/clusterRedis')


var node1 = new TessCluster({nodeId: 'node1'})
let node2 = new TessCluster({nodeId: 'node2'})
let messageQueueDefinition = {
    clusterSync: true,
    persistent: true,
    columns: [{
        name: 'id',
        primaryKey: true,
    }, {
        name: 'message',
    }, {
        name: 'status',
        aggregator: 'avg'
    }, {
        name: 'user',
        columnType: 'number'
    }, {
        name: 'releaseTime',
        value: () => new Date(),
        aggregator: 'max'
    }]
}
var usersDefinition = {
    clusterSync: true,
    persistent: true,
    columns: [{
        name: 'id',
        columnType: 'number',
        primaryKey: true,
    }, {
        name: 'name',
        columnType: 'text',
    }]
}

node1.connect({clientName: 'client1', syncSchema: false})
    .then((nc) => {
        console.log('node1 online')
        node1.createTesseract('users', usersDefinition)

        node1.createTesseract('messages', messageQueueDefinition)
    })

node2.connect({clientName: 'client2', syncSchema: false})
    .then((nc) => {
        console.log('node2 online')
    })


Promise.all([
    node2.pullTesseract('messages'),
    node2.pullTesseract('users')   
]).then(()=>{
// setTimeout(()=>{
    let users = node2.get('users')
    let messages = node2.get('messages')

    console.log('users before',users.getData().map(x=>x.object))
    console.log('messages before',messages.getData().map(x=>x.object))
    
    users.add([{id: 1, name: 'rafal'},{id: 2, name: 'daniel'},{id: 3, name: 'lauren'}])
    users.update([{id: 1, name: 'rafal'},{id: 2, name: 'daniel'},{id: 3, name: 'lauren'}])

    let ii = 1
    messages.add({id: ii++, message: 'dupa', user: 3, status: 1})
    messages.add({id: ii++, message: 'cipa', user: 1, status: 1})
    messages.add({id: ii++, message: 'bla', user: 2, status: 1})
    messages.add({id: ii++, message: 'bla2', user: 2, status: 2})
    messages.add({id: ii++, message: 'bla3', user: 2, status: 2})

    messages.update({id: 2, message: 'cipa2', status: 2})
    messages.update([{id: 5, message: 'retretrt', status: 1}, {id: 4, message: 'cipa3', status: 2}])
    messages.remove([1, 2])

    let session = node2.createSession({
        id: 'messages_querry',
        table: 'messages',
        columns:  [{
            name: 'id',
            primaryKey: true
        },{
            name: 'message',
        },{
            name: 'status',
        },{
            name: 'userName',
            resolve: {
                underlyingField: 'user',
                childrenTable: 'users',
                valueField: 'id',
                displayField: 'name'
            }
        }],
        filter: [{
            type: 'custom',
            value: 'status == 2',
        }],
        sort: [{ field: 'id', direction: 'desc' }]
    })

    setTimeout(()=>{
        console.log('users after',node2.get('users').getCount(), users.getData().map(x=>x.object))
        console.log('messages after',node2.get('messages').getCount(),messages.getData().map(x=>x.object))
        console.log('users after',node1.get('users').getCount(), users.getData().map(x=>x.object))
        console.log('messages after',node1.get('messages').getCount(),messages.getData().map(x=>x.object))
        users.clear()
        messages.clear()
        // node1.get('messages').clear()
        setTimeout(()=>{
            console.log('users very after',node2.get('users').getCount(), users.getData().map(x=>x.object))
            console.log('messages very after',node2.get('messages').getCount(),messages.getData().map(x=>x.object))
            console.log('users very after',node1.get('users').getCount(), users.getData().map(x=>x.object))
            console.log('messages very after',node1.get('messages').getCount(),messages.getData().map(x=>x.object))
        }, 300)
    }, 10)
}, 300)

    



setTimeout(()=>{
    //node2.get('messages').reset()
}, 1000)

