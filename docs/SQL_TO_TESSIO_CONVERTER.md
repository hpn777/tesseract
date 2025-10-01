# SQL to Tessio Converter Guide

The SQL to Tessio converter transforms SQL queries into EventHorizon session configurations, enabling seamless migration from SQL databases to Tessio's in-memory analytics engine.

## 🚀 Quick Start

```typescript
import { sqlToTessio, sqlToTessioExample } from 'tessio';

// Basic conversion
const sql = "SELECT name, department FROM employees WHERE salary > 50000";
const result = sqlToTessio(sql);
const session = eventHorizon.createSession(result.sessionConfig);

// Generate example with documentation
const example = sqlToTessioExample(sql);
console.log(example); // Shows conversion with comments and warnings
```

## ✨ Key Features

### 🎯 Architectural Fix: WHERE + GROUP BY Support

**Problem Solved**: Previously, SQL queries with both WHERE and GROUP BY clauses would fail because filters were applied after aggregation, when original fields were no longer accessible.

**Solution**: Automatic nested table structure that applies filters before aggregation.

#### Before (Failed)
```sql
SELECT department, COUNT(*) as count 
FROM employees 
WHERE salary > 50000 
GROUP BY department
```
❌ Would generate broken Tessio config

#### After (Working)
```sql
SELECT department, COUNT(*) as count 
FROM employees 
WHERE salary > 50000 
GROUP BY department
```
✅ Automatically generates nested table structure:
```javascript
{
  table: {
    table: "employees",
    filter: [{ field: "salary", comparison: ">", value: 50000 }]
  },
  groupBy: [{ dataIndex: "department" }],
  columns: [
    { name: "department", primaryKey: true },
    { name: "count", value: 1, aggregator: "count" }
  ]
}
```

## 📊 Supported SQL Features

### ✅ SELECT Clauses
- Column selection: `SELECT name, email`
- All columns: `SELECT *`
- Aliases: `SELECT name AS full_name`
- Expressions: `SELECT salary * 1.1 AS adjusted_salary`

### ✅ Aggregation Functions
```sql
SELECT 
  department,
  COUNT(*) as employee_count,
  SUM(salary) as total_salary,
  AVG(salary) as average_salary,
  MAX(salary) as max_salary,
  MIN(salary) as min_salary
FROM employees 
GROUP BY department
```

### ✅ WHERE Clauses
```sql
-- Comparison operators
WHERE salary > 50000
WHERE department = 'Engineering'
WHERE active != true

-- IN/NOT IN
WHERE department IN ('Engineering', 'Sales')
WHERE id NOT IN (1, 2, 3)

-- LIKE patterns
WHERE name LIKE 'John%'
WHERE email NOT LIKE '%test%'

-- NULL checks
WHERE manager_id IS NULL
WHERE department IS NOT NULL

-- BETWEEN
WHERE salary BETWEEN 40000 AND 80000

-- Complex conditions
WHERE (salary > 50000 OR department = 'Sales') AND active = true
```

### ✅ GROUP BY & HAVING
```sql
-- Basic grouping
SELECT department, COUNT(*) as count
FROM employees 
GROUP BY department

-- Multiple group fields
SELECT department, location, COUNT(*) as count
FROM employees 
GROUP BY department, location

-- HAVING (post-aggregation filters)
SELECT department, COUNT(*) as count
FROM employees 
GROUP BY department 
HAVING count > 10
```

### ✅ ORDER BY
```sql
-- Single field
ORDER BY salary DESC

-- Multiple fields
ORDER BY department ASC, salary DESC
```

### ✅ LIMIT & OFFSET
```sql
-- Pagination
LIMIT 20 OFFSET 100

-- Just limit
LIMIT 50
```

## 🔧 Advanced Features

### Subquery Support
```sql
-- Subqueries in SELECT (converted to resolve configurations)
SELECT 
  name,
  (SELECT COUNT(*) FROM projects WHERE manager_id = employees.id) as project_count
FROM employees

-- Subqueries in FROM (nested sessions)
SELECT department, avg_salary 
FROM (
  SELECT department, AVG(salary) as avg_salary 
  FROM employees 
  GROUP BY department
) dept_averages
WHERE avg_salary > 60000
```

### Complex WHERE + GROUP BY
The converter automatically detects and optimizes these patterns:

```sql
-- This works perfectly now!
SELECT 
  department, 
  COUNT(*) as employee_count,
  SUM(salary) as total_salary,
  AVG(salary) as average_salary
FROM employees 
WHERE salary > 30000 AND active = true AND department != 'Intern'
GROUP BY department 
HAVING employee_count > 5
ORDER BY total_salary DESC
LIMIT 10
```

Converts to optimized nested structure:
```javascript
{
  table: {
    table: "employees",
    filter: [
      { field: "salary", comparison: ">", value: 30000 },
      { field: "active", comparison: "==", value: true },
      { field: "department", comparison: "!=", value: "Intern" }
    ]
  },
  groupBy: [{ dataIndex: "department" }],
  columns: [...],
  filter: [{ field: "employee_count", comparison: ">", value: 5 }], // HAVING clause
  sort: [{ field: "total_salary", direction: "desc" }],
  limit: 10
}
```

## ⚠️ Conversion Notes

### Warnings
The converter provides helpful warnings for:
- WHERE + GROUP BY → nested table structure applied
- HAVING clauses → converted to post-aggregation filters
- Expression columns → may return template strings
- Subqueries → manual linking may be required

### Unsupported Features
- Complex JOINs → Use SubSessions instead
- Window functions → Use expressions or manual implementation
- CTEs (WITH clauses) → Use subqueries or nested sessions
- UNION/INTERSECT → Combine multiple sessions

## 💡 Best Practices

### 1. Use Aliases for Clarity
```sql
-- Good
SELECT name AS employee_name, salary AS annual_salary FROM employees

-- Less clear
SELECT name, salary FROM employees
```

### 2. Leverage Nested Table Optimization
```sql
-- This automatically optimizes
SELECT department, COUNT(*) 
FROM employees 
WHERE active = true 
GROUP BY department
```

### 3. Handle Complex Logic with SubSessions
Instead of complex JOINs, use Tessio's SubSessions:
```typescript
const mainSession = eventHorizon.createSession({
  table: 'employees',
  columns: [
    { name: 'id', primaryKey: true },
    { name: 'name' },
    { name: 'department' }
  ],
  subSessions: {
    projects: {
      table: 'projects',
      columns: [
        { name: 'name' },
        { name: 'status' }
      ],
      filter: [
        { field: 'employee_id', comparison: '==', value: '{parent.id}' }
      ]
    }
  }
});
```

## 🧪 Testing Your Conversions

```typescript
import { sqlToTessioExample } from 'tessio';

// Generate detailed conversion example
const sql = "SELECT department, AVG(salary) FROM employees WHERE active = true GROUP BY department";
const example = sqlToTessioExample(sql);
console.log(example);

// Will show:
// - Original SQL
// - Generated Tessio config
// - Warnings and notes
// - Architectural optimizations applied
```

## 📈 Performance Benefits

- **Optimized Filtering**: Filters applied before aggregation for maximum efficiency
- **Memory Efficient**: Nested structures reduce intermediate result sets
- **Index Friendly**: Generated configs work well with Tessio's indexing
- **Real-time Ready**: Converted sessions support live data updates

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
| Complex expressions | `expression` property - fully working | ✅ |

## Known Limitations (Tested)

- **JOINs**: Require manual SubSession implementation  
- **Correlated subqueries**: Need manual linking in resolve configurations
- **Filtered SubSessions**: Filter + GroupBy combinations return null in some cases

