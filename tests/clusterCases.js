const TessCluster = require("../lib/clusterRedis");

/*

Test cases

clusterSync persistent  syncSchemaSource	syncSchemaConsumer	resetDataAtStart	disableClusterUpdateOnReset	getTesseractsInOtherCluster	Data sync
1           0           0                 1                   1                 0                           messages, users             0
1           1           0                 1                   1                 1                           messages, users             0
1           1           1                 1                   1                 1                           messages, users             0
1           1           1                 1                   1                 0                           messages, users             1
1           0           0                 1                   0                 0                           messages, users             1
1           1           0                 1                   1                 0                           messages, users             1

Generally, it works if:
1. there is no persist and data is added row by row
2. there is persist and data reset at start with cluster update enabled

*/

const config = {
  // data schema
  clusterSync: true, // always true, otherwise it hangs out
  persistent: true,

  // for node1 cluster connect
  syncSchemaSource: true,
  // for node2 cluster connect
  syncSchemaConsumer: true,

  // how to set initial data, adding records manually or doing reset
  resetDataAtStart: true,
  // If we use reset, should we disable cluster update?
  disableClusterUpdateOnReset: false,

  // for getting node2 tesseracts before creating a session
  getTesseractsInOtherCluster: ["messages", "users"] // at least one is needed, otherwise there is msg that cache does not exist
};

const node1 = new TessCluster();
const node2 = new TessCluster();

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

const main = async () => {
  await node1.connect({ syncSchema: config.syncSchemaSource });
  console.log("node1 online");

  const users = await node1.createTesseract("users", usersDefinition);
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

  await Promise.all(
    config.getTesseractsInOtherCluster.map(t => node2.getTesseract(t))
  );

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

  setTimeout(() => {
    console.log("summary", session.getData().map(x => x.object));

    process.exit(0);
  }, 1000);
};

main();
