const tape = require("tape");

const Cluster = require("../../lib/clusterRedis");

const usersDefinition = {
  columns: [
    { name: "id", primaryKey: true },
    { name: "name" },
    { name: "status" }
  ]
};

function testMatrix(params) {
  const matrix = [];
  const iterations = params
    .map(values => values.length)
    .reduce((acc, c) => acc * c, 1);

  for (let i = 0; i < iterations; i++) {
    matrix.push(
      params.map(
        (values, k) =>
          values[~~(i / 2 ** (params.length - (k + 1))) % values.length]
      )
    );
  }

  return matrix;
}

function formatOptions([clusterSync, persistent, local]) {
  const options = [];
  clusterSync && options.push("clusterSync");
  persistent && options.push("persistent");
  clusterSync && options.push(local ? "local" : "remote");
  return options.join(", ");
}

testMatrix([
  [false, true],
  [false, true],
  [false, true],
  [false, true]
]).forEach(async ([clusterSync, persistent, local, async]) => {
  const options = formatOptions([clusterSync, persistent, local]);

  tape(`add${async ? "Async" : ""} ${options}`, async t => {
    const { collectEvents, cleanup, tessIn, tessOut } = await setup(options);
    const events = collectEvents(tessOut);

    if (async) {
      await tessIn.addAsync([
        { id: 1, name: "rafal" },
        { id: 2, name: "lauren", status: 1 }
      ]);
      await tessIn.addAsync([{ id: 3, name: "daniel" }]);
    } else {
      tessIn.add([
        { id: 1, name: "rafal" },
        { id: 2, name: "lauren", status: 1 }
      ]);
      tessIn.add([{ id: 3, name: "daniel" }]);
    }

    t.deepLooseEqual(await events, [
      [
        "dataUpdate",
        { id: 1, name: "rafal" },
        { id: 2, name: "lauren", status: 1 }
      ],
      ["dataUpdate", { id: 3, name: "daniel" }]
    ]);
    cleanup(t);
  });

  tape(`update${async ? "Async" : ""} ${options}`, async t => {
    const { collectEvents, cleanup, tessIn, tessOut } = await setup(options);
    const events = collectEvents(tessOut);

    if (async) {
      await tessIn.addAsync([
        { id: 1, name: "rafal" },
        { id: 2, name: "lauren", status: 1 }
      ]);
      await tessIn.updateAsync([{ id: 1, status: 2 }]);
    } else {
      tessIn.add([
        { id: 1, name: "rafal" },
        { id: 2, name: "lauren", status: 1 }
      ]);
      tessIn.update([{ id: 1, status: 2 }]);
    }

    t.deepLooseEqual(await events, [
      [
        "dataUpdate",
        { id: 1, name: "rafal" },
        { id: 2, name: "lauren", status: 1 }
      ],
      ["dataUpdate", { id: 1, name: "rafal", status: 2 }]
    ]);
    cleanup(t);
  });

  tape(`remove${async ? "Async" : ""} ${options}`, async t => {
    const { collectEvents, cleanup, tessIn, tessOut } = await setup(options);
    const events = collectEvents(tessOut);

    if (async) {
      await tessIn.addAsync([
        { id: 1, name: "rafal" },
        { id: 2, name: "lauren", status: 1 }
      ]);
      await tessIn.removeAsync(2);
    } else {
      tessIn.add([
        { id: 1, name: "rafal" },
        { id: 2, name: "lauren", status: 1 }
      ]);
      tessIn.remove([2]);
    }

    t.deepLooseEqual(await events, [
      [
        "dataUpdate",
        { id: 1, name: "rafal" },
        { id: 2, name: "lauren", status: 1 }
      ],
      ["dataRemove", 2]
    ]);
    cleanup(t);
  });

  tape(`test case 1 ${async ? "async" : ""} ${options}`, async t => {
    const [clusterSync, persistent] = options;

    const { collectEvents, cleanup, tessIn, tessOut } = await setup(options);
    const events = collectEvents(tessOut);

    if (async) {
      await tessIn.addAsync([{ id: 3, name: "daniel" }]);
      await tessIn.clear();
      await tessIn.addAsync([
        { id: 1, name: "rafal" },
        { id: 2, name: "lauren", status: 1 }
      ]);
      await tessIn.removeAsync(2);
    } else {
      tessIn.add([{ id: 3, name: "daniel" }], true);
      tessIn.clear(true);
      tessIn.add([
        { id: 1, name: "rafal" },
        { id: 2, name: "lauren", status: 1 }
      ],true);
      tessIn.remove([2],true);
    }

    t.deepLooseEqual(
      await events,
      [
        ["dataUpdate", { id: 3, name: "daniel" }],
        ["dataRemove", 3],
        async && clusterSync && persistent && ["dataUpdate"], // empty snapshot for persistent
        [
          "dataUpdate",
          { id: 1, name: "rafal" },
          { id: 2, name: "lauren", status: 1 }
        ],
        ["dataRemove", 2]
      ].filter(x => x)
    );
    cleanup(t);
  });
});

async function setup([clusterSync, persistent, local]) {
  let node1, node2;
  let tessIn, tessOut;

  // use separate cluster for cleaning, `clear` leaves it unusable atm
  const janitor = new Cluster();
  await janitor.connect({});
  await janitor.clear();
  janitor.close();

  node1 = new Cluster();
  await node1.connect({ syncSchema: false });

  tessIn = await node1.createTesseract("users", {
    columns: usersDefinition.columns.slice(),
    clusterSync,
    persistent
  });

  if (clusterSync) {
    node2 = new Cluster();
    await node2.connect({ syncSchema: true });
  }

  if (local || !clusterSync) {
    tessOut = tessIn;
  } else {
    tessOut = await node2.getTesseract("users");
  }

  function collectEvents(tesseract, timeout = 5) {
    const events = [];

    return new Promise(resolve => {
      const done = () => resolve(events);
      let timeoutId = setTimeout(done, timeout);

      ["dataUpdate", "dataRemove"].forEach(name => {
        tesseract.on(name, data => {
          // data can be mutated
          const dataCopy = JSON.parse(JSON.stringify(data));
          events.push([name, ...dataCopy]);

          clearTimeout(timeoutId);
          timeoutId = setTimeout(done, timeout);
        });
      });
    });
  }

  function cleanup(t) {
    setTimeout(() => {
      node1.close();
      node2 && node2.close();
      t.end();
    }, 5);
  }

  return {
    collectEvents,
    cleanup,
    tessIn,
    tessOut
  };
}
