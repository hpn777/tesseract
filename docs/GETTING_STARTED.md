# Getting Started with Tesseract

Tesseract is a powerful in-memory analytics engine for Node.js that provides flexible data processing, querying, and real-time analytics capabilities with optional distributed synchronization via Redis.

## Installation

```bash
npm install
```

## Quick Start

### Basic Usage

```javascript
// For npm package usage:
// const { Tesseract, EventHorizon } = require('tessio');

// For local development:
const { Tesseract, EventHorizon } = require('./index');

// Create an EventHorizon instance (data manager)
const eventHorizon = new EventHorizon();

// Define table structure
const userTableOptions = {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'age', type: 'number' },
        { name: 'department', type: 'string' },
        { name: 'salary', type: 'number' },
        { name: 'active', type: 'boolean' }
    ]
};

// Create a Tesseract table
const userTable = eventHorizon.createTesseract('users', userTableOptions);

// Add data
userTable.add([
    { id: 1, name: 'Alice Johnson', email: 'alice@company.com', age: 28, department: 'Engineering', salary: 75000, active: true },
    { id: 2, name: 'Bob Smith', email: 'bob@company.com', age: 35, department: 'Marketing', salary: 65000, active: true },
    { id: 3, name: 'Carol Davis', email: 'carol@company.com', age: 31, department: 'Engineering', salary: 80000, active: false },
    { id: 4, name: 'David Wilson', email: 'david@company.com', age: 42, department: 'Sales', salary: 70000, active: true }
]);

// Query data
console.log('All users:', userTable.getData());
console.log('User by ID:', userTable.getById(1));
console.log('Total users:', userTable.getCount());
```

### Creating Sessions for Advanced Queries

```javascript
// Create a session with filtering and sorting
const activeUsersSession = eventHorizon.createSession({
    id: 'active-users',
    table: 'users',
    columns: [
        { name: 'id' },
        { name: 'name' },
        { name: 'department' },
        { name: 'salary' }
    ],
    filter: [
        { field: 'active', comparison: '==', value: true }
    ],
    sort: [
        { field: 'salary', direction: 'desc' }
    ]
});

console.log('Active users (sorted by salary):', activeUsersSession.getData());
```

### Computed Columns

```javascript
const userTableWithComputed = eventHorizon.createTesseract('users_computed', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'firstName', type: 'string' },
        { name: 'lastName', type: 'string' },
        { name: 'salary', type: 'number' },
        { 
            name: 'fullName', 
            value: (row) => `${row.firstName} ${row.lastName}` 
        },
        { 
            name: 'salaryGrade', 
            value: (row) => row.salary > 70000 ? 'Senior' : 'Junior' 
        }
    ]
});

userTableWithComputed.add([
    { id: 1, firstName: 'Alice', lastName: 'Johnson', salary: 75000 },
    { id: 2, firstName: 'Bob', lastName: 'Smith', salary: 65000 }
]);

console.log('Users with computed columns:', userTableWithComputed.getData());
```

### Real-time Event Handling

```javascript
// Listen for data changes
userTable.on('dataUpdate', (updatedRows) => {
    console.log('Data updated:', updatedRows.length, 'rows affected');
});

userTable.on('dataRemove', (removedIds) => {
    console.log('Data removed:', removedIds.length, 'rows removed');
});

// Add new data (will trigger events)
userTable.add({ id: 5, name: 'Eve Brown', email: 'eve@company.com', age: 29, department: 'HR', salary: 60000, active: true });

// Update existing data
userTable.update({ id: 1, salary: 80000 });

// Remove data
userTable.remove([2]);
```

## Next Steps

- [Basic Operations](BASIC_OPERATIONS.md) - Learn CRUD operations and data manipulation
- [Advanced Queries](ADVANCED_QUERIES.md) - Filtering, sorting, grouping, and aggregation
- [Distributed Setup](DISTRIBUTED_SETUP.md) - Setting up Redis clustering and synchronization
- [API Reference](../API_DOCUMENTATION.md) - Complete API documentation
