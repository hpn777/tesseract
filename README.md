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
      underlyingName: 'user',
      childrenTable: 'user',
      valueField: 'id',
      displayField: 'name'
    }
  }],
  filter: [{
      type: 'custom',
      value: 'status == 2',
  }],
  sort: [{ field: 'id', direction: 'desc' }]
}
```
