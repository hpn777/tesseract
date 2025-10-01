# Tesseract (Tessio)

[![Version](https://img.shields.io/badge/version-3.2.13-blue.svg)](https://github.com/hpn777/tesseract)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://www.typescriptlang.org/)

**Tesseract** is a powerful in-memory analytics engine for Node.js that provides flexible data processing, querying, and real-time analytics capabilities with optional distributed synchronization via Redis. It features advanced querying, aggregations, SubSessions for relational data, and includes a comprehensive SQL-to-Tessio converter.

## 🚀 Features

- **🔍 Advanced Analytics Engine**: In-memory data processing with complex querying capabilities
- **🔗 Relational Data Support**: SubSessions for handling relationships between datasets
- **📊 Real-time Analytics**: Event-driven data updates with live query results
- **🌐 Distributed Architecture**: Redis-based cluster synchronization for multi-node deployments
- **🛠️ SQL Converter**: Convert SQL queries to Tessio session parameters with subquery support and automatic WHERE + GROUP BY optimization
- **⚡ High Performance**: Optimized for large datasets with efficient memory usage
- **📈 Aggregations & GroupBy**: Multi-level grouping with various aggregation functions
- **🎯 Expression Engine**: Fully functional support for custom expressions, calculated fields, and complex parentheses operations
- **🔄 Real-time Updates**: Automatic query result updates when data changes

## 📦 Installation

```bash
npm install tessio
```

## 🎯 Quick Start

### Basic Usage

```typescript
import { EventHorizon, Tesseract } from 'tessio';

// Create EventHorizon instance (data manager)
const eventHorizon = new EventHorizon();

// Define table structure
const userTableOptions = {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'name', columnType: 'string' },
        { name: 'email', columnType: 'string' },
        { name: 'age', columnType: 'number' },
        { name: 'department', columnType: 'string' },
        { name: 'salary', columnType: 'number' }
    ]
};

// Create tesseract (table) for users
const userTesseract = eventHorizon.createTesseract('users', userTableOptions);

// Add sample data
userTesseract.add([
    { id: 1, name: 'Alice', email: 'alice@company.com', age: 30, department: 'Engineering', salary: 75000 },
    { id: 2, name: 'Bob', email: 'bob@company.com', age: 25, department: 'Sales', salary: 55000 },
    { id: 3, name: 'Carol', email: 'carol@company.com', age: 35, department: 'Engineering', salary: 85000 }
]);

// Create a session for querying
const session = eventHorizon.createSession({
    table: 'users',
    columns: [
        { name: 'name' },
        { name: 'department' },
        { name: 'salary' }
    ],
    filter: [
        { field: 'department', comparison: '==', value: 'Engineering' }
    ],
    sort: [
        { field: 'salary', direction: 'desc' }
    ]
});

// Get results
const results = session.getDataSnapshot();
console.log(results); // Engineering employees sorted by salary
```

### SQL Converter Usage

```typescript
import { sqlToTessio, SqlToTessioConverter } from 'tessio';

// Convert SQL to Tessio session parameters
const sql = `
    SELECT name, department, salary 
    FROM employees 
    WHERE department = 'Engineering' AND salary > 50000 
    ORDER BY salary DESC 
    LIMIT 10
`;

const result = sqlToTessio(sql);
console.log(result.sessionConfig);

// Create session from SQL
const session = eventHorizon.createSession(result.sessionConfig);

// ✅ NEW: WHERE + GROUP BY combinations now work correctly
const complexSql = `
    SELECT department, COUNT(*) as count, AVG(salary) as avg_salary
    FROM employees 
    WHERE salary > 50000 AND active = true
    GROUP BY department 
    HAVING count > 5
`;

const complexResult = sqlToTessio(complexSql);
// Automatically uses nested table structure for proper filter + aggregation
const complexSession = eventHorizon.createSession(complexResult.sessionConfig);
```

## 📋 Core Concepts

### 1. EventHorizon
The main data management hub that creates and manages Tesseracts (tables) and Sessions (queries).

### 2. Tesseract
A data table that holds your dataset with defined columns and types. Supports CRUD operations and real-time updates.

### 3. Session
A query configuration that defines what data to retrieve, how to filter it, sort it, and aggregate it. Sessions provide live results that update automatically.

### 4. SubSessions
Enable relational data queries by joining multiple Tesseracts, similar to SQL JOINs but with real-time capabilities.

## 🔧 Advanced Features

### Aggregations and GroupBy

```typescript
const salesSession = eventHorizon.createSession({
    table: 'transactions',
    columns: [
        { name: 'region' },
        { name: 'total_sales', aggregator: 'sum', dataIndex: 'amount' },
        { name: 'avg_sale', aggregator: 'avg', dataIndex: 'amount' },
        { name: 'transaction_count', aggregator: 'count' }
    ],
    groupBy: [
        { dataIndex: 'region' }
    ],
    sort: [
        { field: 'total_sales', direction: 'desc' }
    ]
});
```

### SubSessions (Relational Queries)

```typescript
const userOrdersSession = eventHorizon.createSession({
    table: 'users',
    columns: [
        { name: 'name' },
        { name: 'email' },
        { 
            name: 'order_count',
            resolve: {
                underlyingField: 'id',
                session: {
                    table: 'orders',
                    columns: [{ name: 'count', aggregator: 'count' }],
                    filter: [{ field: 'user_id', comparison: '==', value: '${id}' }]
                },
                valueField: 'count',
                displayField: 'count'
            }
        }
    ]
});
```

### SQL Query Conversion

```typescript
// Complex SQL with subqueries
const complexSQL = `
    SELECT 
        u.name,
        u.email,
        (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count,
        (SELECT AVG(amount) FROM orders WHERE user_id = u.id) as avg_order_value
    FROM users u
    WHERE u.active = true 
    AND EXISTS (SELECT 1 FROM orders WHERE user_id = u.id AND status = 'completed')
    ORDER BY order_count DESC
    LIMIT 50
`;

const converted = sqlToTessio(complexSQL);
const session = eventHorizon.createSession(converted.sessionConfig);
```

## 🌐 Distributed Setup

Enable Redis-based clustering for multi-node deployments:

```typescript
import { EventHorizon, ClusterRedis } from 'tessio';

const cluster = new ClusterRedis({
    redis: {
        host: 'localhost',
        port: 6379
    },
    nodeId: 'node-1'
});

const eventHorizon = new EventHorizon({ cluster });
```

## 🛠️ CLI Tools

### SQL to Tessio Converter CLI

```bash
# Convert single SQL query
npx sql-to-tessio "SELECT name FROM users WHERE age > 25"

# Convert from file
npx sql-to-tessio --file queries.sql

# Batch conversion with output
npx sql-to-tessio --batch --input queries/ --output converted/
```

## 📊 Performance

Tesseract is optimized for high-performance analytics:

- **Memory Efficient**: Smart data structures for large datasets
- **Fast Queries**: Indexed filtering and sorting
- **Real-time Updates**: Incremental result updates
- **Batch Operations**: Efficient bulk data processing

Performance benchmarks show handling of:
- 100,000+ records with sub-millisecond query times
- Complex aggregations across multiple dimensions
- Real-time updates at 90,000+ operations/second

## 🧪 Testing

```bash
# Run all tests
npm test

# Run SQL converter tests only
npm run test:sql-converter

# Run performance benchmarks
npm run test:perf

# Run with Docker
npm run test:docker
```

## 📚 Documentation

- **[Getting Started](docs/GETTING_STARTED.md)** - Basic setup and usage
- **[API Documentation](docs/API_DOCUMENTATION.md)** - Complete API reference
- **[Advanced Queries](docs/ADVANCED_QUERIES.md)** - Complex query patterns
- **[SubSessions Guide](docs/SUBSESSIONS_AND_GROUPBY.md)** - Relational data handling
- **[SQL Converter](docs/SQL_TO_TESSIO_CONVERTER.md)** - Complete SQL migration guide with WHERE + GROUP BY fix
- **[Distributed Setup](docs/DISTRIBUTED_SETUP.md)** - Clustering configuration
- **[Migration Guide](docs/MIGRATION_GUIDE.md)** - Upgrading from previous versions

## 🤝 Examples

Check out the `/examples` directory for comprehensive usage examples:

- Basic CRUD operations
- Advanced aggregations
- SQL query conversions
- Real-time data processing
- Distributed setups

## 🔧 Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Watch mode for development
npm run build:watch

# Build browser version
npm run build:browser

# Run tests
npm test
```

## 📋 Requirements

- Node.js 14+ (TypeScript 4.9+)
- Optional: Redis for distributed features

## 🐛 Known Limitations

- **Real-time Updates**: Limited in compiled dist version compared to source version

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

Copyright (c) 2019 Rafal Okninski

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📈 Roadmap

- [x] **Enhanced SQL compatibility** - WHERE + GROUP BY architectural fix completed ✅
- [ ] Performance optimizations for very large datasets
- [ ] GraphQL integration
- [ ] Enhanced real-time capabilities
- [ ] More aggregation functions
- [ ] Improved distributed synchronization

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/hpn777/tesseract/issues)
- **Discussions**: [GitHub Discussions](https://github.com/hpn777/tesseract/discussions)
- **Email**: hpn777@gmail.com

---

**Made with by [Rafal Okninski](https://github.com/hpn777)**
