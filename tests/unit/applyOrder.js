const test = require("tape");
const _ = require("lodash");

const { applyOrder, createSessionProxyConfig } = require("../../lib/utils");

const objectDef = createSessionProxyConfig(() => undefined, [
  { name: "maybeNumber" },
  { name: "maybeString" },
  { name: "partitionByZeroish", expression: "maybeNumber > 0 ? 1 : 0" }
]);

const data = [
  { maybeNumber: -5, maybeString: "👻" },
  { maybeNumber: 10.5, maybeString: "foo" },
  { maybeNumber: 10, maybeString: "foo" },
  { maybeNumber: 10, maybeString: "bar2" },
  { maybeNumber: 10, maybeString: undefined },
  { maybeNumber: 10, maybeString: "" },
  { maybeNumber: undefined, maybeString: "bar" },
  { maybeNumber: 0, maybeString: "123" },
  { maybeNumber: 30, maybeString: "" }
];

test("applyOrder without sort", t => {
  const sorted = applyOrder(null, data, objectDef);

  t.strictEqual(sorted, data);
  t.end();
});

test("applyOrder with empty data", t => {
  const empty = [];
  const sorted = applyOrder(null, empty, objectDef);

  t.strictEqual(sorted, empty);
  t.end();
});

test("applyOrder sorting using expression", t => {
  const sorted = applyOrder(
    [
      { field: "partitionByZeroish", direction: "asc" },
      { field: "maybeString", direction: "asc" }
    ],
    data,
    objectDef
  );

  t.deepEqual(sorted, [
    { maybeNumber: -5, maybeString: "👻" },
    { maybeNumber: 0, maybeString: "123" },
    { maybeNumber: undefined, maybeString: "bar" },
    // 0 or 1 partition split for the first filter
    // (groupped records are equivalent for first filter)
    { maybeNumber: 10, maybeString: undefined },
    { maybeNumber: 10, maybeString: "" },
    { maybeNumber: 30, maybeString: "" },
    { maybeNumber: 10, maybeString: "bar2" },
    { maybeNumber: 10.5, maybeString: "foo" },
    { maybeNumber: 10, maybeString: "foo" }
  ]);
  t.end();
});

testSorting(
  data,
  [{ field: "maybeNumber", direction: "asc" }],
  [[undefined], [-5],[0], [10], [10], [10], [10], [10.5], [30]]
);

testSorting(
  data,
  [{ field: "maybeNumber", direction: "desc" }],
  [[30], [10.5], [10], [10], [10], [10], [0], [-5], [undefined]]
);

testSorting(
  data,
  [{ field: "maybeString", direction: "asc" }],
  [
    [undefined],
    [""],
    [""],
    ["👻"],
    ["123"],
    ["bar"],
    ["bar2"],
    ["foo"],
    ["foo"]
  ]
);

testSorting(
  data,
  [{ field: "maybeString", direction: "desc" }],
  [
    ["foo"],
    ["foo"],
    ["bar2"],
    ["bar"],
    ["123"],
    ["👻"],
    [""],
    [""],
    [undefined]
  ]
);

testSorting(
  data,
  [
    { field: "maybeNumber", direction: "desc" },
    { field: "maybeString", direction: "asc" }
  ],
  [
    [30, ""],
    [10.5, "foo"],
    [10, undefined],
    [10, ""],
    [10, "bar2"],
    [10, "foo"],
    [0, "123"],
    [-5, "👻"],
    [undefined, "bar"]
  ]
);

testSorting(
  data,
  [
    { field: "maybeNumber", direction: "desc" },
    { field: "maybeString", direction: "desc" }
  ],
  [
    [30, ""],
    [10.5, "foo"],
    [10, "foo"],
    [10, "bar2"],
    [10, ""],
    [10, undefined],
    [0, "123"],
    [-5, "👻"],
    [undefined, "bar"]
  ]
);

function testSorting(data, sorting, expected) {
  const options = sorting
    .map(({ field, direction }) => `${field} ${direction}`)
    .join(", ");

  test(`applyOrder ${options}`, t => {
    const sorted = applyOrder(sorting, data.slice(), objectDef);

    t.deepEqual(
      sorted.map(r => sorting.map(({ field }) => r[field])),
      expected
    );
    t.end();
  });
}
