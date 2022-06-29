const TessCluster = require("../lib/clusterRedis");

const config = {
  // data schema
  clusterSync: true, // always true, otherwise it hangs out
  persistent: true,

  // for node1 cluster connect
  syncSchemaSource: false,
  // for node2 cluster connect
  syncSchemaConsumer: false,

  // how to set initial data, adding records manually or doing reset
  resetDataAtStart: true,
  // If we use reset, should we disable cluster update?
  disableClusterUpdateOnReset: false
};

//Helper functions
const wait = (time = 1000) => new Promise(res => {
  setTimeout(() => {
    res()
  }, time)
})
//---------------

//Data structs
const messageQueueDefinition = {
  clusterSync: config.clusterSync,
  persistent: config.persistent,
  columns: [{
      name: "id",
      primaryKey: true
    },
    {
      name: "message"
    },
    {
      name: "status",
      aggregator: "avg"
    },
    {
      name: "user",
      columnType: "number"
    },
    {
      name: "releaseTime",
      value: () => new Date(),
      aggregator: "max"
    }
  ]
};

const usersDefinition = {
  clusterSync: config.clusterSync,
  persistent: config.persistent,
  columns: [{
      name: "id",
      columnType: "number",
      primaryKey: true
    },
    {
      name: "name",
      columnType: "text"
    }
  ]
};
//---------------

// Live querry definition
const liveQuery = {
  id: 'liveQuery',
  table: 'users',
  subSessions: {
    a: {
      table: 'messages',
      columns: [{
        name: 'id',
        primaryKey: true,
      }, {
        name: 'user'
      }, {
        name: 'count',
        value: 1,
        aggregator: 'sum'
      }, {
        name: 'min',
        value: 1,
        aggregator: 'min'
      }],
      groupBy: [{
        dataIndex: 'user'
      }]
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
      displayField: 'count'
    }
  }, {
    name: 'msgMin',
    resolve: {
      underlyingField: 'id',
      session: 'a',
      displayField: 'min'
    }
  }, {
    name: 'halfCount',
    value: x => x.msgCount / 2
  }, {
    name: 'fullName',
    value: '${name}-${id}'
  }],
  filter: [{
    field: 'msgMin',
    comparison: 'eq',
    value: 1,
  }],
  sort: [{
    field: 'name',
    direction: 'asc'
  }]
}
//------------

const main = async () => {
  const node1 = new TessCluster({
    // nodeId: 'node1'
  });
  const node2 = new TessCluster({
    // nodeId: 'node2'
  });
  const node3 = new TessCluster({
    // nodeId: 'node3'
  });

  await node1.connect({
    syncSchema: config.syncSchemaSource
  });
  console.log("node1 online");

  const users = await node1.createTesseract("users", usersDefinition);

  if (config.resetDataAtStart) {
    users.reset(
      [{
          id: 1,
          name: "rafal"
        },
        {
          id: 2,
          name: "daniel"
        },
        {
          id: 3,
          name: "lauren"
        }
      ],
      config.disableClusterUpdateOnReset
    );
  } else {
    users.add([{
        id: 1,
        name: "rafal"
      },
      {
        id: 2,
        name: "daniel"
      },
      {
        id: 3,
        name: "lauren"
      }
    ]);
  }

  const messages = await node1.createTesseract(
    "messages",
    messageQueueDefinition
  );
  //   await wait(100)
  if (config.resetDataAtStart) {
    messages.reset(
      [{
          id: 1,
          message: "rafal",
          user: 3,
          status: 1
        },
        {
          id: 2,
          message: "daniel",
          user: 1,
          status: 1
        },
        {
          id: 3,
          message: "lauren",
          user: 2,
          status: 1
        },
        {
          id: 4,
          message: "rafal",
          user: 2,
          status: 2
        },
        {
          id: 5,
          message: "daniel",
          user: 2,
          status: 2
        }
      ],
      config.disableClusterUpdateOnReset
    );
  } else {
    messages.add({
      id: 1,
      message: "rafal",
      user: 3,
      status: 1
    });
    messages.add({
      id: 2,
      message: "daniel",
      user: 1,
      status: 1
    });
    messages.add({
      id: 3,
      message: "lauren",
      user: 2,
      status: 1
    });
    messages.add({
      id: 4,
      message: "rafal",
      user: 2,
      status: 2
    });
    messages.add({
      id: 5,
      message: "daniel",
      user: 2,
      status: 2
    });
  }

  await node2.connect({
    syncSchema: false
  });
  console.log("node2 online");

  const session = await node2.createSessionAsync(liveQuery)
  const session2 = await node2.createSessionAsync({
    table: 'users'
  })
  session2.on('dataUpdate', x => {
    console.log('tessy clear received for node 2', x.toJSON())
  })



  console.log("summary", session.getLinq().select(x => x.object).toArray());

  await node3.connect({
    syncSchema: true
  });
  console.log("node3 online");
  const session1 = await node1.createSessionAsync({
    table: 'users'
  })
  session1.on('dataUpdate', x => {
    console.log('tessy clear received for node 1', x.toJSON())
  })
  const tessio = await node3.getTesseract('messages')

  // await node3.clear()


  await wait(10)
  console.log("summary", session2.getLinq().select(x => x.object).toArray());
  console.log('messages very after', node1.get('messages').getCount())
  console.log('messages very after', node2.get('messages').getCount())
  console.log('messages very after', node3.get('messages').getCount())
  await wait(10)
};
main();