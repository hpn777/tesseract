const tape = require('tape')
const { assertArraysMatch } = require('./utils')
const {
    generateSummaryRow,
    groupData,
    groupSelectedData,
    createSessionProxyConfig
} = require('../../lib/utils')

const objects = [
    [ 1, 'Daniel',1000, 'on',  'red'],
    [ 2, 'Rafal',900, 'on',  'blue'],
    [ 3, 'Kurt',500, 'away',  'red'],
    [ 4, 'Rick',4000, 'off',  'yellow'],
    [ 5, 'Morty',50, 'on',  'yellow'],
    [ 6, 'Bender',20, 'off',  'blue'],
]

const data = objects.map(i => {
  return {
    ...i,
    raw: Object.values(i),
    object: i
  }
})

const columns = [{
    name: 'id',
    columnType: 'number',
    primaryKey: true
}, {
    name: 'name',
    columnType: 'string'
}, {
    name: 'points',
    columnType: 'number',
    aggregator: 'sum'
}, {
    name: 'status',
    columnType: 'string'
}, {
    name: 'color',
    columnType: 'string'
}]

const groupBy = [{
    dataIndex: 'status'
}]

let defaultObjDef = createSessionProxyConfig(()=>{}, columns )
let dataWrapper = new defaultObjDef()

tape('utils.generateSummaryRow', t => {

    const summary = generateSummaryRow(data, dataWrapper, columns)
    t.deepEqual(summary, {points: 6470})
    t.end()
})

tape('utils.groupData', t => {

    let grouped1 = groupData(columns, data, dataWrapper, groupBy, true)

    let result1 = [{
        points: 1950,
        status: 'on'
    }, {
        points: 500,
        status: 'away'
    }, {
        points: 4020,
        status: 'off'
    }]

    assertArraysMatch(grouped1, result1, e => t.fail(e), () => t.pass('groupData 1'))

    t.equals(grouped1[0].children.length, 3)
    t.equals(grouped1[1].children.length, 1)
    t.equals(grouped1[2].children.length, 2)
    t.end()
})

tape('utils.groupSelectedData', t => {

    const selectedRowsIds = {
        '2': true,
        '3': true,
        '4': true
    }

    let grouped2 = groupSelectedData(
        columns, data, dataWrapper, groupBy, selectedRowsIds,
        true, '', undefined, undefined, 'id', 0, { applyFilters: () => true }
    )
    
    let result2 = [{
        points: 1950,
        status: 'on'
    }, {
        points: 500,
        status: 'away'
    }, {
        points: 4020,
        status: 'off'
    }]

    assertArraysMatch(grouped2, result2, e => t.fail(e), () => t.pass('groupSelectedData 1'))
    t.equals(grouped2[0].children.length, 1)
    t.equals(grouped2[1].children.length, 1)
    t.equals(grouped2[2].children.length, 1)

    t.end()
})

