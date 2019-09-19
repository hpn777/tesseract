const { fromEvent } = require('rxjs')
const { map } = require('rxjs/operators')
const tape = require('tape')
const flat = require('flat')
const { tapeAssert, assertArraysMatch } = require('./utils')
const evH = new (require('../../lib/eventHorizon'))()

var users = evH.createTesseract('person', {
  columns: [{
    name: 'id',
    primaryKey: true,
  }, {
    name: 'firstName',
  }, {
    name: 'lastName',
  }, {
    name: 'typeId',
  }]
})

var userTypes = evH.createTesseract('personType',{
  columns: [{
    name: 'id',
    primaryKey: true,
  }, {
    name: 'typeName',
  }]
})
userTypes.add({id: 1, typeName: 'Smart'})
userTypes.add({id: 2, typeName: 'Smarter'})
userTypes.add({id: 3, typeName: 'Not so smart'})


var messages = evH.createTesseract('messageQueue',{
  columns: [{
      name: 'id',
      primaryKey: true,
      //value: (data) => { return data.id || self.guid() }
  }, {
    name: 'userId'
  }, {
      name: 'message',
  }, {
      name: 'status',
  }, {
      name: 'releaseTime',
      value: (data) => (new Date())
  }]
})

tape('LiveQuery test', t => {

    var session = evH.createSession({
      table: 'messageQueue',
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
            assertArraysMatch(data, dataResult, e => t.fail(e), () => t.pass('Data OK'))
            t.end()
        },
        e => { console.trace(e) }
    )


    messages.add({id: 1, message: 'lorem', status: 1, userId: 1})
    messages.add({id: 2, message: 'ipsum', status: 1, userId: 3})
    messages.add({id: 3, message: 'dolor', status: 1, userId: 1})
    messages.add({id: 4, message: 'orange', status: 1, userId: 1})
    messages.add({id: 10, message: 'yellow', status: 1, userId: 2})

    messages.add({id: 5, message: 'sit', status: 2, userId: 3})
    messages.add({id: 6, message: 'amen', status: 2, userId: 3})

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

  

  var session = evH.createSession({
    table: 'person',
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

  users.add({id: 1, firstName: 'John', lastName: 'Doe', typeId: 1})
  users.add({id: 2, firstName: 'Richard', lastName: 'Stallman', typeId: 2})
  users.add({id: 3, firstName: 'Linus', lastName: 'Torvalds', typeId: 3})

  session.updateColumns([
    { name: 'id', primaryKey: true },
    { name: 'firstName' }
  ])
})

tape('Relational query test', t => {
  let result = [{
      id: 2,
      user: 'Linus Torvalds',
      userTypeId: 3,
      userType: 'Not so smart'
    },
    {
      id: 3,
      user: 'John Doe',
      userTypeId: 1,
      userType: 'Smart'
    },
    {
      id: 4,
      user: 'John Doe',
      userTypeId: 1,
      userType: 'Smart'
    },
    {
      id: 10,
      user: 'Richard Stallman',
      userTypeId: 2,
      userType: 'Smarter'
    },
    {
      id: 5,
      user: 'Linus Torvalds',
      userTypeId: 3,
      userType: 'Not so smart'
    },
    {
      id: 6,
      user: 'Linus Torvalds',
      userTypeId: 3,
      userType: 'Not so smart'
  }]

  

  var session = evH.createSession({
    table: 'messageQueue',
    columns: [{
        name: 'id',
        primaryKey: true,
      }, {
          name: 'message',
      }, {
          name: 'status',
      }, {
        name: 'user',
        resolve: {
          underlyingField: 'userId',
          childrenTable: 'person',
          template: '${firstName} ${lastName}'
        }
      }, {
        name: 'userTypeId',
        resolve: {
          underlyingField: 'userId',
          childrenTable: 'person',
          displayField: 'typeId'
        }
      }, {
        name: 'userType',
        resolve: {
          underlyingField: 'userTypeId',
          childrenTable: 'personType',
          displayField: 'typeName'
        }
      }, {
          name: 'releaseTime'
    }]
  })
  let data = session.getLinq().select(x => x.object).toArray()
  assertArraysMatch(data, result, e => t.fail(e), () => t.pass('Relational query test'))
  t.end()
})