# Advanced Queries Guide

This guide covers advanced querying capabilities including sessions, filtering, sorting, grouping, and aggregation.

## Table of Contents
- [Sessions Overview](#sessions-overview)
- [Filtering](#filtering)
- [Sorting](#sorting)
- [Grouping and Aggregation](#grouping-and-aggregation)
- [Pagination](#pagination)
- [Complex Queries](#complex-queries)
- [Joins and Relationships](#joins-and-relationships)

## Sessions Overview

Sessions are the primary way to perform advanced queries in Tesseract. They provide a filtered, sorted, and aggregated view of your data.

### Basic Session Creation

```javascript
const { EventHorizon } = require('../index');
const eventHorizon = new EventHorizon();

// Create sample data
const salesTable = eventHorizon.createTesseract('sales', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'salesPersonId', type: 'number', secondaryKey: true },
        { name: 'customerId', type: 'number', secondaryKey: true },
        { name: 'productId', type: 'number' },
        { name: 'amount', type: 'number' },
        { name: 'quantity', type: 'number' },
        { name: 'date', type: 'date' },
        { name: 'region', type: 'string' }
    ]
});

// Add sample sales data
salesTable.add([
    { id: 1, salesPersonId: 101, customerId: 201, productId: 301, amount: 1500, quantity: 3, date: new Date('2023-01-15'), region: 'North' },
    { id: 2, salesPersonId: 102, customerId: 202, productId: 302, amount: 2200, quantity: 2, date: new Date('2023-01-20'), region: 'South' },
    { id: 3, salesPersonId: 101, customerId: 203, productId: 301, amount: 800, quantity: 2, date: new Date('2023-02-10'), region: 'North' },
    { id: 4, salesPersonId: 103, customerId: 204, productId: 303, amount: 3200, quantity: 1, date: new Date('2023-02-15'), region: 'West' },
    { id: 5, salesPersonId: 102, customerId: 205, productId: 302, amount: 1800, quantity: 4, date: new Date('2023-03-01'), region: 'South' }
]);
```

## Filtering

### Simple Filters

```javascript
// Filter by single field
const highValueSalesSession = eventHorizon.createSession({
    id: 'high-value-sales',
    table: 'sales',
    filter: [
        { field: 'amount', comparison: '>', value: 2000 }
    ]
});

console.log('High value sales:', highValueSalesSession.getData());
```

### Multiple Filters (AND logic)

```javascript
// Multiple filters are combined with AND logic
const northernHighSalesSession = eventHorizon.createSession({
    id: 'northern-high-sales',
    table: 'sales',
    filter: [
        { field: 'region', comparison: '==', value: 'North' },
        { field: 'amount', comparison: '>=', value: 1000 }
    ]
});

console.log('Northern high value sales:', northernHighSalesSession.getData());
```

### Date Filters

```javascript
// Filter by date range
const recentSalesSession = eventHorizon.createSession({
    id: 'recent-sales',
    table: 'sales',
    filter: [
        { field: 'date', comparison: '>=', value: new Date('2023-02-01'), type: 'date' },
        { field: 'date', comparison: '<=', value: new Date('2023-02-28'), type: 'date' }
    ]
});

console.log('February sales:', recentSalesSession.getData());
```

### Custom Expression Filters

```javascript
// Use custom expressions for complex logic
const customFilterSession = eventHorizon.createSession({
    id: 'custom-filter',
    table: 'sales',
    filter: [
        { 
            type: 'custom', 
            value: 'amount > 1500 && (region == "North" || region == "South")'
        }
    ]
});

console.log('Custom filtered sales:', customFilterSession.getData());
```

### Array/List Filters

```javascript
// Filter using 'in' operator
const specificRegionsSession = eventHorizon.createSession({
    id: 'specific-regions',
    table: 'sales',
    filter: [
        { field: 'region', comparison: 'in', value: ['North', 'West'] }
    ]
});

console.log('North and West sales:', specificRegionsSession.getData());
```

## Sorting

### Single Field Sorting

```javascript
// Sort by amount (descending)
const salesByAmountSession = eventHorizon.createSession({
    id: 'sales-by-amount',
    table: 'sales',
    sort: [
        { field: 'amount', direction: 'desc' }
    ]
});

console.log('Sales sorted by amount:', salesByAmountSession.getData());
```

### Multi-Field Sorting

```javascript
// Sort by region (ascending), then by amount (descending)
const salesMultiSortSession = eventHorizon.createSession({
    id: 'sales-multi-sort',
    table: 'sales',
    sort: [
        { field: 'region', direction: 'asc' },
        { field: 'amount', direction: 'desc' }
    ]
});

console.log('Sales sorted by region and amount:', salesMultiSortSession.getData());
```

### Dynamic Sorting

```javascript
// Change sorting dynamically
const dynamicSession = eventHorizon.createSession({
    id: 'dynamic-sorting',
    table: 'sales'
});

// Get data with default sorting
console.log('Default order:', dynamicSession.getData());

// Apply new sorting
const sortedData = dynamicSession.getData({
    sort: [{ field: 'date', direction: 'desc' }]
});

console.log('Sorted by date:', sortedData);
```

## Grouping and Aggregation

### Basic Grouping

```javascript
// Group sales by region with aggregation
const salesByRegionSession = eventHorizon.createSession({
    id: 'sales-by-region',
    table: 'sales',
    columns: [
        { name: 'region', primaryKey: true },
        { name: 'totalAmount', value: 0, aggregator: 'sum' },
        { name: 'avgAmount', value: 0, aggregator: 'avg' },
        { name: 'maxAmount', value: 0, aggregator: 'max' },
        { name: 'minAmount', value: 0, aggregator: 'min' },
        { name: 'salesCount', value: 1, aggregator: 'sum' }
    ],
    groupBy: [{ dataIndex: 'region' }]
});

// Get aggregated data
const regionAggregates = salesByRegionSession.groupData();
console.log('Sales by region:', regionAggregates);
```

### Multi-Level Grouping

```javascript
// Group by region, then by sales person
const hierarchicalSession = eventHorizon.createSession({
    id: 'hierarchical-sales',
    table: 'sales',
    columns: [
        { name: 'region' },
        { name: 'salesPersonId' },
        { name: 'totalAmount', aggregator: 'sum' },
        { name: 'salesCount', value: 1, aggregator: 'sum' }
    ],
    groupBy: [
        { dataIndex: 'region' },
        { dataIndex: 'salesPersonId' }
    ]
});

const hierarchicalData = hierarchicalSession.groupData(null, true); // includeLeafs = true
console.log('Hierarchical sales data:', JSON.stringify(hierarchicalData, null, 2));
```

### Custom Aggregators

```javascript
// Create session with custom aggregator
const customAggregatorSession = eventHorizon.createSession({
    id: 'custom-aggregator',
    table: 'sales',
    columns: [
        { name: 'region', primaryKey: true },
        { 
            name: 'avgOrderValue', 
            aggregator: (data, objWrapper, columnName) => {
                const totalAmount = data.reduce((sum, row) => sum + objWrapper.setData(row).amount, 0);
                const totalQuantity = data.reduce((sum, row) => sum + objWrapper.setData(row).quantity, 0);
                return totalQuantity > 0 ? (totalAmount / totalQuantity).toFixed(2) : 0;
            }
        },
        { name: 'salesCount', value: 1, aggregator: 'sum' }
    ],
    groupBy: [{ dataIndex: 'region' }]
});

const customAggregated = customAggregatorSession.groupData();
console.log('Custom aggregated data:', customAggregated);
```

## Pagination

### Basic Pagination

```javascript
// Create paginated session
const paginatedSession = eventHorizon.createSession({
    id: 'paginated-sales',
    table: 'sales',
    sort: [{ field: 'date', direction: 'desc' }]
});

// Get first page (2 items per page)
const page1 = paginatedSession.getData({
    start: 0,
    limit: 2
});

// Get second page
const page2 = paginatedSession.getData({
    start: 2,
    limit: 2
});

console.log('Page 1:', page1);
console.log('Page 2:', page2);
console.log('Total count:', paginatedSession.getCount());
```

### Advanced Pagination with Filtering

```javascript
// Paginated session with filters
const filteredPaginatedSession = eventHorizon.createSession({
    id: 'filtered-paginated',
    table: 'sales',
    filter: [
        { field: 'amount', comparison: '>', value: 1000 }
    ],
    sort: [{ field: 'amount', direction: 'desc' }]
});

// Paginated results
const paginatedResults = filteredPaginatedSession.getData({
    start: 0,
    limit: 3
});

console.log('Filtered and paginated:', paginatedResults);
console.log('Total filtered count:', filteredPaginatedSession.getCount());
```

## Complex Queries

### Combining Multiple Operations

```javascript
// Complex session with filtering, sorting, custom columns, and computed values
const complexSession = eventHorizon.createSession({
    id: 'complex-analysis',
    table: 'sales',
    columns: [
        { name: 'id' },
        { name: 'salesPersonId' },
        { name: 'amount' },
        { name: 'quantity' },
        { name: 'region' },
        { 
            name: 'unitPrice', 
            value: (row) => (row.amount / row.quantity).toFixed(2)
        },
        { 
            name: 'performanceCategory',
            value: (row) => {
                if (row.amount > 2500) return 'Excellent';
                if (row.amount > 1500) return 'Good';
                if (row.amount > 800) return 'Average';
                return 'Below Average';
            }
        }
    ],
    filter: [
        { field: 'amount', comparison: '>', value: 800 },
        { field: 'region', comparison: 'in', value: ['North', 'South', 'West'] }
    ],
    sort: [
        { field: 'amount', direction: 'desc' }
    ]
});

const complexResults = complexSession.getData({ start: 0, limit: 10 });
console.log('Complex query results:', complexResults);
```

### Conditional Logic in Columns

```javascript
// Session with conditional computed columns
const conditionalSession = eventHorizon.createSession({
    id: 'conditional-analysis',
    table: 'sales',
    columns: [
        { name: 'id' },
        { name: 'amount' },
        { name: 'region' },
        { name: 'date' },
        { 
            name: 'seasonalBonus',
            value: (row) => {
                const month = new Date(row.date).getMonth();
                // December = 11, January = 0, February = 1 (winter bonus)
                if (month === 11 || month === 0 || month === 1) {
                    return row.amount * 0.05; // 5% winter bonus
                }
                return 0;
            }
        },
        { 
            name: 'regionalMultiplier',
            value: (row) => {
                const multipliers = { North: 1.1, South: 1.05, East: 1.0, West: 1.15 };
                return multipliers[row.region] || 1.0;
            }
        },
        { 
            name: 'adjustedAmount',
            value: (row) => {
                const seasonal = row.seasonalBonus || 0;
                const regional = row.regionalMultiplier || 1.0;
                return ((row.amount + seasonal) * regional).toFixed(2);
            }
        }
    ]
});

console.log('Conditional analysis:', conditionalSession.getData());
```

## Joins and Relationships

### Setting up Related Tables

```javascript
// Create related tables
const salesPeopleTable = eventHorizon.createTesseract('salespeople', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'name', type: 'string' },
        { name: 'department', type: 'string' },
        { name: 'hireDate', type: 'date' }
    ]
});

const customersTable = eventHorizon.createTesseract('customers', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'companyName', type: 'string' },
        { name: 'contactName', type: 'string' },
        { name: 'city', type: 'string' }
    ]
});

// Add reference data
salesPeopleTable.add([
    { id: 101, name: 'Alice Johnson', department: 'North Region', hireDate: new Date('2022-03-15') },
    { id: 102, name: 'Bob Smith', department: 'South Region', hireDate: new Date('2021-11-20') },
    { id: 103, name: 'Carol Davis', department: 'West Region', hireDate: new Date('2022-07-10') }
]);

customersTable.add([
    { id: 201, companyName: 'TechCorp Inc', contactName: 'John Doe', city: 'Seattle' },
    { id: 202, companyName: 'Global Solutions', contactName: 'Jane Smith', city: 'Atlanta' },
    { id: 203, companyName: 'Innovation Labs', contactName: 'Mike Wilson', city: 'Portland' },
    { id: 204, companyName: 'Future Systems', contactName: 'Sarah Brown', city: 'Denver' },
    { id: 205, companyName: 'Smart Devices', contactName: 'Tom Jones', city: 'Miami' }
]);
```

### Creating Sessions with Resolved Relationships

```javascript
// Session with resolved foreign keys
const enrichedSalesSession = eventHorizon.createSession({
    id: 'enriched-sales',
    table: 'sales',
    columns: [
        { name: 'id' },
        { name: 'amount' },
        { name: 'date' },
        { 
            name: 'salesPersonName',
            resolve: {
                underlyingField: 'salesPersonId',
                childrenTable: 'salespeople',
                displayField: 'name'
            }
        },
        { 
            name: 'salesPersonDepartment',
            resolve: {
                underlyingField: 'salesPersonId',
                childrenTable: 'salespeople',
                displayField: 'department'
            }
        },
        { 
            name: 'customerCompany',
            resolve: {
                underlyingField: 'customerId',
                childrenTable: 'customers',
                displayField: 'companyName'
            }
        },
        { 
            name: 'customerCity',
            resolve: {
                underlyingField: 'customerId',
                childrenTable: 'customers',
                displayField: 'city'
            }
        }
    ]
});

console.log('Enriched sales data:', enrichedSalesSession.getData());
```

### Advanced Relationship Queries

```javascript
// Query with complex relationships and aggregation
const salesAnalysisSession = eventHorizon.createSession({
    id: 'sales-analysis',
    table: 'sales',
    columns: [
        { name: 'salesPersonId' },
        { 
            name: 'salesPersonName',
            resolve: {
                underlyingField: 'salesPersonId',
                childrenTable: 'salespeople',
                displayField: 'name'
            }
        },
        { name: 'totalSales', aggregator: 'sum' },
        { name: 'avgSale', aggregator: 'avg' },
        { name: 'salesCount', value: 1, aggregator: 'sum' },
        { 
            name: 'topCustomer',
            aggregator: (data, objWrapper) => {
                // Find the customer with highest total sales for this salesperson
                const customerTotals = {};
                data.forEach(row => {
                    const wrapped = objWrapper.setData(row);
                    const customerId = wrapped.customerId;
                    customerTotals[customerId] = (customerTotals[customerId] || 0) + wrapped.amount;
                });
                
                const topCustomerId = Object.keys(customerTotals)
                    .reduce((a, b) => customerTotals[a] > customerTotals[b] ? a : b);
                
                const customer = eventHorizon.get('customers').getById(parseInt(topCustomerId));
                return customer ? customer.companyName : 'Unknown';
            }
        }
    ],
    groupBy: [{ dataIndex: 'salesPersonId' }]
});

const analysisResults = salesAnalysisSession.groupData();
console.log('Sales analysis by person:', analysisResults);
```

### Dynamic Query Execution

```javascript
// Function to create dynamic queries based on parameters
function createDynamicSalesQuery(filters = [], sortBy = 'date', sortDirection = 'desc', includeDetails = true) {
    const columns = [
        { name: 'id' },
        { name: 'amount' },
        { name: 'date' },
        { name: 'region' }
    ];
    
    if (includeDetails) {
        columns.push(
            { 
                name: 'salesPersonName',
                resolve: {
                    underlyingField: 'salesPersonId',
                    childrenTable: 'salespeople',
                    displayField: 'name'
                }
            },
            { 
                name: 'customerCompany',
                resolve: {
                    underlyingField: 'customerId',
                    childrenTable: 'customers',
                    displayField: 'companyName'
                }
            }
        );
    }
    
    return eventHorizon.createSession({
        id: `dynamic-${Date.now()}`,
        table: 'sales',
        columns: columns,
        filter: filters,
        sort: [{ field: sortBy, direction: sortDirection }]
    });
}

// Use the dynamic query function
const highValueQuery = createDynamicSalesQuery(
    [{ field: 'amount', comparison: '>', value: 1500 }],
    'amount',
    'desc',
    true
);

console.log('Dynamic high value query:', highValueQuery.getData());
```

## Advanced GroupBy and SubSessions

### Understanding GroupBy Operations

GroupBy operations in Tesseract allow you to aggregate data across multiple dimensions, similar to SQL GROUP BY clauses but with real-time updates.

```javascript
// Multi-dimensional grouping
const multiDimensionalSession = eventHorizon.createSession({
    id: 'multi-dimensional-sales',
    table: 'sales',
    groupBy: [
        { dataIndex: 'region' },      // First level grouping
        { dataIndex: 'quarter' },     // Second level grouping  
        { dataIndex: 'product' }      // Third level grouping
    ],
    columns: [
        { name: 'region' },
        { name: 'quarter' },
        { name: 'product' },
        {
            name: 'totalSales',
            value: 'amount',
            aggregator: 'sum'
        },
        {
            name: 'salesCount',
            value: 1,
            aggregator: 'sum'
        },
        {
            name: 'avgSaleValue',
            value: 'amount',
            aggregator: 'avg'
        }
    ],
    includeLeafs: false  // Only show aggregated groups, not individual records
});

// Get hierarchical grouped data
const groupedSalesData = multiDimensionalSession.groupData();
console.log('Multi-dimensional sales analysis:');

function displayGroupHierarchy(data, level = 0) {
    const indent = '  '.repeat(level);
    
    data.forEach(item => {
        if (level === 0) {
            console.log(`${indent}🌍 Region: ${item.region} - Total: $${item.totalSales}`);
        } else if (level === 1) {
            console.log(`${indent}📅 Q${item.quarter} - Sales: $${item.totalSales} (${item.salesCount} orders)`);
        } else if (level === 2) {
            console.log(`${indent}📦 ${item.product} - $${item.totalSales} (avg: $${item.avgSaleValue.toFixed(2)})`);
        }
        
        // Recursively display children
        if (item.children && item.children.length > 0) {
            displayGroupHierarchy(item.children, level + 1);
        }
    });
}

displayGroupHierarchy(groupedSalesData);
```

### SubSessions for Relational Aggregation

SubSessions enable complex relational queries by creating aggregated views of related tables that automatically update when source data changes.

```javascript
// Create related tables for demonstration
const customersTable = eventHorizon.createTesseract('customers', {
    columns: [
        { name: 'id', primaryKey: true, columnType: 'number' },
        { name: 'name', columnType: 'text' },
        { name: 'segment', columnType: 'text' },
        { name: 'region', columnType: 'text' }
    ]
});

const ordersTable = eventHorizon.createTesseract('orders', {
    columns: [
        { name: 'id', primaryKey: true, columnType: 'number' },
        { name: 'customer_id', columnType: 'number' },
        { name: 'order_value', columnType: 'number' },
        { name: 'order_date', columnType: 'date' },
        { name: 'status', columnType: 'text' }
    ]
});

// Add sample data
customersTable.add([
    { id: 1, name: 'Acme Corp', segment: 'Enterprise', region: 'North' },
    { id: 2, name: 'TechStart Inc', segment: 'Startup', region: 'West' },
    { id: 3, name: 'Global Systems', segment: 'Enterprise', region: 'East' }
]);

ordersTable.add([
    { id: 101, customer_id: 1, order_value: 50000, order_date: new Date('2023-01-15'), status: 'completed' },
    { id: 102, customer_id: 1, order_value: 25000, order_date: new Date('2023-02-01'), status: 'completed' },
    { id: 103, customer_id: 2, order_value: 15000, order_date: new Date('2023-01-20'), status: 'pending' },
    { id: 104, customer_id: 3, order_value: 75000, order_date: new Date('2023-02-10'), status: 'completed' }
]);

// Create session with subSessions for customer analysis
const customerAnalysisSession = eventHorizon.createSession({
    id: 'customer-analysis',
    table: 'customers',
    subSessions: {
        // SubSession for order statistics
        orderMetrics: {
            table: 'orders',
            columns: [
                {
                    name: 'customer_id',
                    primaryKey: true
                },
                {
                    name: 'totalOrderValue',
                    value: 'status == "completed" ? order_value : 0',
                    aggregator: 'sum'
                },
                {
                    name: 'pendingOrderValue', 
                    value: 'status == "pending" ? order_value : 0',
                    aggregator: 'sum'
                },
                {
                    name: 'orderCount',
                    value: 1,
                    aggregator: 'sum'
                },
                {
                    name: 'avgOrderValue',
                    value: 'order_value',
                    aggregator: 'avg'
                },
                {
                    name: 'lastOrderDate',
                    value: 'order_date',
                    aggregator: 'max'
                }
            ],
            groupBy: [{ dataIndex: 'customer_id' }]
        }
    },
    // Group customers by segment for aggregated analysis
    groupBy: [{ dataIndex: 'segment' }],
    columns: [
        { name: 'segment' },
        {
            name: 'customerCount',
            value: 1,
            aggregator: 'sum'
        },
        {
            name: 'segmentRevenue',
            value: 'completedOrderValue || 0',
            aggregator: 'sum',
            resolve: {
                underlyingField: 'id',
                session: 'orderMetrics',
                valueField: 'customer_id', 
                displayField: 'totalOrderValue'
            }
        },
        {
            name: 'segmentPipeline',
            value: 'pendingOrderValue || 0',
            aggregator: 'sum',
            resolve: {
                underlyingField: 'id',
                session: 'orderMetrics',
                valueField: 'customer_id',
                displayField: 'pendingOrderValue'
            }
        },
        {
            name: 'totalOrders',
            value: 'orderCount || 0',
            aggregator: 'sum', 
            resolve: {
                underlyingField: 'id',
                session: 'orderMetrics',
                valueField: 'customer_id',
                displayField: 'orderCount'
            }
        },
        {
            name: 'revenuePerCustomer',
            value: 'segmentRevenue / customerCount',
            aggregator: 'expression'
        }
    ],
    includeLeafs: false
});

console.log('Customer Segment Analysis:');
const segmentData = customerAnalysisSession.groupData();
segmentData.forEach(segment => {
    console.log(`\n💼 ${segment.segment} Segment:`);
    console.log(`  👥 Customers: ${segment.customerCount}`);
    console.log(`  💰 Revenue: $${segment.segmentRevenue.toLocaleString()}`);
    console.log(`  📊 Pipeline: $${segment.segmentPipeline.toLocaleString()}`);
    console.log(`  📦 Total Orders: ${segment.totalOrders}`);
    console.log(`  💵 Revenue per Customer: $${segment.revenuePerCustomer.toLocaleString()}`);
});
```

### Real-time Updates with GroupBy and SubSessions

```javascript
// Monitor changes in grouped and relational data
customerAnalysisSession.on('dataUpdate', (updateData) => {
    console.log('\n🔄 Customer Analysis Updated');
    console.log('Updated segment data:');
    
    const updatedData = customerAnalysisSession.groupData();
    updatedData.forEach(segment => {
        console.log(`  ${segment.segment}: $${segment.segmentRevenue.toLocaleString()} revenue, ${segment.customerCount} customers`);
    });
});

// Simulate real-time updates
console.log('\n🎬 Simulating business activity...');

setTimeout(() => {
    console.log('\n📦 New large order placed...');
    ordersTable.add({
        id: 105,
        customer_id: 2,
        order_value: 45000,
        order_date: new Date(),
        status: 'completed'
    });
}, 2000);

setTimeout(() => {
    console.log('\n🏢 New enterprise customer added...');
    customersTable.add({
        id: 4,
        name: 'MegaCorp Ltd',
        segment: 'Enterprise', 
        region: 'South'
    });
    
    // Add order for new customer
    ordersTable.add({
        id: 106,
        customer_id: 4,
        order_value: 100000,
        order_date: new Date(),
        status: 'pending'
    });
}, 4000);

setTimeout(() => {
    console.log('\n✅ Pending order completed...');
    ordersTable.update([{
        id: 103,
        customer_id: 2,
        order_value: 15000,
        order_date: new Date('2023-01-20'),
        status: 'completed'  // Changed from pending to completed
    }]);
}, 6000);
```

console.log('✅ Advanced GroupBy and SubSessions examples completed');
console.log('🔗 SubSessions enable real-time relational aggregation');
console.log('📊 GroupBy supports multi-dimensional data analysis');
console.log('⚡ All operations maintain live updates as data changes');
