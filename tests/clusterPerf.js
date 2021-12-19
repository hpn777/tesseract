var {mergeColumns} = require('../lib/utils')
var Tesseract = require('../lib/tesseract')
var EVH = new (require('../lib/clusterRedis'))()
var EVH2 = new (require('../lib/clusterRedis'))()
var _ = require('lodash')
var linq = require('linq')

EVH.connect({clientName: 'client1'})
.then(async()=>{
    console.log('conneced to client1')
    await EVH.clear()
    EVH.createTesseract('messageQueue', {
        clusterSync: true,
        persistent: true,
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
        //         underlyingField: 'user',
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
        let beginTime = new Date()
        let cc = 0
        messages.on('dataUpdate', x=>{
            // console.log(x[0].id)
            if(x[0].id++%10000 === 0){
                console.log('dataUpdate',x[0].id, (new Date()) - beginTime)
                beginTime = new Date()
            }
                
        })

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
        console.log(EVH.createSession(sessionDef).get('id'))
         console.log('--------------', messages.dataCache.length)
        // console.time('perf')
        let dupa = async ()=>{
            while(ii <2000000){
                await messages.update([{id: ii++, message: 'jdoijs oifcj nds;of js[oid dh fiudsh fiuw hdsiufh sdiu hfidsu hfiudspa', user: 2, status: Math.ceil(Math.random()*3)}])
                
            }
        }
        dupa()
    })
    
    
    EVH.createTesseract('users', {
        clusterSync: true,
        persistent: true,
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


EVH2.connect({clientName: 'client2', syncSchema: true})
.then(()=>{
    EVH2.on('add', (x)=>{console.log('added ',x.get('id'))})
})

setInterval(()=>{
    EVH2.get('messageQueue').reset()
}, 10000)

setTimeout(()=>{
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
    //                 }],
    //                 filter: [{
    //                     type: 'custom',
    //                     value: 'user >1',
    //                 }],
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
    
    // var usersSession2 = EVH2.createSession({
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
    //                 }],
    //                 filter: [{
    //                     type: 'custom',
    //                     value: 'user == 2',
    //                 }],
    //                 groupBy: [{ dataIndex: 'user' }]
    //             },
    //             valueField: 'user',
    //             displayField: 'count'
    //         }
    //     },{
    //         name: 'halfCount',
    //         value: x => x.msgCount/2
    //     }],
    //     filter: [{
    //         type: 'custom',
    //         value: 'msgCount > 1',
    //     }],
    //     sort: [  { field: 'name', direction: 'asc' }]
    // })
    
    // var messageSession = EVH2.createSession({
    //     table: 'messageQueue',
    //     columns:  [{
    //         name: 'tessUserName',
    //     }, {
    //         name: 'status',
    //         aggregator: 'avg'
    //     },{
    //         name: 'userName',
    //         resolve: {
    //             underlyingField: 'user',
    //             childrenTable: 'users',
    //             valueField: 'id',
    //             displayField: 'name'
    //         }
    //     }],
    //     // filter: [{
    //     //     //field: 'status',
    //     //     type: 'custom',
    //     //    // comparison: 'eq',
    //     //     value: 'status == 2',
    //     // }],
    //     sort: [  { field: 'status', direction: 'desc' }],
    //     // immediateUpdate: true
    // })
    
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