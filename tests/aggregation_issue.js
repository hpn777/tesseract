var eventHorizon = new(require('../lib/eventHorizon'))({
  commandPort: {
      host: 'exec', 
      port: 6789
  }
})
const wait = (time = 1000) => new Promise(res => {
  setTimeout(() => {
    res()
  }, time)
})
const people = eventHorizon.createTesseract('person', {
  id: 'person',
  columns: [{
    name: 'id',
    primaryKey: true,
  }, {
    name: 'name',
  }]
})
const messages = eventHorizon.createTesseract('message', {
  id: 'message',
  columns: [{
    name: 'id',
    primaryKey: true
  }, {
    name: 'personId',
  }, {
    name: 'status'
  }]
})
const session = eventHorizon.createSession({
  table: 'person',
  subSessions: {
    messageAggregator: {
      table: 'message',
      columns: [{
          name: 'id',
          primaryKey: true
        },
        {
          name: 'personId'
        },
        {
          name: 'status'
        },
        {
          name: 'count',
          value: 1,
          aggregator: 'sum'
        },
      ],
      groupBy: [{
        dataIndex: 'personId'
      }],
      filter: [{
        field: 'status',
        comparison: 'in',
        value: ['sent', 'delivered']
      }]
    }
  },
  // filter: [{
  //   field: 'numberOfMessages',
  //   comparison: 'gt',
  //   value: 0
  // }],
  columns: [{
      name: 'id',
      primaryKey: true
    }, {
      name: 'name',
    },
    {
      name: 'numberOfMessages',
      resolve: {
        underlyingField: 'id',
        session: 'messageAggregator',
        childrenTable: 'message',
        displayField: 'count'
      }
    }
  ]
})
session.on('dataUpdate', x => {
  console.log('session dataUpdate', session.get('id'), x.toJSON())
})
// Make person #3 visible messages count 0
const main = async () => {
  await wait(500)
  people.add([{
    id: 2,
    name: 'Person #3'
  }, {
    id: 3,
    name: 'Person #4'
  }, ])
  await wait(500)
  messages.add([{
    id: 8,
    personId: 3,
    status: 'sent'
  }, {
    id: 9,
    personId: 3,
    status: 'sent'
  }, {
    id: 10,
    personId: 3,
    status: 'sent'
  }, {
    id: 11,
    personId: 3,
    status: 'sent'
  }, ])
  await wait(100)
  console.log('remove data')
  console.log('sending an update data')
  messages.update([{
    id: 8,
    status: 'removed'
  }])

  await wait(10)
  console.log('sending an update data')
  messages.update([{
    id: 9,
    status: 'removed'
  }])

  await wait(10)
  console.log('sending an update data')
  messages.update([{
    id: 10,
    status: 'removed'
  }])

  await wait(10)
  console.log('sending an update data')
  messages.update([{
    id: 11,
    status: 'removed'
  }])
}
main()