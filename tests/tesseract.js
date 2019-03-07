var {mergeColumns} = require('../lib/utils')
var Tesseract = require('../lib/tesseract')
var EVH = new (require('../lib/eventHorizon'))()

var messages = EVH.createTesseract('messageQueue', {
    //clusterSync: true,
    columns: [{
        name: 'id',
        primaryKey: true,
        //value: (data) => { return data.id || self.guid() }
    }, {
        name: 'message',
    }, {
        name: 'status',
        aggregator: 'avg'
    }, {
        name: 'user',
    }, {
        name: 'deleted'
    }, {
        name: 'releaseTime',
        value: (data) => { return new Date() },
        aggregator: 'max'
    // }, {
    //     name: 'tessUserName',
    //     resolve: {
    //         underlyingField: 'user',
    //         childrenTable: 'users',
    //         valueField: 'id',
    //         displayField: 'name'
    //     }
    }]
})


var users = EVH.createTesseract('users', {
    //clusterSync: true,
    columns: [{
        name: 'id',
        primaryKey: true,
    }, {
        name: 'name',
    }]
})

var usersSession = EVH.createSession({
    table: 'users',
    columns: [{
        name: 'id',
        primaryKey: true,
    }, {
        name: 'name',
    }, {
        name: 'msgCount',
        resolve: {
            underlyingField: 'id',
            session: {
                table: 'messageQueue',
                columns:  [{
                    name: 'user',
                    primaryKey: true,
                }, {
                    name: 'count',
                    value: 1,
                    aggregator: 'sum'
                }, {
                    name: 'min',
                    value: 1,
                    aggregator: 'min'
                }],
                // filter: [{
                //     type: 'custom',
                //     value: 'user == 2',
                // }],
                groupBy: [{ dataIndex: 'user' }]
            },
            valueField: 'user',
            displayField: 'count'
        }
    }],
    filter: [{
        type: 'custom',
        value: 'msgCount > 1',
    }],
    sort: [  { field: 'name', direction: 'asc' }]
})

var usersSession2 = EVH.createSession({
    table: 'users',
    subSessions: {
        a: {
            table: 'messageQueue',
            columns:  [{
                name: 'user',
                primaryKey: true,
            }, {
                name: 'count',
                value: 1,
                aggregator: 'sum'
            }, {
                name: 'min',
                value: 1,
                aggregator: 'min'
            }],
            // filter: [{
            //     type: 'custom',
            //     value: 'user == 2',
            // }],
            groupBy: [{ dataIndex: 'user' }]
        }
    },
    columns: [{
        name: 'id',
        primaryKey: true,
    }, {
        name: 'name',
    }, {
        name: 'msgCount',
        resolve: {
            underlyingField: 'id',
            session: 'a',
            valueField: 'user',
            displayField: 'count'
        }
    }, {
        name: 'msgmin',
        resolve: {
            underlyingField: 'id',
            session: 'a',
            valueField: 'user',
            displayField: 'min'
        }
    },{
        name: 'halfCount',
        value: x => x.msgCount/2
    },{
        name: 'fullName',
        value: x => `${x.name}-${x.id}`
    }],
    filter: [{
        type: 'custom',
        value: 'msgCount > 1',
    }],
    sort: [  { field: 'name', direction: 'asc' }]
})

var messageSession = EVH.createSession({
    table: 'messageQueue',
    columns:  [{
        name: 'id',
    },{
        name: 'deleted'
    }, {
        name: 'message',
    }],
    // filter: [{
    //     field: 'deleted',
    //     type: 'boolean',
    //    // comparison: 'eq',
    //     value: true
    // }],
    // sort: [  { field: 'status', direction: 'desc' }],
    // immediateUpdate: true
})

let cipa = {}
usersSession2.on('dataUpdate', (x)=>{  })
usersSession2.on('dataUpdate', (x)=>{  })
usersSession2.on('dataUpdate', (x)=>{  })
usersSession2.on('dataUpdate', (x)=>{  }, cipa)
usersSession2.off(null, null, cipa)

var ii = 1

users.add({id: 1, name: 'rafal'})
users.add({id: 2, name: 'daniel'})
users.add({id: 3, name: 'lauren'})


messages.add({id: ii++, message: 'dupa', user: 3, status: 1})
messages.add({id: ii++, message: 'cipa', user: 1, status: 1})
messages.add({id: ii++, message: 'bla', user: 3, status: 2})
messages.add({id: ii++, message: 'bla2', user: 2, status: 2})
messages.add({id: ii++, message: 'bla3', user: 2, status: 2})

messages.update({id: 2, message: 'cipa2', status: 2})
messages.update({id: 5, message: 'pierdol sie dupo jedna', status: 1, deleted: true})

console.log('before remove', messageSession.getCount())
messages.remove([2])
console.log('after remove', messageSession.getCount())

// console.log(messages.getById(1).userName)
// console.time('perf')
// while(ii++ < 2000000){
//     if(ii%100000 === 0) 
//         console.log(ii)
//         messages.update([[ii, 'jdoijs oifcj nds;of js[oid dh fiudsh fiuw hdsiufh sdiu hfidsu hfiudspa', 2, Math.ceil(Math.random()*3)]])
// }
// console.timeEnd('perf')


// setTimeout(()=>{
    // console.log(
    //     messageSession.getData().map(x => x.object)
    //        // .map(x => x.toObject())
    // )
    // console.log('end',
    //     JSON.stringify(messageSession.getData()//groupData()
    //       .map(x => x.object), '',4)
    //     // ,messageSession.getData()
    // )
// }, 100)
// console.log(messageSession.groupData([{ dataIndex: 'userName' }]))

setTimeout(() => {
    // console.log(usersSession.getData().map(x=>x.object))
    console.log(usersSession2.getData().map(x=>x.object))
    console.log('messageSession',messageSession.getData().map(x=>x.object))
    console.log(EVH.sessions.map(x=>x.get('id')))
    usersSession2.destroy()
    console.log(EVH.sessions.map(x=>x.get('id')))
}, 100)
setTimeout(()=>{}, 1000000)
