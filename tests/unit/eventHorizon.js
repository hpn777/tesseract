const { fromEvent } = require('rxjs')
const { map } = require('rxjs/operators')
const tape = require('tape')
const flat = require('flat')
const { tapeAssert, assertArraysMatch } = require('./utils')

const Tesseract = require('../../lib/tesseract')
const EventHorizon = require('../../lib/eventHorizon')

tape('EventHorizon / Resolver test', t => {

    let messagesDef = {
        id: 'messages',
        columns: [{
            name: 'id',
            columnType: 'number',
            primaryKey: true,
        }, {
            name: 'message',
            columnType: 'object',
        }, {
            name: 'status',
            columnType: 'number',
        }, {
            name: 'user'
        }]
    }

    let usersDef = {
        id: 'users',
        columns: [{
            name: 'id',
            columnType: 'number',
            primaryKey: true,
        }, {
            name: 'name',
            columnType: 'text',
        }]
    }

    let eventHorizon = new EventHorizon()
    let messages = eventHorizon.createTesseract('messages', messagesDef)
    let users = eventHorizon.createTesseract('users', usersDef)

    let session = eventHorizon.createSession({
        table: 'messages',
        filter: [{
            type: 'number',
            comparison: 'eq',
            field: 'status',
            value: 1
        }],
        sort: [{
            property: 'id',
            direction: 'DESC'
        }, {
            property: 'name',
            direction: 'ASC'
        }],
        groupBy: []
    })



    let updated$ = fromEvent(session, 'update')
      .pipe(map(([d]) => d))

    let result = [{
        'updatedIds': [1],
        'removedIds': []
    }, {
        'updatedIds': [2],
        'removedIds': []
    }, {
        'updatedIds': [3],
        'removedIds': []
    }, {
        'updatedIds': [4],
        'removedIds': []
    }, {
        'updatedIds': [],
        'removedIds': [1]
    }, {
        'updatedIds': [2, 3],
        'removedIds': [4]
    }]

    tapeAssert(t, updated$, result.map(flat))
        .subscribe(r => { t.end() }, e => { console.trace(e) })

    users.add({id: 1, name: 'rafal'})
    users.add({id: 2, name: 'daniel'})
    users.add({id: 3, name: 'lauren'})
    
    messages.add({id: 1, user: 1, message: 'lorem', status: 1})
    messages.add({id: 2, user: 2, message: 'ipsum', status: 1})
    messages.add({id: 3, user: 3, message: 'dolor', status: 1})
    messages.add({id: 4, user: 1, message: 'orange', status: 1})

    messages.add({id: 5, user: 2, message: 'sit', status: 2})
    messages.add({id: 6, user: 3, message: 'amet', status: 2})

    messages.remove([1])

    messages.update([
        {id: 2, message: 'ipsum2', user: 2, status: 1},
        {id: 3, message: 'dolor2', user: 3, status: 1},
        {id: 4, message: 'orange', user: 1, status: 2}
    ])

    let dataResult = [ 
        { id: 2, name: 'daniel', msgCount: 2 },
        { id: 3, name: 'lauren' },
        { id: 1, name: 'rafal' } 
    ]

    var usersSession = eventHorizon.createSession({
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
                    table: 'messages',
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

    let data = usersSession.getData().map(x=>x.object)

    assertArraysMatch(data, dataResult, e => t.fail(e), () => t.pass('Relational live query'))
})

