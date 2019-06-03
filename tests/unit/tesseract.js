const { fromEvent } = require('rxjs')
const { map } = require('rxjs/operators')
const tape = require('tape')
const flat = require('flat')
const { tapeAssert, assertArraysMatch } = require('./utils')

const Tesseract = require('../../lib/tesseract')

tape('LiveQuery test', t => {

    var messages = new Tesseract({
        id: 'messageQueue',
        columns: [{
            name: 'id',
            primaryKey: true,
            //value: (data) => { return data.id || self.guid() }
        }, {
            name: 'message',
        }, {
            name: 'status',
        }, {
            name: 'releaseTime',
            value: (data) => (new Date())
        }]
    })

    var session = messages.createSession({
        filter: [{
            field: 'status',
            type: 'number',
            comparison: 'eq',
            value: 1
        }],
        sort: [{ field: 'id', direction: 'DESC' }],
        start: 0,
        limit: 2
    })

    let updated$ = fromEvent(session, 'dataUpdate')
      .pipe(map(([d]) => d))

    let result = [{
        'addedIds': [1],
        'removedIds': [],
        'updateReason': 'dataUpdate'
    }, {
        'addedIds': [2],
        'removedIds': [],
        'updateReason': 'dataUpdate'
    }, {
        'addedIds': [3],
        'removedIds': [],
        'updateReason': 'dataUpdate'
    }, {
        'addedIds': [4],
        'removedIds': [],
        'updateReason': 'dataUpdate'
    }, {
        'addedIds': [10],
        'removedIds': []
    }, {
        'updatedIds': [],
        'removedIds': [1]
    }, {
        'updatedIds': [2, 3],
        'removedIds': [4]
    }]
    
    const dataResult = [{
        message: 'yellow',
    }, {
        message: 'orangeUpdate'
    }]

    tapeAssert(t, updated$, result.map(flat))
        .subscribe(r => {

            // since we disabled immediateUpdate there will be no data
            let data = session.getLinq().select(x => x.object).toArray()
            console.log(data)
            assertArraysMatch(data, dataResult, e => t.fail(e), () => t.pass('Data OK'))
            t.end()
        },
        e => { console.trace(e) }
    )


    messages.add({id: 1, message: 'lorem', status: 1})
    messages.add({id: 2, message: 'ipsum', status: 1})
    messages.add({id: 3, message: 'dolor', status: 1})
    messages.add({id: 4, message: 'orange', status: 1})
    messages.add({id: 10, message: 'yellow', status: 1})

    messages.add({id: 5, message: 'sit', status: 2})
    messages.add({id: 6, message: 'amen', status: 2})

    messages.remove([1])

    messages.update([
        {id: 2, message: 'ipsum2', status: 1},
        {id: 3, message: 'orangeUpdate', status: 1},
        {id: 4, message: 'orange', status: 2}
    ])
})

tape('Live query columns update test', t => {
  let result = [{
    'addedIds': [2],
    'removedIds': [],
    'updateReason': 'dataUpdate'
  }, {
    'addedIds': [3],
    'removedIds': [],
    'updateReason': 'dataUpdate'
  }, {
    'updatedIds': [2, 3],
    'updateReason': 'columnsChanged',
  }]

  var messages = new Tesseract({
    id: 'person',
    columns: [{
      name: 'id',
      primaryKey: true,
    }, {
      name: 'firstName',
    }, {
      name: 'lastName',
    }]
  })

  var session = messages.createSession({
    filter: [{
      field: 'id',
      comparison: 'gt',
      value: 1
    }],
    sort: [{ field: 'id', direction: 'ASC' }],
  })

  let updated$ = fromEvent(session, 'dataUpdate')
    .pipe(map(([d]) => d))


  tapeAssert(t, updated$, result.map(flat))
    .subscribe(
      () => t.end(),
      e => { console.trace(e) }
    )

  messages.add({id: 1, firstName: 'John', lastName: 'Doe'})
  messages.add({id: 2, firstName: 'Richard', lastName: 'Stallman'})
  messages.add({id: 3, firstName: 'Linus', lastName: 'Torvalds'})

  session.updateColumns([
    { name: 'id', primaryKey: true },
    { name: 'firstName' }
  ])
})