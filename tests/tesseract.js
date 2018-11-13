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
            underlyingName: 'id',
            session: {
                table: 'messageQueue',
                columns:  [{
                    name: 'user',
                    primaryKey: true,
                }, {
                    name: 'count',
                    value: 1,
                    aggregator: 'sum'
                }],
                filter: [{
                    type: 'custom',
                    value: 'user == 2',
                }],
                groupBy: [{ dataIndex: 'user' }]
            },
            valueField: 'user',
            displayField: 'count'
        }
    }],
    sort: [  { property: 'name', direction: 'asc' }]
})

var messageSession = EVH.createSession({
    table: 'messageQueue',
    columns:  [{
        name: 'tessUserName',
    }, {
        name: 'status',
        aggregator: 'avg'
    },{
        name: 'userName',
        resolve: {
            underlyingName: 'user',
            childrenTable: 'users',
            valueField: 'id',
            displayField: 'name'
        }
    }],
    // filter: [{
    //     //field: 'status',
    //     type: 'custom',
    //    // comparison: 'eq',
    //     value: 'status == 2',
    // }],
    sort: [  { property: 'status', direction: 'desc' }],
    // immediateUpdate: true
})

// session.on('update', (x)=>{console.log(x.toJSON())})

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
messages.update([{id: 5, message: 'retretrt', status: 1}, {id: 2, message: 'cipa2', status: 2}])

messages.remove([2])

// console.log(messages.getById(1).userName)

while(ii++ < 2000000){
    if(ii%100000 === 0) 
        console.log(ii)
        messages.update([[ii, 'jdoijs oifcj nds;of js[oid dh fiudsh fiuw hdsiufh sdiu hfidsu hfiudspa', 2, Math.ceil(Math.random()*3)]])
}


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
console.log(usersSession.getData().map(x=>x.object))
}, 100)
setTimeout(()=>{}, 1000000)
