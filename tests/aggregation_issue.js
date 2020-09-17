var eventHorizon = new(require('../lib/eventHorizon'))({
  // commandPort: {
  //     host: 'exec', 
  //     port: 6789
  // }
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

/****************
 * EXPECTATIONS *
 ****************/
const expectedResult = [
  // After adding persons
  {
    addedIds: [1, 2, 3],
    addedData: [{
        id: 1,
        numberOfMessages: undefined
      },
      {
        id: 2,
        numberOfMessages: undefined
      },
      {
        id: 3,
        numberOfMessages: undefined
      }
    ],
    updatedIds: [],
    updatedData: [],
    removedIds: [],
    removedData: []
  },

  // After adding messages
  {
    addedIds: [],
    addedData: [],
    updatedIds: [1, 2, 3],
    updatedData: [{
        id: 1,
        numberOfMessages: 3
      },
      {
        id: 2,
        numberOfMessages: 2
      },
      {
        id: 3,
        numberOfMessages: 1
      }
    ],
    removedIds: [],
    removedData: []
  },

  // After changing one of the messages status
  {
    addedIds: [],
    addedData: [],
    updatedIds: [3],
    updatedData: [{
      id: 3,
      numberOfMessages: undefined
    }],
    removedIds: [],
    removedData: []
  }
]

session.on('dataUpdate', x => {
  console.log('session dataUpdate', session.get('id'), x.toJSON())
})

/************
 * SCENARIO *
 ************/
people.add([{
    id: 1,
    name: 'Person #1'
  },
  {
    id: 2,
    name: 'Person #2'
  },
  {
    id: 3,
    name: 'Person #3'
  },
])

messages.add([
  // Person #1 visible messages count 3
  {
    id: 1,
    personId: 1,
    status: 'delivered'
  },
  {
    id: 2,
    personId: 1,
    status: 'delivered'
  },
  {
    id: 3,
    personId: 1,
    status: 'sent'
  },
  {
    id: 4,
    personId: 1,
    status: 'deleted'
  },

  // Person #2 visible messages count 2
  {
    id: 5,
    personId: 2,
    status: 'delivered'
  },
  {
    id: 6,
    personId: 2,
    status: 'deleted'
  },
  {
    id: 7,
    personId: 2,
    status: 'sent'
  },

  // Person #1 visible messages count 1
  {
    id: 8,
    personId: 3,
    status: 'sent'
  },
])

// Make person #3 visible messages count 0
setTimeout(() => {
  messages.update([{
    id: 8,
    status: 'deleted'
  }, ])
  setTimeout(() => {
    messages.update([{
      id: 8,
      status: 'sent'
    }, ])
  }, 200)
}, 200)