var {mergeColumns, guid} = require('../lib/utils')
var Tesseract = require('../lib/tesseract')
var EVH = new (require('../lib/eventHorizon'))({
    // commandPort: {
    //     host: 'exec', 
    //     port: 6789
    // }
})
var _ = require('lodash')
var linq = require('linq')


var messages = EVH.createTesseract('messageQueue', {
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
    }, {
        name: 'deleted',
    }, {
        name: 'update',
        value: data =>  new Date(),
        aggregator: 'max'
    }]
})

var users = EVH.createTesseract('users', {
    columns: [{
        name: 'id',
        primaryKey: true,
    }, {
        name: 'parentId',
    }, {
        name: 'expTest',
        expression: 'id/2'
    }, {
        name: 'name',
    }]
})

// let testFunnySession = EVH.createSession({
//     table: 'users',
//     columns: [{
//         name: 'id',
//         primaryKey: true,
//     }, {
//         name: 'parentId',
//     }, {
//         name: 'expTest',
//         expression: 'id/2'
//     }, {
//         name: 'name',
//     },{
//         name: 'dupa',
//         resolve:{
//             underlyingField: 'id',
//             session: {
//                 table: 'messageQueue',
//                 columns: [{
//                     name: 'user',
//                     primaryKey: true,
//                 },{
//                     name: 'message',
//                 }]
//             },
//             displayField: 'message',
//         }

//     }]
// })

// var union = EVH.createUnion('pierdzielec', {
//     subSessions:{
//         a: {
//             table: 'messageQueue',
//             columns: [{
//                 name: 'id',
//                 primaryKey: true,
//             }, {
//                 name: 'type',
//                 value: 'message'
//             }, {
//                 name: 'message',
//             }, {
//                 name: 'user',
//             }, {
//                 name: 'parentId',
//                 value: x => `${x.user}/undefined`
//             }, {
//                 name: 'userName',
//                 resolve: {
//                     childrenTable: 'users',
//                     underlyingField: 'user',
//                     displayField: 'name'
//                 }
//             }]
//         },
//         b: {
//             table: 'users',
//             columns: [{
//                 name: 'id',
//                 primaryKey: true,
//             }, {
//                 name: 'type',
//                 value: 'user'
//             }, {
//                 name: 'user',
//                 value: x=>x.id
//             }, {
//                 name: 'name',
//             }, {
//                 name: 'parentId',
//                 value: (x, y, underlyingValue) => `${underlyingValue}/undefined`
//             }, {
//                 name: 'userName',
//                 value: x => x.name
//             }]
//         }
//     },
//     columns: [{
//         name: 'userName',
//     }, {
//         name: 'message',
//     }, {
//         name: 'user',
//     }, {
//         name: 'type',
//     }, {
//         name: 'id',
//         value: x => `${x.user}/${x.message}`,
//         primaryKey: true,
//     }, {
//         name: 'parentId',
//     }]
// })

// var usersSession = EVH.createSession({
//     table: 'users',
//     columns: [{
//         name: 'id',
//         primaryKey: true,
//     }, {
//         name: 'name',
//     }, {
//         name: 'msgCount',
//         resolve: {
//             underlyingField: 'id',
//             session: {
//                 table: 'messageQueue',
//                 columns:  [{
//                     name: 'user',
//                     primaryKey: true,
//                 }, {
//                     name: 'count',
//                     value: 1,
//                     aggregator: 'sum'
//                 }, {
//                     name: 'min',
//                     value: 1,
//                     aggregator: 'min'
//                 }],
//                 // filter: [{
//                 //     type: 'custom',
//                 //     value: 'user == 2',
//                 // }],
//                 groupBy: [{ dataIndex: 'user' }]
//             },
//             valueField: 'user',
//             displayField: 'count'
//         }
//     }],
//     filter: [{
//         type: 'custom',
//         value: 'msgCount > 1',
//     }],
//     sort: [  { field: 'name', direction: 'asc' }]
// })

// EVH.createSession({
//     id:'liveQuery',
//     table: 'users',
//     subSessions: {
//         a: {
//             table: 'messageQueue',
//             columns:  [{
//                 name: 'user',
//                 primaryKey: true,
//             }, {
//                 name: 'deleted'
//             }, {
//                 name: 'count',
//                 value: 1,
//                 aggregator: 'sum'
//             }, {
//                 name: 'min',
//                 value: 1,
//                 aggregator: 'min'
//             }],
//             filter: [{
//                 field: 'deleted',
//                 comparison: 'eq',
//                 value: false,
//             }],
//             groupBy: [{ dataIndex: 'user' }]
//         }
//     },
//     columns: [{
//         name: 'id',
//         primaryKey: true,
//     }, {
//         name: 'name',
//     }, {
//         name: 'expTest',
//     }, {
//         name: 'msgCount',
//         resolve: {
//             underlyingField: 'id',
//             session: 'a',
//             displayField: 'count'
//         }
//     }, {
//         name: 'msgMin',
//         resolve: {
//             underlyingField: 'id',
//             session: 'a',
//             displayField: 'min'
//         }
//     },{
//         name: 'halfCount',
//         expression: 'msgCount/3'
//     },{
//         name: 'fullName',
//         value: '${name}-${id}'
//     }],
//     // filter: [{
//     //     field: 'msgCount',
//     //     comparison: 'eq',
//     //     value: 1,
//     // }],
//     sort: [  { field: 'name', direction: 'asc' }]
// })
// var usersSession2 = EVH.createSession({
//     id: 'liveQuery'
// })

// var usersSession = EVH.createSession({
//     table: 'users'
// })


var sessionDef = {
    table: {
        table: 'messageQueue',
        columns:  [{
            name: 'id',
            primaryKey: true
        }, {
            name: 'user',
            resolve: {
                childrenTable: 'users',
                underlyingField: 'user',
                displayField: 'name'
            }
        },{
            name: 'deleted',
            defaultValue: false
        }, {
            name: 'message',
        }, {
            name: 'status'
        }, {
            name: 'count',
            value: 1,
            aggregator: 'sum'
        }],
        //  filter: [{
        //     field: 'user',
        //     comparison: '==',
        //     value: 'lauren'
        // }],
        sort: [  { field: 'status', direction: 'desc' }],
        groupBy: [{ dataIndex: 'status' }]
    },
    // filter: [{
    //     field: 'status',
    //     comparison: '==',
    //     value: 2
    // }]
}

let pullTableNames = (liveQuery) => {
    return _.uniq([
        ...(typeof liveQuery.table == 'string' ? [liveQuery.table]: pullTableNames(liveQuery.table)), 
        ...(liveQuery.columns?liveQuery.columns:[])
            .filter(x => x.resolve && x.resolve.childrenTable)
            .map((x) => x.resolve.childrenTable),
        ...Object.values(liveQuery.subSessions || {}).map((x) => pullTableNames(x))
    ].flat())
}
console.log(pullTableNames(sessionDef))
EVH.createSession(sessionDef)
// console.log(sessionDef)
// var messageSession = EVH.createSession({
//     table: 'messageQueue',
//     filter: [{
//         field: 'deleted',
//         comparison: '!=',
//         value: true
//     }]
// })

// usersSession2.on('dataUpdate', (x)=>{console.log('usersSession2 updates', x.toJSON())})
// testFunnySession.on('dataUpdate', (x)=>{console.log('messageSession updates', x.toJSON())})


var ii = 1

users.add({id: 1, parentId: 1, name: 'rafal'})
users.add({id: 2, parentId: 1, name: 'daniel'})
users.add({id: 3, parentId: 1, name: 'lauren'})


messages.add({id: ii++, message: 'dupa', user: 3, status: 1, deleted: false})
messages.add({id: ii++, message: 'cipa', user: 1, status: 1, deleted: false})
messages.add({id: ii++, message: 'bla', user: 3, status: 2, deleted: false})
messages.add({id: ii++, message: 'bla2', user: 2, status: 2, deleted: false})
messages.add({id: ii++, message: 'bla3', user: 2, status: 2, deleted: false})

messages.update({id: 2, message: 'cipa2', status: 2})


// setTimeout(()=>{
//     messages.update({id: 5, message: 'pierdol sie dupo jedna', status: 1, deleted: true})
//     usersSession2.columns[5].value = '${id}-${name}'
//     usersSession2.updateColumns(usersSession2.columns)
// }, 1000)
// setTimeout(()=>{
//     messages.update({id: 4, deleted: true})
// }, 2000)

// console.log(messages.getById(1).userName)

// for(var i = 0;i<100;i++){
//     sessionDef.id = guid()
//     EVH.createSession(sessionDef)
// }
let nrOfUpdates = 0
const nrOfItems = 2000000
console.time('perf')
while(ii++ < nrOfItems){
    if(ii%100000 === 0) 
        console.log(ii)
        messages.update([{id: ii, message: 'jdoijs oifcj nds;of', user: Math.ceil(Math.random()*3), status: 2, deleted: false}])
}
console.timeEnd('perf')

// setInterval(()=>{ 
//     ++nrOfUpdates
//     messages.update([[Math.ceil(Math.random()*nrOfItems), `Dupa jasiu pierdzi stasiu: ${nrOfItems}`, Math.ceil(Math.random()*3), Math.ceil(Math.random()*3), false]])
// }, 10)
debugger
let sessionIterations = 1
// console.log('removing stuff')
//     messages.remove([2])
setTimeout(() => {
    // console.log(usersSession.getData().map(x=>x.object))
    // console.log('usersSession2', usersSession2.getLinq().select(x=>x.object).toArray())
    
    // console.log('testFunnySession',testFunnySession.getLinq().select(x=>x.object).toArray())
    // setInterval(()=>{
    //     sessionDef.id = guid()
    //     let tempSession = EVH.createSession(sessionDef)
    //     console.log('session iterations', sessionIterations++, tempSession.getCount(), nrOfUpdates)
    //     setTimeout(()=>{tempSession.destroy()}, 50000)
    // }, 1000)
    // console.log('users', usersSession.returnTree(1, 'parentId'))
    // console.log('Union from 2 sessions', JSON.stringify(union.returnTree('1/undefined', 'parentId'), null, 2))
    // console.log('Union from 2 sessions', union.getLinq().toArray())

}, 1000)
setTimeout(()=>{}, 1000000)