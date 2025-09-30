# SQL to Tessio Converter Tests

This document covers the test suite for the SQL to Tessio converter located in `tests/sqlToTessioConverter.ts`.

## Test Overview

**Total Tests**: 122 individual test cases in 10 test groups covering complete SQL to Tessio conversion functionality.

## Running Tests

```bash
# SQL converter tests only
npm run test:sql-converter

# Complete test suite
npm test

# Direct execution
npx ts-node -P tsconfig.tests.json tests/sqlToTessioConverter.ts
```

## Test Categories

### 1. Basic SELECT Queries (Tests 1-19)

```typescript
// Simple SELECT with WHERE
const sql = "SELECT name, email FROM users WHERE active = true";
const result = converter.convertSql(sql);

// Expected result structure
{
  sessionConfig: {
    table: 'users',
    columns: [
      { name: 'name' },
      { name: 'email' }
    ],
    filter: [
      { field: 'active', comparison: '==', value: true }
    ]
  }
}
```

```typescript
// SELECT * (all columns)
const sql = "SELECT * FROM products";
// Results in empty columns array - Tessio uses all available columns
```

```typescript
// ORDER BY multiple columns
const sql = "SELECT name FROM users ORDER BY created_at DESC, name ASC";
// Results in sort array with proper field/direction mapping
```

### 2. WHERE Clause Parsing (Tests 20-64)

```typescript
// Supported operators
const testCases = [
    { sql: "WHERE age > 25", expected: { field: 'age', comparison: '>', value: 25 } },
    { sql: "WHERE age >= 18", expected: { field: 'age', comparison: '>=', value: 18 } },
    { sql: "WHERE name = 'John'", expected: { field: 'name', comparison: '==', value: 'John' } },
    { sql: "WHERE active != true", expected: { field: 'active', comparison: '!=', value: true } },
    { sql: "WHERE category IN ('A', 'B')", expected: { field: 'category', comparison: 'in', value: ['A', 'B'] } },
    { sql: "WHERE name LIKE 'John%'", expected: { field: 'name', comparison: 'like', value: 'John%' } }
];
```

```typescript
// Multiple WHERE conditions
const sql = "SELECT * FROM users WHERE age > 18 AND active = true AND department = 'IT'";
// Results in filter array with 3 conditions
```

### 3. Aggregation Queries (Tests 65-75)

```typescript
const sql = `
    SELECT department, COUNT(*) as employee_count, AVG(salary) as avg_salary, SUM(bonus) as total_bonus
    FROM employees 
    WHERE active = true 
    GROUP BY department 
    ORDER BY avg_salary DESC
`;

// Expected result
{
  sessionConfig: {
    table: 'employees',
    columns: [
      { name: 'department' },
      { name: 'employee_count', aggregator: 'count' },
      { name: 'avg_salary', aggregator: 'avg' },
      { name: 'total_bonus', aggregator: 'sum' }
    ],
    groupBy: [{ dataIndex: 'department' }],
    filter: [{ field: 'active', comparison: '==', value: true }],
    sort: [{ field: 'avg_salary', direction: 'desc' }]
  }
}
```

### 4. LIMIT and OFFSET (Tests 76-79)

```typescript
// LIMIT only
const sql1 = "SELECT * FROM users LIMIT 10";
// Result: { limit: 10 }

// LIMIT with OFFSET
const sql2 = "SELECT * FROM users LIMIT 20 OFFSET 5";
// Result: { limit: 20, offset: 5 }
```

### 5. Expression Columns (Tests 80-89)

```typescript
const sql = `
    SELECT 
        name,
        salary + bonus AS total_compensation,
        age > 30 AS is_senior
    FROM employees
`;

// Results in columns with expression properties
{
  columns: [
    { name: 'name' },
    { name: 'total_compensation', expression: 'salary + bonus' },
    { name: 'is_senior', expression: 'age > 30' }
  ]
}
```

### 6. Error Handling (Tests 90-92)
```typescript
// Error handling tests
converter.convertSql("INVALID SQL QUERY");          // Throws: Invalid SQL
converter.convertSql("");                           // Throws: Invalid SQL  
converter.convertSql("SELECT name");                // Throws: Invalid SQL (no FROM)
```

### 7. Complex Scenarios (Tests 93-100)

```typescript
// Real-world complex query
const complexSql = `
    SELECT 
        e.name, e.department, COUNT(*) as project_count, AVG(p.budget) as avg_budget
    FROM employees e
    LEFT JOIN projects p ON e.id = p.employee_id
    WHERE e.active = true AND e.salary > 50000
    GROUP BY e.id, e.name, e.department
    ORDER BY project_count DESC, avg_budget ASC
    LIMIT 25 OFFSET 10
`;

// Results in sessionConfig with warnings for JOINs
// JOINs converted to warnings - use SubSessions instead
```

### 8. Subquery Support (Tests 101-110)

```typescript
// SELECT clause subquery → resolve configuration
const sql1 = `
    SELECT 
        name, 
        (SELECT COUNT(*) FROM orders WHERE orders.user_id = users.id) as order_count
    FROM users
`;

// WHERE IN subquery → SubSessions
const sql2 = `
    SELECT name FROM users 
    WHERE id IN (SELECT user_id FROM orders WHERE total > 100)
`;

// EXISTS subquery → SubSessions with warnings
const sql3 = `
    SELECT name FROM users 
    WHERE EXISTS (SELECT 1 FROM orders WHERE orders.user_id = users.id)
`;

// FROM clause subquery → nested session
const sql4 = `
    SELECT u.name, u.total_orders
    FROM (SELECT user_id, COUNT(*) as total_orders FROM orders GROUP BY user_id) u
`;
```

### 9. Complex Subqueries (Tests 111-115)

```typescript
// Nested subqueries → multiple SubSessions
const sql = `
    SELECT name FROM users 
    WHERE id IN (
        SELECT user_id FROM orders 
        WHERE product_id IN (SELECT id FROM products WHERE category = 'electronics')
    )
`;

// Scalar subquery → resolve configuration
const sql2 = `
    SELECT 
        name, salary,
        (SELECT AVG(salary) FROM employees) as avg_salary
    FROM employees 
    WHERE department = 'IT'
`;
```

### 10. Utility Functions (Tests 116-122)

```typescript
// sqlToTessio utility
const sql = "SELECT name, age FROM users WHERE age > 21 ORDER BY name";
const result = sqlToTessio(sql);
// Returns: { sessionConfig, warnings, unsupportedFeatures }

// sqlToTessioExample utility
const example = sqlToTessioExample(sql);
// Returns formatted code example with original SQL and conversion
```

## TypeScript Integration

```typescript
import { Test } from 'tape';
import { SqlToTessioConverter, SqlParseResult } from '../src/lib/sqlToTessioConverter';

test('Test Name', function (t: Test) {
    const converter = new SqlToTessioConverter();
    const result: SqlParseResult = converter.convertSql(sql);
    
    // Type-safe property access with null checks
    t.ok(result.sessionConfig.columns, 'Columns array exists');
    t.equal(result.sessionConfig.columns!.length, 2, 'Column count correct');
});
```

### Null Safety Pattern

```typescript
// Safe pattern used throughout tests
t.ok(result.sessionConfig.filter, 'Filter array exists');
t.equal(result.sessionConfig.filter!.length, 1, 'Filter count correct');
```

## SQL to Tessio Mapping Reference

| SQL Feature | Tessio Equivalent | Test Coverage |
|------------|------------------|---------------|
| `SELECT name, email` | `columns: [{ name: 'name' }, { name: 'email' }]` | ✅ |
| `FROM table` | `table: 'table'` | ✅ |
| `WHERE field = value` | `filter: [{ field, comparison: '==', value }]` | ✅ |
| `ORDER BY field DESC` | `sort: [{ field, direction: 'desc' }]` | ✅ |
| `GROUP BY field` | `groupBy: [{ dataIndex: 'field' }]` | ✅ |
| `COUNT(*) as count` | `{ name: 'count', aggregator: 'count' }` | ✅ |
| `LIMIT 10 OFFSET 5` | `{ limit: 10, offset: 5 }` | ✅ |
| Subqueries | `SubSessions` or `resolve` configs | ✅ |
| JOINs | Warnings → use SubSessions | ⚠️ |
| Complex expressions | `expression` property + warnings | ⚠️ |

## Known Limitations (Tested)

- **Expression columns**: Return template strings instead of calculated values
- **JOINs**: Require manual SubSession implementation  
- **Correlated subqueries**: Need manual linking in resolve configurations

---

**Framework**: Tape with TypeScript  
**Total Tests**: 122  
**Execution Time**: ~100ms
