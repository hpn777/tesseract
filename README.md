### Tesseract

Run unit tests:

```bash
npm test
```

### Query

```ts
interface Message {
  kind: 'message'
  id: number
  message: string
  status: string
  user: number
}

interface User {
  kind: 'user'
  id: number
  name: string
}

/**
 * Three generic parameters:
 *
 * 1. Type of a main table
 * 2. Union of all types that columns will resolve
 * 3. The discriminant property of the union
 */
let query: Query<Message, User, 'kind'> = {
  id: 'messages_query',
  table: 'message',
  columns:  [{
    name: 'id',
    primaryKey: true
  },{
    name: 'message',
  },{
    name: 'status',
  },{
    name: 'userName',
    resolve: {
      underlyingField: 'user',
      childrenTable: 'user',
      displayField: 'name'
    }
  }],
  filter: [{
      type: 'custom',
      value: 'status == 2',
  }],
  sort: [{ field: 'id', direction: 'desc' }]
}

let complexQuery: Query<Message, User, 'kind'> = {
    id: 'aggregated_subquery',
    table: 'users',
    subSessions: {
        msgPerUser: {
            table: 'message',
            columns:  [{
                name: 'user',
                primaryKey: true,
            }, {
                name: 'count',
                value: 1,
                aggregator: 'sum'
            }],
            groupBy: [{ dataIndex: 'user' }]
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
            session: 'msgPerUser',
            displayField: 'count'
        }
    },{
        name: 'halfCount',
        value: x => x.msgCount/2
    }, {
        name: 'templatedName',
        value: '${name} - ${msgCount}'
    }],
    filter: [{
        type: 'custom',
        value: 'msgCount > 1',
    }],
    sort: [  { field: 'name', direction: 'asc' }]
}
```
