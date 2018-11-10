var EVH1 = new (require('../lib/eventHorizon'))();
var EVH2 = new (require('../lib/eventHorizon'))();
const TessCluster = require('../lib/cluster')


var node1 = new TessCluster()
node1.connect({clientName: 'client1'})
    .then((nc) => {
        console.log('client1 online')
        var users1 = node1.createTesseract('users', usersDefinition)
        var tess1 = node1.createTesseract('messageQueue', messageQueueDefinition)
        
        users1.add([{id: 1, name: 'rafal'},{id: 2, name: 'daniel'},{id: 3, name: 'lauren'}])

        let ii = 1
        tess1.add({id: ii++, message: 'dupa', user: 3, status: 1})
        tess1.add({id: ii++, message: 'cipa', user: 1, status: 1})
        tess1.add({id: ii++, message: 'bla', user: 2, status: 1})
        tess1.add({id: ii++, message: 'bla2', user: 2, status: 2})
        tess1.add({id: ii++, message: 'bla3', user: 2, status: 2})

        tess1.update({id: 2, message: 'cipa2', status: 2})
        tess1.update([{id: 5, message: 'retretrt', status: 1}, {id: 4, message: 'cipa2', status: 2}])
    })

let node2 = new TessCluster()
node2.connect({clientName: 'client2'})
    .then((nc) => {
        console.log('client2 online')
        node2.on('add', (tess)=>{
            if(tess.get('id') === 'messageQueue'){
                let session = node2.createSession({
                    id: 'messages_querry',
                    table: 'messageQueue',
                    columns:  [{
                        name: 'id',
                        primaryKey: true
                    },{
                        name: 'message',
                    },{
                        name: 'userName',
                        resolve: {
                            underlyingName: 'user',
                            childrenTable: 'users',
                            valueField: 'id',
                            displayField: 'name'
                        }
                    }],
                    filter: [{
                        type: 'custom',
                        value: 'status == 2',
                    }],
                    sort: [{ property: 'id', direction: 'DESC' }]
                })
                
                session.on('dataUpdated',(data)=>{
                    console.log('dataUpdated', data.toJSON())
                })
            }
        })
    })

let messageQueueDefinition = {
    clusterSync: true,
    isDurableStream: true,
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
        value: (data) => { return new Date() },
        aggregator: 'max'
    }, {
        name: 'tessUserName',
        resolve: {
            underlyingName: 'user',
            childrenTable: 'users',
            valueField: 'id',
            displayField: 'name'
        }
    }]
}

var usersDefinition = {
    clusterSync: true,
    isDurableStream: true,
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
    console.log('summary',node2.getSession('messages_querry').getData().map(x=>x.object))
    
}, 2000)
