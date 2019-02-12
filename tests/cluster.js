var EVH1 = new (require('../lib/eventHorizon'))();
var EVH2 = new (require('../lib/eventHorizon'))();
const TessCluster = require('../lib/cluster')


var node1 = new TessCluster()
let node2 = new TessCluster()

node1.connect({clientName: 'client1', syncSchema: true})
    .then((nc) => {
        console.log('node1 online')
        node1.createTesseract('users', usersDefinition)
            .then((users) => {
                users.add([{id: 1, name: 'rafal'},{id: 2, name: 'daniel'},{id: 3, name: 'lauren'}])
            })

        node1.createTesseract('messages', messageQueueDefinition)
            .then((messages) => {
                let ii = 1
                messages.add({id: ii++, message: 'dupa', user: 3, status: 1})
                messages.add({id: ii++, message: 'cipa', user: 1, status: 1})
                messages.add({id: ii++, message: 'bla', user: 2, status: 1})
                messages.add({id: ii++, message: 'bla2', user: 2, status: 2})
                messages.add({id: ii++, message: 'bla3', user: 2, status: 2})

                messages.update({id: 2, message: 'cipa2', status: 2})
                messages.update([{id: 5, message: 'retretrt', status: 1}, {id: 4, message: 'cipa3', status: 2}])
                messages.remove([1, 2])
            })
    })

node2.connect({clientName: 'client2', syncSchema: true})
    .then((nc) => {
        console.log('node2 online')
    })

node2.getTesseract('messages')
    .then((tess)=>{
        console.log(tess.get('id'))
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
            console.log('summary',session.getData().map(x=>x.object))
           // node1.get('messages').clear()
            setTimeout(()=>{
                console.log('summary',session.getData().map(x=>x.object))
                
            }, 300)
        }, 300)
    })
    
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
        //value: (data) => { return data.id || self.guid() }
    }, {
        name: 'name',
        columnType: 'text',
    }]
}


setTimeout(()=>{
    //node2.get('messages').reset()
}, 1000)

