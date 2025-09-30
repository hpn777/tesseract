const test = require('tape');
import { Test } from 'tape';
import { SqlToTessioConverter, sqlToTessio, sqlToTessioExample, SqlParseResult } from '../src/lib/sqlToTessioConverter';

test('SQL to Tessio Converter - Basic SELECT queries', function (t: Test) {
    const converter = new SqlToTessioConverter();

    // Test 1: Simple SELECT with WHERE
    const sql1 = "SELECT name, email FROM users WHERE active = true";
    const result1 = converter.convertSql(sql1);
    
    t.equal(result1.sessionConfig.table, 'users', 'Table name extracted correctly');
    t.ok(result1.sessionConfig.columns, 'Columns array exists');
    t.equal(result1.sessionConfig.columns!.length, 2, 'Column count correct');
    t.equal(result1.sessionConfig.columns![0].name, 'name', 'First column name correct');
    t.equal(result1.sessionConfig.columns![1].name, 'email', 'Second column name correct');
    t.ok(result1.sessionConfig.filter, 'Filter array exists');
    t.equal(result1.sessionConfig.filter!.length, 1, 'Filter count correct');
    t.equal(result1.sessionConfig.filter![0].field, 'active', 'Filter field correct');
    t.equal(result1.sessionConfig.filter![0].comparison, '==', 'Filter comparison correct');
    t.equal(result1.sessionConfig.filter![0].value, true, 'Filter value correct');

    // Test 2: SELECT * (all columns)
    const sql2 = "SELECT * FROM products";
    const result2 = converter.convertSql(sql2);
    
    t.equal(result2.sessionConfig.table, 'products', 'Table name correct for SELECT *');
    t.ok(result2.sessionConfig.columns, 'Columns array exists for SELECT *');
    t.equal(result2.sessionConfig.columns!.length, 0, 'Empty columns array for SELECT *');

    // Test 3: ORDER BY
    const sql3 = "SELECT name FROM users ORDER BY created_at DESC, name ASC";
    const result3 = converter.convertSql(sql3);
    
    t.ok(result3.sessionConfig.sort, 'Sort array exists');
    t.equal(result3.sessionConfig.sort!.length, 2, 'Sort count correct');
    t.equal(result3.sessionConfig.sort![0].field, 'created_at', 'First sort field correct');
    t.equal(result3.sessionConfig.sort![0].direction, 'desc', 'First sort direction correct');
    t.equal(result3.sessionConfig.sort![1].field, 'name', 'Second sort field correct');
    t.equal(result3.sessionConfig.sort![1].direction, 'asc', 'Second sort direction correct');

    t.end();
});

test('SQL to Tessio Converter - WHERE clause parsing', function (t: Test) {
    const converter = new SqlToTessioConverter();

    // Test different comparison operators
    const testCases = [
        { sql: "WHERE age > 25", expected: { field: 'age', comparison: '>', value: 25 } },
        { sql: "WHERE age >= 18", expected: { field: 'age', comparison: '>=', value: 18 } },
        { sql: "WHERE age < 65", expected: { field: 'age', comparison: '<', value: 65 } },
        { sql: "WHERE age <= 30", expected: { field: 'age', comparison: '<=', value: 30 } },
        { sql: "WHERE name = 'John'", expected: { field: 'name', comparison: '==', value: 'John' } },
        { sql: "WHERE active != true", expected: { field: 'active', comparison: '!=', value: true } },
        { sql: "WHERE category IN ('A', 'B')", expected: { field: 'category', comparison: 'in', value: ['A', 'B'] } },
        { sql: "WHERE name LIKE 'John%'", expected: { field: 'name', comparison: 'like', value: 'John%' } }
    ];

    testCases.forEach((testCase, index) => {
        const sql = `SELECT * FROM test ${testCase.sql}`;
        const result = converter.convertSql(sql);
        
        t.ok(result.sessionConfig.filter, `Test ${index + 1}: Filter array exists`);
        t.equal(result.sessionConfig.filter!.length, 1, `Test ${index + 1}: Filter count correct`);
        t.equal(result.sessionConfig.filter![0].field, testCase.expected.field, `Test ${index + 1}: Field correct`);
        t.equal(result.sessionConfig.filter![0].comparison, testCase.expected.comparison, `Test ${index + 1}: Comparison correct`);
        t.deepEqual(result.sessionConfig.filter![0].value, testCase.expected.value, `Test ${index + 1}: Value correct`);
    });

    // Test multiple WHERE conditions
    const sqlMultiple = "SELECT * FROM users WHERE age > 18 AND active = true AND department = 'IT'";
    const resultMultiple = converter.convertSql(sqlMultiple);
    
    t.ok(resultMultiple.sessionConfig.filter, 'Multiple filters array exists');
    t.equal(resultMultiple.sessionConfig.filter!.length, 3, 'Multiple filters parsed correctly');
    t.equal(resultMultiple.sessionConfig.filter![0].field, 'age', 'First filter field correct');
    t.equal(resultMultiple.sessionConfig.filter![1].field, 'active', 'Second filter field correct');
    t.equal(resultMultiple.sessionConfig.filter![2].field, 'department', 'Third filter field correct');

    t.end();
});

test('SQL to Tessio Converter - Aggregation queries', function (t: Test) {
    const converter = new SqlToTessioConverter();

    // Test GROUP BY with aggregation functions
    const sql = `
        SELECT department, COUNT(*) as employee_count, AVG(salary) as avg_salary, SUM(bonus) as total_bonus
        FROM employees 
        WHERE active = true 
        GROUP BY department 
        ORDER BY avg_salary DESC
    `;

    const result = converter.convertSql(sql);
    
    t.equal(result.sessionConfig.table, 'employees', 'Table name correct');
    t.ok(result.sessionConfig.groupBy, 'GroupBy array exists');
    t.equal(result.sessionConfig.groupBy!.length, 1, 'Group by count correct');
    t.equal(result.sessionConfig.groupBy![0].dataIndex, 'department', 'Group by field correct');
    
    // Check aggregation columns
    const columns = result.sessionConfig.columns;
    t.ok(columns, 'Columns array exists');
    const countColumn = columns!.find(col => col.name === 'employee_count');
    const avgColumn = columns!.find(col => col.name === 'avg_salary');
    const sumColumn = columns!.find(col => col.name === 'total_bonus');
    
    t.ok(countColumn, 'COUNT column exists');
    t.equal(countColumn!.aggregator, 'count', 'COUNT aggregator correct');
    
    t.ok(avgColumn, 'AVG column exists');
    t.equal(avgColumn!.aggregator, 'avg', 'AVG aggregator correct');
    
    t.ok(sumColumn, 'SUM column exists');
    t.equal(sumColumn!.aggregator, 'sum', 'SUM aggregator correct');

    t.end();
});

test('SQL to Tessio Converter - LIMIT and OFFSET', function (t: Test) {
    const converter = new SqlToTessioConverter();

    // Test LIMIT only
    const sql1 = "SELECT * FROM users LIMIT 10";
    const result1 = converter.convertSql(sql1);
    
    t.equal(result1.sessionConfig.limit, 10, 'LIMIT parsed correctly');
    t.notOk(result1.sessionConfig.offset, 'No OFFSET when not specified');

    // Test LIMIT with OFFSET
    const sql2 = "SELECT * FROM users LIMIT 20 OFFSET 5";
    const result2 = converter.convertSql(sql2);
    
    t.equal(result2.sessionConfig.limit, 20, 'LIMIT with OFFSET parsed correctly');
    t.equal(result2.sessionConfig.offset, 5, 'OFFSET parsed correctly');

    t.end();
});

test('SQL to Tessio Converter - Expression columns', function (t: Test) {
    const converter = new SqlToTessioConverter();

    const sql = `
        SELECT 
            name,
            salary + bonus AS total_compensation,
            age > 30 AS is_senior
        FROM employees
    `;

    const result = converter.convertSql(sql);
    
    const columns = result.sessionConfig.columns;
    t.ok(columns, 'Columns array exists');
    t.equal(columns!.length, 3, 'Column count correct');
    
    const nameColumn = columns!.find(col => col.name === 'name');
    const totalCompColumn = columns!.find(col => col.name === 'total_compensation');
    const seniorColumn = columns!.find(col => col.name === 'is_senior');
    
    t.ok(nameColumn, 'Simple column exists');
    t.notOk(nameColumn!.expression, 'Simple column has no expression');
    
    t.ok(totalCompColumn, 'Expression column exists');
    t.ok(totalCompColumn!.expression, 'Expression column has expression');
    t.equal(totalCompColumn!.expression, 'salary + bonus', 'Expression content correct');
    
    t.ok(seniorColumn, 'Boolean expression column exists');
    t.ok(seniorColumn!.expression, 'Boolean expression column has expression');

    // Should have warnings about expression columns
    t.ok(result.warnings.length > 0, 'Warnings generated for expression columns');

    t.end();
});

test('SQL to Tessio Converter - Error handling', function (t: Test) {
    const converter = new SqlToTessioConverter();

    // Test invalid SQL
    t.throws(() => {
        converter.convertSql("INVALID SQL QUERY");
    }, /Invalid SQL/, 'Throws error for invalid SQL');

    // Test empty SQL
    t.throws(() => {
        converter.convertSql("");
    }, /Invalid SQL/, 'Throws error for empty SQL');

    // Test SQL without FROM
    t.throws(() => {
        converter.convertSql("SELECT name");
    }, /Invalid SQL/, 'Throws error for SQL without FROM');

    t.end();
});

test('SQL to Tessio Converter - Complex scenarios', function (t: Test) {
    const converter = new SqlToTessioConverter();

    // Test complex query with multiple features
    const complexSql = `
        SELECT 
            e.name,
            e.department,
            COUNT(*) as project_count,
            AVG(p.budget) as avg_budget,
            e.salary + e.bonus AS total_comp
        FROM employees e
        LEFT JOIN projects p ON e.id = p.employee_id
        WHERE e.active = true 
        AND e.salary > 50000
        AND p.status IN ('active', 'completed')
        GROUP BY e.id, e.name, e.department, e.salary, e.bonus
        ORDER BY project_count DESC, avg_budget ASC
        LIMIT 25 OFFSET 10
    `;

    const result = converter.convertSql(complexSql);
    
    // Should extract main table
    t.equal(result.sessionConfig.table, 'employees', 'Main table extracted from complex query');
    
    // Should have filters
    t.ok(result.sessionConfig.filter && result.sessionConfig.filter.length > 0, 'Filters extracted');
    
    // Should have sorting
    t.ok(result.sessionConfig.sort && result.sessionConfig.sort.length > 0, 'Sorting extracted');
    
    // Should have grouping
    t.ok(result.sessionConfig.groupBy && result.sessionConfig.groupBy.length > 0, 'Grouping extracted');
    
    // Should have limit and offset
    t.equal(result.sessionConfig.limit, 25, 'Limit extracted from complex query');
    t.equal(result.sessionConfig.offset, 10, 'Offset extracted from complex query');
    
    // Should have warnings for JOINs
    t.ok(result.warnings.some(w => w.includes('JOIN')), 'JOIN warnings generated');
    
    // Should have unsupported features
    t.ok(result.unsupportedFeatures.length > 0 || result.warnings.length > 0, 'Complex features flagged');

    t.end();
});

test('SQL to Tessio Converter - Subquery support', function (t: Test) {
    const converter = new SqlToTessioConverter();

    // Test subquery in SELECT clause
    const sql1 = `
        SELECT 
            name, 
            (SELECT COUNT(*) FROM orders WHERE orders.user_id = users.id) as order_count
        FROM users
    `;
    const result1 = converter.convertSql(sql1);
    
    t.equal(result1.sessionConfig.table, 'users', 'Main table extracted with subquery');
    t.ok(result1.sessionConfig.columns, 'Columns array exists for subquery test');
    t.ok(result1.sessionConfig.columns!.some(col => col.resolve), 'Subquery converted to resolve configuration');
    t.ok(result1.sessionConfig.subSessions, 'SubSessions created for subquery');

    // Test subquery in WHERE with IN
    const sql2 = `
        SELECT name FROM users 
        WHERE id IN (SELECT user_id FROM orders WHERE total > 100)
    `;
    const result2 = converter.convertSql(sql2);
    
    t.equal(result2.sessionConfig.table, 'users', 'Table correct with IN subquery');
    t.ok(result2.sessionConfig.subSessions, 'SubSessions created for IN subquery');

    // Test EXISTS subquery
    const sql3 = `
        SELECT name FROM users 
        WHERE EXISTS (SELECT 1 FROM orders WHERE orders.user_id = users.id)
    `;
    const result3 = converter.convertSql(sql3);
    
    t.ok(result3.sessionConfig.subSessions, 'SubSessions created for EXISTS subquery');
    t.ok(result3.warnings.some(w => w.includes('SubSession')), 'EXISTS subquery converted to SubSession');

    // Test subquery in FROM clause
    const sql4 = `
        SELECT u.name, u.total_orders
        FROM (SELECT user_id, COUNT(*) as total_orders FROM orders GROUP BY user_id) u
    `;
    const result4 = converter.convertSql(sql4);
    
    t.ok(typeof result4.sessionConfig.table === 'object', 'Subquery in FROM converted to nested session');
    t.ok(result4.warnings.some(w => w.includes('subquery')), 'FROM subquery warning generated');

    t.end();
});

test('SQL to Tessio Converter - Complex subqueries', function (t: Test) {
    const converter = new SqlToTessioConverter();

    // Test nested subqueries
    const sql1 = `
        SELECT name FROM users 
        WHERE id IN (
            SELECT user_id FROM orders 
            WHERE product_id IN (SELECT id FROM products WHERE category = 'electronics')
        )
    `;
    const result1 = converter.convertSql(sql1);
    
    t.ok(result1.sessionConfig.subSessions, 'SubSessions created for nested subqueries');
    t.ok(result1.sessionConfig.subSessions && Object.keys(result1.sessionConfig.subSessions).length > 0, 'Multiple SubSessions generated');

    // Test scalar subquery
    const sql2 = `
        SELECT 
            name,
            salary,
            (SELECT AVG(salary) FROM employees) as avg_salary
        FROM employees 
        WHERE department = 'IT'
    `;
    const result2 = converter.convertSql(sql2);
    
    t.ok(result2.sessionConfig.columns, 'Columns array exists for scalar subquery test');
    const avgSalaryColumn = result2.sessionConfig.columns!.find(col => col.name === 'avg_salary');
    t.ok(avgSalaryColumn, 'Scalar subquery column exists');
    t.ok(avgSalaryColumn!.resolve, 'Scalar subquery has resolve configuration');

    t.end();
});

test('SQL to Tessio Converter - Utility functions', function (t: Test) {
    // Test sqlToTessio utility function
    const sql = "SELECT name, age FROM users WHERE age > 21 ORDER BY name";
    const result = sqlToTessio(sql);
    
    t.ok(result.sessionConfig, 'sqlToTessio returns session config');
    t.ok(Array.isArray(result.warnings), 'sqlToTessio returns warnings array');
    t.ok(Array.isArray(result.unsupportedFeatures), 'sqlToTessio returns unsupported features array');

    // Test sqlToTessioExample utility function
    const example = sqlToTessioExample(sql);
    t.ok(typeof example === 'string', 'sqlToTessioExample returns string');
    t.ok(example.includes('Original SQL'), 'Example includes original SQL');
    t.ok(example.includes('Converted to Tessio'), 'Example includes conversion');
    t.ok(example.includes('createSession'), 'Example includes session creation');

    t.end();
});

console.log('SQL to Tessio Converter tests loaded...');
