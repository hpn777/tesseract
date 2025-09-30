# SQL to Tessio Query Converter

A powerful uti✅ **Expression columns** - Basic arithmetic and conditional expressions
✅ **Subqueries** - Converted to SubSessions and resolve configurations
⚠️ **JOINs** - Converted to SubSessions (requires manual adjustment)
⚠️ **Complex OR logic** - Requires manual conversion
⚠️ **Correlated subqueries** - Converted with manual linking requirements
❌ **HAVING clauses** - Use post-processing filters
❌ **Window functions** - Not available in Tessiohat converts SQL queries to EventHorizon session parameters, making it easier to migrate SQL-based applications to Tessio.

## Quick Start

```javascript
const { sqlToTessio } = require('tessio/lib/sqlToTessioConverter');
const { EventHorizon } = require('tessio');

const eventHorizon = new EventHorizon();

// Convert SQL to Tessio
const sql = "SELECT name, salary FROM employees WHERE active = true ORDER BY salary DESC";
const result = sqlToTessio(sql);

// Create session with converted config  
const session = eventHorizon.createSession(result.sessionConfig);
const data = session.getData();
```

## CLI Usage

```bash
# Install globally
npm install -g tessio

# Convert a SQL query
sql-to-tessio "SELECT * FROM users WHERE age > 21"

# Generate formatted example
sql-to-tessio --example "SELECT department, COUNT(*) FROM employees GROUP BY department"

# Convert from file
sql-to-tessio --file query.sql --output result.json

# Batch convert multiple queries
sql-to-tessio --batch --file queries.sql --output results.json
```

## Features

✅ **SELECT clauses** - Column selection, aliases, computed columns
✅ **WHERE conditions** - All comparison operators, IN/NOT IN, LIKE, IS NULL
✅ **ORDER BY** - Single/multiple columns with ASC/DESC
✅ **GROUP BY + Aggregations** - COUNT, SUM, AVG, MAX, MIN
✅ **LIMIT/OFFSET** - Pagination support
✅ **Expression columns** - Basic arithmetic and conditional expressions
✅ **Subqueries** - SELECT, WHERE (IN/EXISTS), FROM clause subqueries
⚠️ **JOINs** - Converted to SubSessions (requires manual adjustment)
⚠️ **Complex OR logic** - Requires manual conversion
⚠️ **Correlated subqueries** - Automatic detection with manual linking guidance
❌ **HAVING clauses** - Use post-processing filters
❌ **Window functions** - Not supported in Tessio

## Examples

### Basic Query
```sql
SELECT name, email FROM users WHERE active = true ORDER BY name
```
```javascript
// Converts to:
{
  table: 'users',
  columns: [{ name: 'name' }, { name: 'email' }],
  filter: [{ field: 'active', comparison: '==', value: true }],
  sort: [{ field: 'name', direction: 'asc' }]
}
```

### Aggregation Query
```sql
SELECT department, COUNT(*) as count, AVG(salary) as avg_salary
FROM employees 
WHERE active = true 
GROUP BY department
```
```javascript
// Converts to:
{
  table: 'employees',
  columns: [
    { name: 'department' },
    { name: 'count', value: 1, aggregator: 'count' },
    { name: 'avg_salary', value: 'salary', aggregator: 'avg' }
  ],
  filter: [{ field: 'active', comparison: '==', value: true }],
  groupBy: [{ dataIndex: 'department' }]
}
```

### Complex Filters
```sql
SELECT * FROM orders 
WHERE status IN ('pending', 'processing') 
AND amount > 100 
AND created_date >= '2023-01-01'
```
```javascript
// Converts to:
{
  table: 'orders',
  columns: [],
  filter: [
    { field: 'status', comparison: 'in', value: ['pending', 'processing'] },
    { field: 'amount', comparison: '>', value: 100 },
    { field: 'created_date', comparison: '>=', value: new Date('2023-01-01') }
  ]
}
```

### Subqueries
```sql
SELECT name, 
       (SELECT COUNT(*) FROM orders WHERE orders.user_id = users.id) as order_count
FROM users 
WHERE id IN (SELECT user_id FROM orders WHERE total > 100)
```
```javascript
// Converts to:
{
  table: 'users',
  columns: [
    { name: 'name' },
    {
      name: 'order_count',
      resolve: {
        underlyingField: 'id',
        session: { table: 'orders', columns: [{ name: 'count_*', aggregator: 'count' }] },
        displayField: 'order_count'
      }
    }
  ],
  subSessions: {
    'subquery_1': { table: 'orders', filter: [{ field: 'total', comparison: '>', value: 100 }] }
  }
}
```

## API Reference

### `sqlToTessio(sql: string): SqlParseResult`
Converts SQL to Tessio session config.

**Returns:**
- `sessionConfig` - Parameters for `EventHorizon.createSession()`
- `warnings` - Array of potential issues
- `unsupportedFeatures` - Features requiring manual conversion

### `SqlToTessioConverter` class
For advanced usage with custom parsing logic.

### `sqlToTessioExample(sql: string): string`
Generates formatted conversion examples with documentation.

## Migration Guide

1. **Inventory** - List all SQL queries in your application
2. **Categorize** - Separate simple from complex queries
3. **Convert** - Use the converter on straightforward queries
4. **Manual handling** - Address JOINs and complex features
5. **Test** - Validate converted queries return expected results
6. **Optimize** - Use warnings to identify optimization opportunities

## Limitations & Workarounds

### JOINs → SubSessions
```sql
-- SQL JOIN
SELECT u.name, d.dept_name 
FROM users u JOIN departments d ON u.dept_id = d.id
```
```javascript
// Tessio SubSession
{
  table: 'users',
  columns: [
    { name: 'name' },
    { 
      name: 'dept_name',
      resolve: {
        underlyingField: 'dept_id',
        childrenTable: 'departments',
        displayField: 'dept_name'
      }
    }
  ]
}
```

### Expression Columns
Expression columns may return template strings. For calculations, use value functions:
```javascript
// Instead of: { name: 'total', expression: 'price * quantity' }
// Use:
{ 
  name: 'total',
  value: (row) => row.price * row.quantity 
}
```

See [complete documentation](docs/SQL_TO_TESSIO_CONVERTER.md) for detailed information.
