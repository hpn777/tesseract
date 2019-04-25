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
  disableClusterUpdateOnReset: false,

  // for getting node2 tesseracts before creating a session
  getTesseractsInOtherCluster: [],
  pullTesseractsInOtherCluster: ["messages", "users"]
};

const messageQueueDefinition = {
  clusterSync: config.clusterSync,
  persistent: config.persistent,
  columns: [
    {
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
  columns: [
    {
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

const wait = (time = 1000) => new Promise(res => {
  setTimeout(() => {
    res()
  }, time)
})

const main = async () => {
  const node1 = new TessCluster({nodeId: 'node1'});
  const node2 = new TessCluster({nodeId: 'node2'});
  const node3 = new TessCluster({nodeId: 'node3'});

  await node1.connect({ syncSchema: config.syncSchemaSource });
  console.log("node1 online");

  const users = await node1.createTesseract("users", usersDefinition);
//   await wait(100)
  if (config.resetDataAtStart) {
    users.reset(
      [
        { id: 1, name: "rafal" },
        { id: 2, name: "daniel" },
        { id: 3, name: "lauren" }
      ],
      config.disableClusterUpdateOnReset
    );
  } else {
    users.add([
      { id: 1, name: "rafal" },
      { id: 2, name: "daniel" },
      { id: 3, name: "lauren" }
    ]);
  }

  const messages = await node1.createTesseract(
    "messages",
    messageQueueDefinition
  );
//   await wait(100)
  if (config.resetDataAtStart) {
    messages.reset(
      [
        { id: 1, message: "rafal", user: 3, status: 1 },
        { id: 2, message: "daniel", user: 1, status: 1 },
        { id: 3, message: "lauren", user: 2, status: 1 },
        { id: 4, message: "rafal", user: 2, status: 2 },
        { id: 5, message: "daniel", user: 2, status: 2 }
      ],
      config.disableClusterUpdateOnReset
    );
  } else {
    messages.add({ id: 1, message: "rafal", user: 3, status: 1 });
    messages.add({ id: 2, message: "daniel", user: 1, status: 1 });
    messages.add({ id: 3, message: "lauren", user: 2, status: 1 });
    messages.add({ id: 4, message: "rafal", user: 2, status: 2 });
    messages.add({ id: 5, message: "daniel", user: 2, status: 2 });
  }

  await node2.connect({ syncSchema: config.syncSchemaConsumer });
  console.log("node2 online");

  await Promise.all([
    ...config.pullTesseractsInOtherCluster.map(t => node2.pullTesseract(t))
  ]);
console.log('node2 pulled', config.pullTesseractsInOtherCluster, )
  const session = node2.createSession({
    id: "messages_query",
    table: "messages",
    columns: [
      {
        name: "id",
        primaryKey: true
      },
      {
        name: "message"
      },
      {
        name: "status"
      },
      {
        name: "userName",
        resolve: {
          underlyingField: "user",
          childrenTable: "users",
          valueField: "id",
          displayField: "name"
        }
      }
    ],
    filter: [
      {
        type: "custom",
        value: "status == 2"
      }
    ],
    sort: [{ field: "id", direction: "desc" }]
  });


  console.log("summary", session.getData().map(x => x.object));

  await node3.connect({ syncSchema: true });
  console.log("node3 online");

  const tessio = await node3.getTesseract('messages')

  tessio.clear()

  await wait(100)
  console.log("summary", session.getData().map(x => x.object));

    console.log('messages very after',node1.get('messages').getCount())
    console.log('messages very after',node2.get('messages').getCount())
    console.log('messages very after',node3.get('messages').getCount())
};

main();