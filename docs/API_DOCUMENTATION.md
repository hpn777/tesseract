# Tesseract Project: Detailed API Documentation

## Table of Contents
- [lib/clusterRedis.js](#libclusterredisjs)
- [lib/commandPort.js](#libcommandportjs)
- [lib/eventHorizon.js](#libeventhorizonjs)
- [lib/expressionEngine.js](#libexpressionenginejs)
- [lib/filter.js](#libfilterjs)
- [lib/filters.js](#libfiltersjs)
- [lib/redisMQ.js](#libredismqjs)
- [lib/session.js](#libsessionjs)
- [lib/tesseract.js](#libtesseractjs)
- [lib/utils.js](#libutilsjs)

---

## lib/clusterRedis.js

### TessSync Class
Handles distributed synchronization and management of Tesseract instances using Redis.

#### constructor(options, evH = new EventHorizon(options))
Creates a new TessSync instance.
- **options**: Configuration object for EventHorizon and Redis.
- **evH**: (optional) An existing EventHorizon instance. If not provided, a new one is created.

#### async connect({ redis = { host: 'redis', port: 6379 }, syncSchema = false })
Connects to Redis and optionally synchronizes schema.
- **redis**: Redis connection options.
- **syncSchema**: Boolean, whether to synchronize schema from Redis.

#### close()
Closes the RedisMQ connection.

#### async clear()
Clears all Tesseract data and related Redis keys.

#### get(...args)
Proxies to `EventHorizon.get`. Retrieves a Tesseract or other object by name or criteria.

#### getTesseract(...args)
Proxies to `EventHorizon.getTesseract`. Retrieves a Tesseract instance by name.

#### createTesseract(name, options)
Creates a new Tesseract instance, optionally syncing its definition to Redis.
- **name**: Name of the Tesseract.
- **options**: Tesseract configuration options.
- **Returns**: `Promise<Tesseract>`

#### pullTesseract(name, timeout = 60, retryNr = 0)
Attempts to retrieve or create a Tesseract by name, retrying until available or timeout.
- **name**: Name of the Tesseract.
- **timeout**: Maximum number of retries (default 60).
- **retryNr**: Current retry count (default 0).
- **Returns**: `Promise<Tesseract>`

#### createSession(...args)
Proxies to `EventHorizon.createSession`. Creates a new session.

#### async createSessionAsync(parameters)
Ensures all required tables are available, then creates a session.
- **parameters**: Session/query definition.
- **Returns**: `Promise<Session>`

#### createUnion(...args)
Proxies to `EventHorizon.createUnion`. Creates a union session.

#### createTesseractFromSession(...args)
Proxies to `EventHorizon.createTesseractFromSession`. Creates a Tesseract from a session.

#### getSession(...args)
Proxies to `EventHorizon.getSession`. Retrieves a session by ID or criteria.

#### on(...args), off(...args), once(...args), trigger(...args)
Event handling methods, proxied to EventHorizon.

#### async syncEvH(autoSync)
Synchronizes EventHorizon definitions from Redis and subscribes to definition changes.
- **autoSync**: Boolean, whether to automatically create Tesseracts for new definitions.

#### async syncTesseract(tesseract)
Synchronizes a Tesseract's data and updates with Redis, handling both persistent and non-persistent modes.
- **tesseract**: The Tesseract instance to synchronize.

---

## lib/commandPort.js

### CommandPort Class
TCP server for remote command execution on EventHorizon.

#### constructor(evH, config)
- **evH**: EventHorizon instance.
- **config**: `{ host, port }` for TCP server.
- Starts a TCP server that listens for incoming connections and allows remote command execution on the EventHorizon instance.

#### processRequest(message, callback)
- **message**: String command(s) received from the client.
- **callback**: Function to call with the result.
- Splits the message into lines, executes each as a JavaScript expression in the context of the EventHorizon instance, and returns the result or error as a string.

**Example usage:**
```
let cp = new CommandPort(evH, { host: '127.0.0.1', port: 9000 });
// Connect via telnet or netcat and send commands like: get('tableName')
```

---

## lib/eventHorizon.js

### EventHorizon Class
Central event and data manager for Tesseract tables and sessions.

#### constructor(options = {})
- **options**: `{ namespace, commandPort }`.
- Initializes tesseracts and sessions collections.
- Optionally starts a CommandPort for remote control.

#### on(...args), off(...args), once(...args), trigger(...args)
Event handling methods for tesseracts.

#### resolve(resolve, data)
Resolves a value from a related table using a resolve definition.
- **resolve**: Resolve definition object.
- **data**: Row data.
- Returns the resolved value or undefined if not found.

#### get(key)
Returns a tesseract by name (optionally namespaced).
- **key**: Table name.

#### getTesseract(tableName)
Returns a promise that resolves to a tesseract by name.
- **tableName**: Table name.

#### createTesseract(name, options)
Creates and registers a new tesseract if it does not exist.
- **name**: Table name.
- **options**: Tesseract options.

#### registerTesseract(newTesseract)
Sets up listeners for resolved columns and dependencies between tesseracts.
- **newTesseract**: Tesseract instance.

#### registerSession(newSession)
Sets up listeners for resolved columns and dependencies between sessions and tesseracts.
- **newSession**: Session instance.

#### createUnion(name, options)
Creates a union tesseract from multiple sessions.
- **name**: Name of the union tesseract.
- **options**: Union options, including subSessions.

#### createTesseractFromSession(name, session)
Creates a tesseract from a session, handling groupBy and event wiring.
- **name**: Name of the tesseract.
- **session**: Session instance.

#### createSession(parameters, reuseSession = false)
Creates a new session or reuses an existing one. Sessions provide filtered, sorted, and grouped views of data with optional relational queries through subSessions.

**Parameters:**
- **parameters**: Session configuration object with the following properties:
  - **id**: Optional session identifier
  - **table**: Source table name (string) or nested session config (object)
  - **filter**: Array of filter objects for data filtering
  - **sort**: Array of sort configurations
  - **columns**: Column definitions for the session
  - **groupBy**: Array of grouping configurations for data aggregation
  - **subSessions**: Object defining relational queries to other tables
  - **includeLeafs**: Boolean to include leaf nodes in grouped data
- **reuseSession**: If true, reuses an existing session.

**SubSessions Configuration:**
SubSessions enable relational queries similar to SQL JOINs with real-time updates:

```javascript
subSessions: {
    sessionName: {
        table: 'relatedTable',        // Related table name
        columns: [                    // Aggregated columns definition
            {
                name: 'groupField',   // Field to group by
                primaryKey: true
            },
            {
                name: 'aggregatedValue',
                value: 'fieldToAggregate', // Field or expression to aggregate
                aggregator: 'sum|avg|max|min|count'
            }
        ],
        filter: [...],                // Optional filters for the subSession
        groupBy: [{ dataIndex: 'groupField' }] // Required groupBy configuration
    }
}
```

**Column Resolve Configuration:**
Use resolve to link main session columns with subSession data:

```javascript
columns: [
    {
        name: 'resolvedColumn',
        resolve: {
            underlyingField: 'idField',      // Field in main table
            session: 'subSessionName',       // Reference to subSession
            valueField: 'groupField',        // Field in subSession to match
            displayField: 'aggregatedValue'  // Field to display from subSession
        }
    }
]
```

**GroupBy Configuration:**
GroupBy enables data aggregation with multiple levels:

```javascript
groupBy: [
    { dataIndex: 'level1Field' },    // First grouping level
    { dataIndex: 'level2Field' },    // Second grouping level
    { dataIndex: 'level3Field' }     // Third grouping level
]
```

**Aggregator Types:**
- **sum**: Sum of values
- **avg**: Average of values  
- **max**: Maximum value
- **min**: Minimum value
- **count**: Count of records
- **expression**: Custom expression-based aggregation

#### generateHash(obj)
Generates a hash for a session configuration.
- **obj**: Object to hash.

#### getSession(sessionName)
Returns a session by name.
- **sessionName**: Session name.

**Example usage:**
```
const eh = new EventHorizon({namespace: 'ns'});
const t = eh.createTesseract('myTable', {columns: [...]})
const session = eh.createSession({table: 'myTable', columns: [...]})
```

---

## lib/expressionEngine.js

### ExpressionEngine Class
Expression parsing and evaluation engine for computed columns and filters.

#### constructor(...args)
- Initializes the engine and its expression cache.

#### generateExpressionTree(entryString)
- **entryString**: String containing the expression to parse.
- Returns an expression tree representing the parsed logic, supporting arithmetic, logical, comparison, lambda, and function expressions.

#### (static) Functions
- A dictionary of supported operators and their implementations, e.g. `+`, `-`, `*`, `/`, `==`, `!=`, `in`, `like`, etc.

// ... (other methods for parsing, evaluating, and executing expressions are present in the file)

**Example usage:**
```
const ee = new ExpressionEngine();
const tree = ee.generateExpressionTree('a + b * (c > 2 ? d : e)');
// Evaluate tree with custom data context
```

---

## lib/filter.js

### Filter Class (extends ExpressionEngine)
A filter engine for rows, supporting boolean, date, custom, and generic comparisons.

#### constructor(...args)
- Initializes the filter with comparison, field, type, and value.
- Dynamically assigns the `applyFilter` method based on the filter type:
  - **boolean**: Checks equality.
  - **date/datetime**: Compares timestamps.
  - **custom**: Uses a custom expression.
  - **default**: Uses a comparison operator from `Functions`.

#### applyFilter(row)
- Returns true if the row passes the filter. Overridden in the constructor for actual logic.

#### custom(expression, row)
- **expression**: String expression to evaluate.
- **row**: Data row.
- Parses and executes a custom expression tree for the row.

**Example usage:**
```
const filter = new Filter({ field: 'age', comparison: '>', value: 18, type: 'number' });
const isAdult = filter.applyFilter({ age: 21 }); // true
```

---

## lib/filters.js

### Filters Class
A collection of filter objects, supporting batch application and reset.

#### constructor()
- Initializes an empty filter list.

#### reset(items)
- **items**: Array of filter objects.
- Replaces the current filter list and updates the length.

#### applyFilters(row)
- **row**: Data row.
- Returns true if the row passes all filters in the collection.

---

## lib/redisMQ.js

### RedisMQ (function/class)
A Redis-based message queue and pub/sub utility for distributed eventing and data synchronization.

#### constructor(redisConfig = {})
- **redisConfig**: Configuration object for ioredis.
- Initializes publisher and subscriber Redis clients.

#### on(...args)
- Proxies to the Redis `on` method for subscribing to events.

#### remove({ channel, startTime = 0, endTime = '+inf' })
- Removes messages from a sorted set in Redis by score range.
- **channel**: Redis key.
- **startTime**: Start score (default 0).
- **endTime**: End score (default '+inf').

#### close()
- Disconnects both publisher and subscriber Redis clients.

#### del(channel)
- Deletes a Redis key.

#### keys(pattern)
- Returns all keys matching a pattern.

#### replay(options)
- **options**: `{ startTime, endTime, batchSize, setName }`
- Returns an RxJS Observable that emits all messages in a sorted set within the given score range, in batches.

**Example usage:**
```js
const mq = new RedisMQ({ host: 'localhost', port: 6379 });
mq.on('connect', () => { ... });
mq.replay({ setName: 'tess.update.myTable' }).subscribe(msg => { ... });
```

---

## lib/session.js

### Session Class (extends Model)
Represents a query or aggregation session on a Tesseract table, supporting filtering, grouping, sorting, and event-driven updates.

#### constructor(model, options)
- **model**: Initial model data.
- **options**: Session configuration.
- Sets up columns, filters, data wrappers, and event listeners for data updates and removals.

#### refresh()
- Rebuilds the session's data cache, applies filters and sorting, and updates internal maps.

#### updateData(data, disableClusterUpdate, updateReason)
- Updates the session's data cache and map with new or changed rows, applying filters and emitting events as needed.
- Returns a result object with added, updated, and removed rows and IDs.

#### removeData(data, disableClusterUpdate)
- Removes rows from the session's data cache and map, emitting events as needed.

#### clear()
- Clears the session's data cache and map, marking the session for a data reset.

#### _getData(request)
- Internal method to get filtered, sorted, and paginated data as a linq.js query.

#### getData(request)
- Returns the session's data as an array, optionally filtered, sorted, and paginated.

#### getById(id)
- Returns a wrapped row by its primary key.

#### getLinq(request)
- Returns a linq.js query of the session's data, with data wrappers applied.

#### getCount()
- Returns the number of rows in the session's data cache.

#### collectGarbage()
- Rebuilds the data cache and map by applying all filters, using secondary indexes if possible.

#### filterData(filtersAttr)
- Applies new filters to the session and marks it for re-filtering and re-sorting.

#### groupData(groupBy, includeLeafs, nodeId)
- Groups the session's data by the specified columns, returning a hierarchical structure.

#### groupSelectedData(selectedRowsIds, groupBy, includeLeafs, nodeId)
- Groups only selected rows by the specified columns, returning a hierarchical structure.

#### returnTree(rootIdValue, parentIdField, groups)
- Recursively builds a tree structure from the session's data, starting from a root ID.

#### updateColumns(updatedColumns)
- Updates the session's columns and data wrappers, and refreshes the data cache.

#### getHeader(excludeHiddenColumns)
- Returns a detailed header for the session's columns.

#### getSimpleHeader(excludeHiddenColumns)
- Returns a simplified header for the session's columns.

**Example usage:**
```
const session = new Session({ tesseract, config: { columns: [...] } });
const data = session.getData();
```

---

## lib/tesseract.js

### Tesseract Class (extends Model)
In-memory analytics engine for tabular data, supporting sessions, computed columns, aggregation, and distributed sync.

#### constructor({ id, idProperty, resolve, columns, clusterSync, persistent, defferedDataUpdateTime })
- **id**: Table identifier.
- **idProperty**: Primary key field (default `'id'`).
- **resolve**: Column resolution logic.
- **columns**: Array of column definitions.
- **clusterSync**: Enable cluster synchronization.
- **persistent**: Enable persistence.
- **defferedDataUpdateTime**: Delay for data update batching.

#### generateIndex()
- Builds secondary indexes for columns marked with `secondaryKey`.

#### updateIndex(newData, dataHolder)
- Updates secondary indexes when a row is added or changed.

#### removeFromIndex(newData)
- Removes a row from secondary indexes.

#### get(stuff)
- Returns a property or method of the Tesseract instance by name.

#### createSession(config)
- Creates a new session for querying or aggregating data.

#### getTesseract()
- Returns a promise that resolves to this Tesseract instance.

#### getData()
- Returns the current data cache, filtering out removed rows.

#### getLinq()
- Returns a linq.js wrapper for the current data cache.

#### getCount()
- Returns the number of rows in the data cache.

#### getById(id)
- Returns a row by its primary key.

#### async add(data, disableClusterUpdate = false)
- Adds one or more rows to the Tesseract.

#### addAsync(data, disableClusterUpdate = false)
- Adds data and returns a promise that resolves when the data is updated.

#### reset(data, disableClusterUpdate = false, suppressEvents = false)
- Resets the Tesseract data to the provided array.

#### async update(data, disableClusterUpdate = false)
- Updates existing rows or adds new ones, triggers events as needed.

#### updateAsync(data, disableClusterUpdate = false)
- Updates data and returns a promise that resolves when the data is updated.

#### async remove(data, disableClusterUpdate = false)
- Marks rows as removed and updates indexes.

#### removeAsync(data, disableClusterUpdate = false)
- Removes data and returns a promise that resolves when the data is removed.

#### clear(disableClusterUpdate = false, suppressEvents = false)
- Clears all data from the Tesseract, optionally triggering cluster events.

#### updateColumns(newColumns, reset)
- Updates the Tesseract's columns and refreshes the data cache.

#### generateData(data)
- Generates a new data array with computed and resolved columns.

#### generateRow(data, columns, dataHolder, updateDataMap)
- Generates a single row with computed, resolved, and default values.

#### generateObjDef(columns)
- Dynamically creates a class definition for row objects based on columns.

#### returnTree(rootIdValue, parentIdField, groups)
- Recursively builds a tree structure from the Tesseract's data, starting from a root ID.

#### getHeader(excludeHiddenColumns)
- Returns a detailed header for the Tesseract's columns.

#### getSimpleHeader(excludeHiddenColumns)
- Returns a simplified header for the Tesseract's columns.

**Example usage:**
```
const t = new Tesseract({ id: 'myTable', columns: [...] });
t.add({ id: 1, name: 'Alice' });
const session = t.createSession({ columns: [...] });
```
