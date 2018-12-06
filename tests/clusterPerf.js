var {mergeColumns} = require('../lib/utils')
var Tesseract = require('../lib/tesseract')
var EVH = new (require('../lib/cluster'))()

EVH.connect({clientName: 'client1'})
.then(()=>{
    EVH.createTesseract('messageQueue', {
        clusterSync: true,
        // persistent: true,
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
        // }, {
        //     name: 'tessUserName',
        //     resolve: {
        //         underlyingName: 'user',
        //         childrenTable: 'users',
        //         valueField: 'id',
        //         displayField: 'name'
        //     }
        }]
    })
    .then((messages)=>{
        var ii = 1
        messages.add({id: ii++, message: 'dupa', user: 3, status: 1})
        messages.add({id: ii++, message: 'cipa', user: 1, status: 1})
        messages.add({id: ii++, message: 'bla', user: 3, status: 2})
        messages.add({id: ii++, message: 'bla2', user: 2, status: 2})
        messages.add({id: ii++, message: 'bla3', user: 2, status: 2})
        
        messages.update({id: 2, message: 'cipa2', status: 2})
        messages.update([{id: 5, message: 'retretrt', status: 1}, {id: 2, message: 'cipa2', status: 2}])
        messages.update([{id: 5, message: 'retretrt', status: 1}, {id: 2, message: 'cipa2', status: 2}])
        messages.update([{id: 5, message: 'retretrt', status: 1}, {id: 2, message: 'cipa2', status: 2}])
        messages.update([{id: 5, message: 'retretrt', status: 1}, {id: 2, message: 'cipa2', status: 2}])
        messages.update([{id: 5, message: 'retretrt', status: 1}, {id: 2, message: 'cipa2', status: 2}])
        
        messages.remove([2])
        
        // console.log(messages.getById(1).userName)
        console.time('perf')
        let dupa = ()=>{
            if(ii%1000 === 0)
                console.log(ii)
            messages.update([[ii, 'jdoijs oifcj nds;of js[oid dh fiudsh fiuw hdsiufh sdiu hfidsu hfiudspa', 2, Math.ceil(Math.random()*3)]])
            if(ii++ <2000000){
                //if(ii%10 === 0)
                    setImmediate(()=>{dupa()})
                // else
                //    dupa()
            }
            else
            console.timeEnd('perf')
        }
        dupa()
    })
    
    
    EVH.createTesseract('users', {
        clusterSync: true,
        // persistent: true,
        columns: [{
            name: 'id',
            primaryKey: true,
        }, {
            name: 'name',
        }]
    })
    .then((users)=>{
        users.add({id: 1, name: 'rafal'})
        users.add({id: 2, name: 'daniel'})
        users.add({id: 3, name: 'lauren'})
    })
    

})

var EVH2 = new (require('../lib/cluster'))()
EVH2.connect({clientName: 'client2', syncSchema: true})
.then(()=>{
    EVH2.on('add', (x)=>{console.log(x.get('id'))})
})

setTimeout(()=>{
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
                        value: 'user >1',
                    }],
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
        },{
            name: 'halfCount',
            value: x => x.msgCount/2
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
        sort: [  { field: 'status', direction: 'desc' }],
        // immediateUpdate: true
    })
    
    // usersSession.on('dataUpdate', (x)=>{console.log(x.toJSON())})
    
    
    
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
    
    // setTimeout(() => {
    //     console.log(usersSession.getData().map(x=>x.object))
    //     console.log(usersSession2.getData().map(x=>x.object))
    // }, 1000)
    setTimeout(()=>{}, 1000000)
}, 2000)