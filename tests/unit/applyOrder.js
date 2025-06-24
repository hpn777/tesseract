const test = require("tape");
const _ = require("lodash");

const { applyOrder, createSessionProxyConfig } = require("../../lib/utils");

const objectDef = createSessionProxyConfig(() => undefined, [
  { name: "maybeNumber" },
  { name: "maybeString" },
  { name: "status" },
  { name: "partitionByZeroish", expression: "maybeNumber > 0 ? 1 : 0" }
]);

const data = [
  { maybeNumber: -5, maybeString: "👻", status: true },
  { maybeNumber: 10.5, maybeString: "foo", status: true },
  { maybeNumber: 10, maybeString: "foo", status: false },
  { maybeNumber: 10, maybeString: "bar2", status: true },
  { maybeNumber: 10, maybeString: null, status: false },
  { maybeNumber: 10, maybeString: "", status: false },
  { maybeNumber: null, maybeString: "bar", status: true },
  { maybeNumber: 0, maybeString: "123", status: true },
  { maybeNumber: 30, maybeString: "", status: false }
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
  ).map(x => ({ maybeNumber: x.maybeNumber, maybeString: x.maybeString }));

  t.deepEqual(sorted, [
    { maybeNumber: -5, maybeString: "👻" },
    { maybeNumber: 0, maybeString: "123" },
    { maybeNumber: null, maybeString: "bar" },
    // 0 or 1 partition split for the first filter
    // (groupped records are equivalent for first filter)
    { maybeNumber: 10, maybeString: null },
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
  [[null], [-5],[0], [10], [10], [10], [10], [10.5], [30]]
);

testSorting(
  data,
  [{ field: "maybeNumber", direction: "desc" }],
  [[30], [10.5], [10], [10], [10], [10], [0], [-5], [null]]
);

testSorting(
  data,
  [{ field: "status", direction: "desc" }],
  [[true], [true], [true], [true], [true], [false], [false], [false], [false]]
);

testSorting(
  data,
  [{ field: "maybeString", direction: "asc" }],
  [
    [null],
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
    [null]
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
    [10, null],
    [10, ""],
    [10, "bar2"],
    [10, "foo"],
    [0, "123"],
    [-5, "👻"],
    [null, "bar"]
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
    [10, null],
    [0, "123"],
    [-5, "👻"],
    [null, "bar"]
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
