/**
 * SQL to Tessio Converter Examples
 * Demonstrates how to convert SQL queries to Tessio session parameters
 */

const { SqlToTessioConverter, sqlToTessio, sqlToTessioExample } = require('../dist/lib/sqlToTessioConverter');
const { EventHorizon } = require('../dist/lib/eventHorizon');

// Initialize EventHorizon
const eventHorizon = new EventHorizon();

console.log('SQL to Tessio Converter Examples\n');

// Example 1: Basic SELECT with WHERE and ORDER BY
const sql1 = `
    SELECT name, department, salary 
    FROM employees 
    WHERE active = true AND salary > 50000 
    ORDER BY salary DESC 
    LIMIT 10
`;

console.log('=== Example 1: Basic Query ===');
console.log(sqlToTessioExample(sql1));

// Example 2: Aggregation with GROUP BY
const sql2 = `
    SELECT department, COUNT(*) as employee_count, AVG(salary) as avg_salary, SUM(bonus) as total_bonus
    FROM employees 
    WHERE active = true 
    GROUP BY department 
    ORDER BY avg_salary DESC
`;

console.log('\n=== Example 2: Aggregation Query ===');
console.log(sqlToTessioExample(sql2));

// Example 3: Complex WHERE conditions
const sql3 = `
    SELECT * 
    FROM transactions 
    WHERE status IN ('completed', 'pending') 
    AND amount BETWEEN 100 AND 5000 
    AND date >= '2023-01-01' 
    ORDER BY date DESC, amount DESC
`;

console.log('\n=== Example 3: Complex Filters ===');
console.log(sqlToTessioExample(sql3));

// Example 4: Computed columns with expressions
const sql4 = `
    SELECT 
        name, 
        salary, 
        bonus,
        salary + bonus AS total_compensation,
        CASE WHEN salary > 75000 THEN 'Senior' ELSE 'Junior' END AS level
    FROM employees 
    WHERE department = 'Engineering'
`;

console.log('\n=== Example 4: Computed Columns ===');
console.log(sqlToTessioExample(sql4));

// Example 5: Practical usage with EventHorizon
async function demonstrateUsage() {
    console.log('\n=== Example 5: Practical Usage ===');
    
    // Create sample employees table
    const employeesTable = eventHorizon.createTesseract('employees', {
        columns: [
            { name: 'id', primaryKey: true },
            { name: 'name', columnType: 'string' },
            { name: 'department', columnType: 'string', secondaryKey: true },
            { name: 'salary', columnType: 'number' },
            { name: 'active', columnType: 'boolean' },
            { name: 'bonus', columnType: 'number' }
        ]
    });

    // Add sample data
    employeesTable.add([
        { id: 1, name: 'Alice Johnson', department: 'Engineering', salary: 85000, active: true, bonus: 8000 },
        { id: 2, name: 'Bob Smith', department: 'Engineering', salary: 75000, active: true, bonus: 5000 },
        { id: 3, name: 'Carol Davis', department: 'Marketing', salary: 65000, active: true, bonus: 3000 },
        { id: 4, name: 'David Wilson', department: 'Sales', salary: 70000, active: false, bonus: 2000 },
        { id: 5, name: 'Eve Brown', department: 'Engineering', salary: 90000, active: true, bonus: 10000 }
    ]);

    // Convert SQL to Tessio and create session
    const sqlQuery = "SELECT name, department, salary FROM employees WHERE active = true AND salary > 70000 ORDER BY salary DESC";
    
    const result = sqlToTessio(sqlQuery);
    console.log('SQL Query:', sqlQuery);
    console.log('\nConverted Tessio Config:');
    console.log(JSON.stringify(result.sessionConfig, null, 2));
    
    // Create session with converted config
    const session = eventHorizon.createSession(result.sessionConfig);
    const data = session.getData();
    
    console.log('\nQuery Results:');
    console.log(data);
    
    if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        result.warnings.forEach(warning => console.log('- ' + warning));
    }
}

// Example 6: Advanced SQL features and limitations
const sql6 = `
    SELECT 
        e.name,
        e.salary,
        d.department_name,
        COUNT(t.id) as transaction_count
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN transactions t ON e.id = t.employee_id
    WHERE e.active = true
    GROUP BY e.id, e.name, e.salary, d.department_name
    HAVING COUNT(t.id) > 5
    ORDER BY transaction_count DESC
    LIMIT 20 OFFSET 10
`;

console.log('\n=== Example 6: Advanced Features ===');
console.log(sqlToTessioExample(sql6));

// Example 7: Batch conversion utility
function convertMultipleQueries() {
    console.log('\n=== Example 7: Batch Conversion ===');
    
    const queries = [
        "SELECT * FROM users WHERE status = 'active'",
        "SELECT category, COUNT(*) FROM products GROUP BY category",
        "SELECT name, email FROM customers ORDER BY created_at DESC LIMIT 50",
        "SELECT AVG(price), MAX(price), MIN(price) FROM products WHERE category = 'electronics'"
    ];
    
    const converter = new SqlToTessioConverter();
    
    queries.forEach((sql, index) => {
        console.log(`\nQuery ${index + 1}: ${sql}`);
        try {
            const result = converter.convertSql(sql);
            console.log('✅ Conversion successful');
            console.log('Session config:', JSON.stringify(result.sessionConfig, null, 2));
            
            if (result.warnings.length > 0) {
                console.log('⚠️  Warnings:', result.warnings);
            }
            if (result.unsupportedFeatures.length > 0) {
                console.log('❌ Unsupported:', result.unsupportedFeatures);
            }
        } catch (error) {
            console.log('❌ Conversion failed:', error.message);
        }
    });
}

// Run examples
if (require.main === module) {
    demonstrateUsage()
        .then(() => {
            convertMultipleQueries();
            // Example 8: Subquery examples
console.log('\n=== Example 8: Subquery Support ===');

// Subquery in SELECT clause
const subqueryInSelect = `
    SELECT 
        u.name, 
        u.email,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) as order_count
    FROM users u
    WHERE u.active = true
`;

console.log('Subquery in SELECT clause:');
console.log(sqlToTessioExample(subqueryInSelect));

// Subquery in WHERE with IN
const subqueryInWhere = `
    SELECT name, email 
    FROM users 
    WHERE id IN (
        SELECT user_id 
        FROM orders 
        WHERE total > 100 AND status = 'completed'
    )
`;

console.log('\nSubquery in WHERE with IN:');
console.log(sqlToTessioExample(subqueryInWhere));

// EXISTS subquery
const existsSubquery = `
    SELECT u.name, u.email
    FROM users u
    WHERE EXISTS (
        SELECT 1 
        FROM orders o 
        WHERE o.user_id = u.id AND o.status = 'pending'
    )
`;

console.log('\nEXISTS subquery:');
console.log(sqlToTessioExample(existsSubquery));

// Subquery in FROM clause
const subqueryInFrom = `
    SELECT 
        user_stats.user_id,
        user_stats.total_orders,
        u.name
    FROM (
        SELECT user_id, COUNT(*) as total_orders
        FROM orders 
        WHERE status = 'completed'
        GROUP BY user_id
    ) user_stats
    JOIN users u ON user_stats.user_id = u.id
`;

console.log('\nSubquery in FROM clause:');
console.log(sqlToTessioExample(subqueryInFrom));

// Nested subqueries
const nestedSubqueries = `
    SELECT name FROM users 
    WHERE id IN (
        SELECT user_id FROM orders 
        WHERE product_id IN (
            SELECT id FROM products 
            WHERE category_id IN (
                SELECT id FROM categories WHERE name = 'Electronics'
            )
        )
    )
`;

console.log('\nNested subqueries:');
console.log(sqlToTessioExample(nestedSubqueries));

console.log('\n🎉 All examples completed!');
        })
        .catch(console.error);
}

module.exports = {
    demonstrateUsage,
    convertMultipleQueries
};
