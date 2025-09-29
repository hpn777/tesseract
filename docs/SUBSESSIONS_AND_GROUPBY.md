# Advanced Relational Queries and SubSessions

This guide covers Tesseract's powerful relational querying capabilities using subSessions and advanced groupBy operations with aggregation.

## Table of Contents
- [SubSessions Overview](#subsessions-overview)
- [Basic Relational Queries](#basic-relational-queries)
- [Advanced Grouping with Aggregation](#advanced-grouping-with-aggregation)
- [Nested SubSessions](#nested-subsessions)
- [Real-time Relational Updates](#real-time-relational-updates)
- [Performance Optimization](#performance-optimization)

## SubSessions Overview

SubSessions allow you to create relational queries across multiple tables, similar to SQL JOINs but with real-time updates. They enable you to:

- Join data from multiple tables
- Create computed columns based on related data
- Perform aggregations across relationships
- Maintain live updates when related data changes

### Basic Concept

```javascript
const { EventHorizon } = require('../index');
const eventHorizon = new EventHorizon();

// Create related tables
const usersTable = eventHorizon.createTesseract('users', {
    columns: [
        { name: 'id', primaryKey: true, columnType: 'number' },
        { name: 'name', columnType: 'text' },
        { name: 'email', columnType: 'text' },
        { name: 'department', columnType: 'text' }
    ]
});

const ordersTable = eventHorizon.createTesseract('orders', {
    columns: [
        { name: 'id', primaryKey: true, columnType: 'number' },
        { name: 'user_id', columnType: 'number' },
        { name: 'product', columnType: 'text' },
        { name: 'amount', columnType: 'number' },
        { name: 'status', columnType: 'text' },
        { name: 'order_date', columnType: 'date' }
    ]
});

// Add sample data
usersTable.add([
    { id: 1, name: 'Alice Johnson', email: 'alice@company.com', department: 'Engineering' },
    { id: 2, name: 'Bob Smith', email: 'bob@company.com', department: 'Sales' },
    { id: 3, name: 'Carol Davis', email: 'carol@company.com', department: 'Marketing' }
]);

ordersTable.add([
    { id: 101, user_id: 1, product: 'Laptop', amount: 1200, status: 'completed', order_date: new Date('2023-01-15') },
    { id: 102, user_id: 1, product: 'Mouse', amount: 25, status: 'completed', order_date: new Date('2023-01-20') },
    { id: 103, user_id: 2, product: 'Monitor', amount: 300, status: 'pending', order_date: new Date('2023-01-22') },
    { id: 104, user_id: 2, product: 'Keyboard', amount: 80, status: 'completed', order_date: new Date('2023-01-25') },
    { id: 105, user_id: 3, product: 'Tablet', amount: 500, status: 'completed', order_date: new Date('2023-02-01') }
]);

console.log('Base tables created and populated');
```

## Basic Relational Queries

### Simple One-to-Many Relationship

```javascript
// Create a session that joins users with their order aggregations
const userOrderSummarySession = eventHorizon.createSession({
    id: 'user-order-summary',
    table: 'users',
    subSessions: {
        // Define a subSession for order aggregation
        orderStats: {
            table: 'orders',
            columns: [
                {
                    name: 'user_id',
                    primaryKey: true
                },
                {
                    name: 'totalOrders',
                    value: 1,
                    aggregator: 'sum'
                },
                {
                    name: 'totalAmount',
                    value: 'amount',
                    aggregator: 'sum'
                },
                {
                    name: 'avgOrderValue',
                    value: 'amount',
                    aggregator: 'avg'
                },
                {
                    name: 'completedOrders',
                    value: 'status == "completed" ? 1 : 0',
                    aggregator: 'sum'
                }
            ],
            groupBy: [{ dataIndex: 'user_id' }] // Group orders by user_id
        }
    },
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'name' },
        { name: 'email' },
        { name: 'department' },
        {
            name: 'orderCount',
            resolve: {
                underlyingField: 'id',           // Field in main table
                session: 'orderStats',           // SubSession reference
                valueField: 'user_id',          // Field in subSession
                displayField: 'totalOrders'     // Field to display from subSession
            }
        },
        {
            name: 'totalSpent',
            resolve: {
                underlyingField: 'id',
                session: 'orderStats',
                valueField: 'user_id',
                displayField: 'totalAmount'
            }
        },
        {
            name: 'avgOrderValue',
            resolve: {
                underlyingField: 'id',
                session: 'orderStats',
                valueField: 'user_id',
                displayField: 'avgOrderValue'
            }
        },
        {
            name: 'completedOrderCount',
            resolve: {
                underlyingField: 'id',
                session: 'orderStats',
                valueField: 'user_id',
                displayField: 'completedOrders'
            }
        }
    ],
    sort: [{ field: 'totalSpent', direction: 'DESC' }]
});

console.log('User Order Summary:');
const userSummary = userOrderSummarySession.getData();
userSummary.forEach(user => {
    console.log(`${user.name} (${user.department}):`);
    console.log(`  - Total Orders: ${user.orderCount || 0}`);
    console.log(`  - Total Spent: $${user.totalSpent || 0}`);
    console.log(`  - Avg Order Value: $${user.avgOrderValue ? user.avgOrderValue.toFixed(2) : '0.00'}`);
    console.log(`  - Completed Orders: ${user.completedOrderCount || 0}`);
    console.log('');
});
```

### Filtered SubSessions

```javascript
// Create a session showing only users with high-value orders
const highValueCustomersSession = eventHorizon.createSession({
    id: 'high-value-customers',
    table: 'users',
    subSessions: {
        highValueOrders: {
            table: 'orders',
            columns: [
                {
                    name: 'user_id',
                    primaryKey: true
                },
                {
                    name: 'highValueOrderCount',
                    value: 1,
                    aggregator: 'sum'
                },
                {
                    name: 'highValueTotal',
                    value: 'amount',
                    aggregator: 'sum'
                }
            ],
            filter: [
                {
                    field: 'amount',
                    comparison: '>',
                    value: 100
                },
                {
                    field: 'status',
                    comparison: '==',
                    value: 'completed'
                }
            ],
            groupBy: [{ dataIndex: 'user_id' }]
        }
    },
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'name' },
        { name: 'department' },
        {
            name: 'highValueOrders',
            resolve: {
                underlyingField: 'id',
                session: 'highValueOrders',
                valueField: 'user_id',
                displayField: 'highValueOrderCount'
            }
        },
        {
            name: 'highValueTotal',
            resolve: {
                underlyingField: 'id',
                session: 'highValueOrders',
                valueField: 'user_id',
                displayField: 'highValueTotal'
            }
        }
    ],
    filter: [
        // Only show users who have high-value orders
        {
            type: 'custom',
            value: 'highValueOrders > 0'
        }
    ]
});

console.log('High Value Customers:');
const highValueData = highValueCustomersSession.getData();
highValueData.forEach(user => {
    console.log(`${user.name}: ${user.highValueOrders} high-value orders totaling $${user.highValueTotal}`);
});
```

## Advanced Grouping with Aggregation

### Multi-level Grouping

```javascript
// Add more sample data for complex grouping
const salesTable = eventHorizon.createTesseract('sales', {
    columns: [
        { name: 'id', primaryKey: true, columnType: 'number' },
        { name: 'sales_person', columnType: 'text' },
        { name: 'region', columnType: 'text' },
        { name: 'product_category', columnType: 'text' },
        { name: 'amount', columnType: 'number' },
        { name: 'quarter', columnType: 'text' },
        { name: 'year', columnType: 'number' }
    ]
});

salesTable.add([
    { id: 1, sales_person: 'Alice Johnson', region: 'North', product_category: 'Electronics', amount: 5000, quarter: 'Q1', year: 2023 },
    { id: 2, sales_person: 'Alice Johnson', region: 'North', product_category: 'Software', amount: 3000, quarter: 'Q1', year: 2023 },
    { id: 3, sales_person: 'Bob Smith', region: 'South', product_category: 'Electronics', amount: 7000, quarter: 'Q1', year: 2023 },
    { id: 4, sales_person: 'Bob Smith', region: 'South', product_category: 'Software', amount: 4000, quarter: 'Q1', year: 2023 },
    { id: 5, sales_person: 'Carol Davis', region: 'West', product_category: 'Electronics', amount: 6000, quarter: 'Q1', year: 2023 },
    { id: 6, sales_person: 'Alice Johnson', region: 'North', product_category: 'Electronics', amount: 5500, quarter: 'Q2', year: 2023 },
    { id: 7, sales_person: 'Bob Smith', region: 'South', product_category: 'Software', amount: 4500, quarter: 'Q2', year: 2023 }
]);

// Multi-level grouping: Region -> Product Category -> Sales Person
const salesAnalysisSession = eventHorizon.createSession({
    id: 'sales-analysis',
    table: 'sales',
    groupBy: [
        { dataIndex: 'region' },
        { dataIndex: 'product_category' },
        { dataIndex: 'sales_person' }
    ],
    columns: [
        { name: 'region' },
        { name: 'product_category' },
        { name: 'sales_person' },
        {
            name: 'totalSales',
            value: 'amount',
            aggregator: 'sum'
        },
        {
            name: 'avgSale',
            value: 'amount',
            aggregator: 'avg'
        },
        {
            name: 'saleCount',
            value: 1,
            aggregator: 'sum'
        },
        {
            name: 'maxSale',
            value: 'amount',
            aggregator: 'max'
        }
    ],
    includeLeafs: false // Don't include individual records, only grouped data
});

console.log('Multi-level Sales Analysis:');
const salesData = salesAnalysisSession.groupData();

function printGroupedData(data, indent = 0) {
    const prefix = '  '.repeat(indent);
    
    data.forEach(item => {
        if (item.region && !item.product_category) {
            // Region level
            console.log(`${prefix}📍 Region: ${item.region}`);
            console.log(`${prefix}   Total Sales: $${item.totalSales}, Avg: $${item.avgSale.toFixed(2)}, Count: ${item.saleCount}`);
        } else if (item.product_category && !item.sales_person) {
            // Product Category level
            console.log(`${prefix}  📦 Category: ${item.product_category}`);
            console.log(`${prefix}     Total: $${item.totalSales}, Avg: $${item.avgSale.toFixed(2)}, Count: ${item.saleCount}`);
        } else if (item.sales_person) {
            // Sales Person level
            console.log(`${prefix}    👤 ${item.sales_person}`);
            console.log(`${prefix}       Sales: $${item.totalSales}, Avg: $${item.avgSale.toFixed(2)}, Max: $${item.maxSale}`);
        }
        
        if (item.children && item.children.length > 0) {
            printGroupedData(item.children, indent + 1);
        }
    });
}

printGroupedData(salesData);
```

### Custom Aggregators with SubSessions

```javascript
// Create a complex aggregation with custom logic
const departmentPerformanceSession = eventHorizon.createSession({
    id: 'department-performance',
    table: 'users',
    subSessions: {
        orderMetrics: {
            table: 'orders',
            columns: [
                {
                    name: 'user_id',
                    primaryKey: true
                },
                {
                    name: 'recentOrders',
                    value: 'order_date > new Date("2023-01-20") ? 1 : 0',
                    aggregator: 'sum'
                },
                {
                    name: 'pendingOrders',
                    value: 'status == "pending" ? 1 : 0',
                    aggregator: 'sum'
                },
                {
                    name: 'totalRevenue',
                    value: 'status == "completed" ? amount : 0',
                    aggregator: 'sum'
                },
                {
                    name: 'avgOrderSize',
                    value: 'amount',
                    aggregator: 'avg'
                }
            ],
            groupBy: [{ dataIndex: 'user_id' }]
        }
    },
    groupBy: [{ dataIndex: 'department' }],
    columns: [
        { name: 'department' },
        {
            name: 'employeeCount',
            value: 1,
            aggregator: 'sum'
        },
        {
            name: 'totalRecentOrders',
            value: 'recentOrders || 0',
            aggregator: 'sum',
            resolve: {
                underlyingField: 'id',
                session: 'orderMetrics',
                valueField: 'user_id',
                displayField: 'recentOrders'
            }
        },
        {
            name: 'totalPendingOrders',
            value: 'pendingOrders || 0',
            aggregator: 'sum',
            resolve: {
                underlyingField: 'id',
                session: 'orderMetrics',
                valueField: 'user_id',
                displayField: 'pendingOrders'
            }
        },
        {
            name: 'departmentRevenue',
            value: 'totalRevenue || 0',
            aggregator: 'sum',
            resolve: {
                underlyingField: 'id',
                session: 'orderMetrics',
                valueField: 'user_id',
                displayField: 'totalRevenue'
            }
        },
        {
            name: 'avgRevenuePerEmployee',
            value: 'departmentRevenue / employeeCount',
            aggregator: 'expression'
        }
    ],
    includeLeafs: false
});

console.log('Department Performance Analysis:');
const deptData = departmentPerformanceSession.groupData();
deptData.forEach(dept => {
    console.log(`🏢 ${dept.department} Department:`);
    console.log(`   Employees: ${dept.employeeCount}`);
    console.log(`   Recent Orders: ${dept.totalRecentOrders}`);
    console.log(`   Pending Orders: ${dept.totalPendingOrders}`);
    console.log(`   Department Revenue: $${dept.departmentRevenue}`);
    console.log(`   Revenue per Employee: $${(dept.departmentRevenue / dept.employeeCount).toFixed(2)}`);
    console.log('');
});
```

## Nested SubSessions

### Three-Table Relationships

```javascript
// Add a third table for more complex relationships
const projectsTable = eventHorizon.createTesseract('projects', {
    columns: [
        { name: 'id', primaryKey: true, columnType: 'number' },
        { name: 'name', columnType: 'text' },
        { name: 'owner_id', columnType: 'number' },
        { name: 'budget', columnType: 'number' },
        { name: 'status', columnType: 'text' },
        { name: 'start_date', columnType: 'date' }
    ]
});

projectsTable.add([
    { id: 1, name: 'Website Redesign', owner_id: 1, budget: 50000, status: 'active', start_date: new Date('2023-01-01') },
    { id: 2, name: 'Mobile App', owner_id: 1, budget: 75000, status: 'planning', start_date: new Date('2023-02-01') },
    { id: 3, name: 'Sales Dashboard', owner_id: 2, budget: 30000, status: 'completed', start_date: new Date('2022-12-01') },
    { id: 4, name: 'Marketing Campaign', owner_id: 3, budget: 25000, status: 'active', start_date: new Date('2023-01-15') }
]);

// Complex session with nested relationships
const comprehensiveUserAnalysisSession = eventHorizon.createSession({
    id: 'comprehensive-user-analysis',
    table: 'users',
    subSessions: {
        // SubSession 1: Order statistics
        orderStats: {
            table: 'orders',
            columns: [
                { name: 'user_id', primaryKey: true },
                {
                    name: 'totalOrderValue',
                    value: 'status == "completed" ? amount : 0',
                    aggregator: 'sum'
                },
                {
                    name: 'orderCount',
                    value: 1,
                    aggregator: 'sum'
                }
            ],
            groupBy: [{ dataIndex: 'user_id' }]
        },
        
        // SubSession 2: Project statistics
        projectStats: {
            table: 'projects',
            columns: [
                { name: 'owner_id', primaryKey: true },
                {
                    name: 'totalProjectBudget',
                    value: 'budget',
                    aggregator: 'sum'
                },
                {
                    name: 'activeProjects',
                    value: 'status == "active" ? 1 : 0',
                    aggregator: 'sum'
                },
                {
                    name: 'completedProjects',
                    value: 'status == "completed" ? 1 : 0',
                    aggregator: 'sum'
                },
                {
                    name: 'projectCount',
                    value: 1,
                    aggregator: 'sum'
                }
            ],
            groupBy: [{ dataIndex: 'owner_id' }]
        }
    },
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'name' },
        { name: 'department' },
        { name: 'email' },
        
        // Order-related fields
        {
            name: 'customerValue',
            resolve: {
                underlyingField: 'id',
                session: 'orderStats',
                valueField: 'user_id',
                displayField: 'totalOrderValue'
            }
        },
        {
            name: 'totalOrders',
            resolve: {
                underlyingField: 'id',
                session: 'orderStats',
                valueField: 'user_id',
                displayField: 'orderCount'
            }
        },
        
        // Project-related fields
        {
            name: 'projectBudget',
            resolve: {
                underlyingField: 'id',
                session: 'projectStats',
                valueField: 'owner_id',
                displayField: 'totalProjectBudget'
            }
        },
        {
            name: 'activeProjectCount',
            resolve: {
                underlyingField: 'id',
                session: 'projectStats',
                valueField: 'owner_id',
                displayField: 'activeProjects'
            }
        },
        {
            name: 'completedProjectCount',
            resolve: {
                underlyingField: 'id',
                session: 'projectStats',
                valueField: 'owner_id',
                displayField: 'completedProjects'
            }
        },
        
        // Computed fields combining multiple sources
        {
            name: 'totalResponsibility',
            value: '(customerValue || 0) + (projectBudget || 0)'
        },
        {
            name: 'activityScore',
            value: '((totalOrders || 0) * 10) + ((activeProjectCount || 0) * 50) + ((completedProjectCount || 0) * 30)'
        }
    ],
    sort: [{ field: 'totalResponsibility', direction: 'DESC' }]
});

console.log('Comprehensive User Analysis:');
const comprehensiveData = comprehensiveUserAnalysisSession.getData();
comprehensiveData.forEach(user => {
    console.log(`👤 ${user.name} (${user.department})`);
    console.log(`   📧 ${user.email}`);
    console.log(`   💰 Customer Value: $${user.customerValue || 0}`);
    console.log(`   📦 Total Orders: ${user.totalOrders || 0}`);
    console.log(`   🎯 Project Budget Managed: $${user.projectBudget || 0}`);
    console.log(`   ⚡ Active Projects: ${user.activeProjectCount || 0}`);
    console.log(`   ✅ Completed Projects: ${user.completedProjectCount || 0}`);
    console.log(`   💪 Total Responsibility: $${user.totalResponsibility || 0}`);
    console.log(`   📊 Activity Score: ${user.activityScore || 0}`);
    console.log('');
});
```

## Real-time Relational Updates

### Live Updates Across Relationships

```javascript
// Set up real-time monitoring for relational changes
console.log('🔴 Setting up real-time monitoring...');

// Monitor the comprehensive analysis session
comprehensiveUserAnalysisSession.on('dataUpdate', (updateData) => {
    console.log('📊 User Analysis Updated:');
    console.log(`   Added: ${updateData.addedIds.length} users`);
    console.log(`   Updated: ${updateData.updatedIds.length} users`);
    console.log(`   Removed: ${updateData.removedIds.length} users`);
    
    // Show details of updated users
    if (updateData.updatedData && updateData.updatedData.length > 0) {
        updateData.updatedData.forEach(userData => {
            const user = userData.object;
            console.log(`   🔄 ${user.name}: Activity Score now ${user.activityScore}, Responsibility $${user.totalResponsibility}`);
        });
    }
});

// Monitor department performance
departmentPerformanceSession.on('dataUpdate', (updateData) => {
    console.log('🏢 Department Performance Updated:');
    const newDeptData = departmentPerformanceSession.groupData();
    newDeptData.forEach(dept => {
        console.log(`   ${dept.department}: $${dept.departmentRevenue} revenue, ${dept.totalPendingOrders} pending`);
    });
});

// Simulate real-time updates
console.log('🎬 Simulating real-time updates...');

// Add a new order - this will trigger updates in multiple sessions
setTimeout(() => {
    console.log('\n📦 Adding new order for Alice...');
    ordersTable.add({
        id: 106,
        user_id: 1,
        product: 'External Drive',
        amount: 150,
        status: 'completed',
        order_date: new Date()
    });
}, 2000);

// Update a project status - this will affect project statistics
setTimeout(() => {
    console.log('\n🎯 Completing Mobile App project...');
    projectsTable.update([{
        id: 2,
        name: 'Mobile App',
        owner_id: 1,
        budget: 75000,
        status: 'completed',
        start_date: new Date('2023-02-01')
    }]);
}, 4000);

// Add a new user with immediate orders and projects
setTimeout(() => {
    console.log('\n👤 Adding new user David with orders and project...');
    
    // Add user
    usersTable.add({
        id: 4,
        name: 'David Wilson',
        email: 'david@company.com',
        department: 'Engineering'
    });
    
    // Add orders for the new user
    ordersTable.add([
        {
            id: 107,
            user_id: 4,
            product: 'Workstation',
            amount: 2000,
            status: 'completed',
            order_date: new Date()
        },
        {
            id: 108,
            user_id: 4,
            product: 'Software License',
            amount: 500,
            status: 'pending',
            order_date: new Date()
        }
    ]);
    
    // Add project for the new user
    projectsTable.add({
        id: 5,
        name: 'API Integration',
        owner_id: 4,
        budget: 40000,
        status: 'active',
        start_date: new Date()
    });
    
}, 6000);
```

### Advanced Event Handling

```javascript
// Advanced event handling for complex workflows
class RelationalEventManager {
    constructor(eventHorizon) {
        this.eventHorizon = eventHorizon;
        this.alertThresholds = {
            highValueCustomer: 1000,
            highActivityScore: 500,
            departmentRevenueAlert: 10000
        };
        this.setupAdvancedHandlers();
    }
    
    setupAdvancedHandlers() {
        // Monitor for high-value customers
        const userAnalysis = this.eventHorizon.getSession('comprehensive-user-analysis');
        if (userAnalysis) {
            userAnalysis.on('dataUpdate', (updateData) => {
                this.checkHighValueCustomers(updateData);
                this.checkActivityScores(updateData);
            });
        }
        
        // Monitor department performance changes
        const deptPerformance = this.eventHorizon.getSession('department-performance');
        if (deptPerformance) {
            deptPerformance.on('dataUpdate', (updateData) => {
                this.checkDepartmentAlerts();
            });
        }
    }
    
    checkHighValueCustomers(updateData) {
        if (updateData.updatedData) {
            updateData.updatedData.forEach(userData => {
                const user = userData.object;
                if (user.customerValue > this.alertThresholds.highValueCustomer) {
                    console.log(`🎖️  HIGH VALUE CUSTOMER ALERT: ${user.name} has customer value of $${user.customerValue}`);
                    this.triggerCustomerRetentionWorkflow(user);
                }
            });
        }
    }
    
    checkActivityScores(updateData) {
        if (updateData.updatedData) {
            updateData.updatedData.forEach(userData => {
                const user = userData.object;
                if (user.activityScore > this.alertThresholds.highActivityScore) {
                    console.log(`⭐ HIGH ACTIVITY ALERT: ${user.name} has activity score of ${user.activityScore}`);
                    this.considerPerformanceRecognition(user);
                }
            });
        }
    }
    
    checkDepartmentAlerts() {
        const deptSession = this.eventHorizon.getSession('department-performance');
        if (deptSession) {
            const deptData = deptSession.groupData();
            deptData.forEach(dept => {
                if (dept.departmentRevenue > this.alertThresholds.departmentRevenueAlert) {
                    console.log(`🏆 DEPARTMENT MILESTONE: ${dept.department} reached $${dept.departmentRevenue} in revenue!`);
                }
                
                if (dept.totalPendingOrders > 5) {
                    console.log(`⚠️  ATTENTION NEEDED: ${dept.department} has ${dept.totalPendingOrders} pending orders`);
                }
            });
        }
    }
    
    triggerCustomerRetentionWorkflow(user) {
        console.log(`   📋 Triggering retention workflow for ${user.name}`);
        console.log(`   📊 User metrics: ${user.totalOrders} orders, $${user.customerValue} value`);
        // In a real application, this might:
        // - Send personalized offers
        // - Assign dedicated account manager
        // - Schedule check-in calls
    }
    
    considerPerformanceRecognition(user) {
        console.log(`   🎉 Considering performance recognition for ${user.name}`);
        console.log(`   📈 Metrics: Activity score ${user.activityScore}, Managing $${user.projectBudget} in projects`);
        // In a real application, this might:
        // - Nominate for employee of the month
        // - Trigger salary review
        // - Assign additional responsibilities
    }
}

// Initialize advanced event management
const relationalEventManager = new RelationalEventManager(eventHorizon);

console.log('🚀 Advanced relational event management initialized');
console.log('⏰ Real-time updates will trigger intelligent workflows');
```

## Performance Optimization

### Optimizing SubSession Queries

```javascript
// Performance optimization strategies for subSessions
class SubSessionOptimizer {
    constructor(eventHorizon) {
        this.eventHorizon = eventHorizon;
        this.queryStats = new Map();
    }
    
    createOptimizedRelationalSession(config) {
        const optimizedConfig = this.optimizeSubSessions(config);
        
        // Track performance
        const startTime = Date.now();
        const session = this.eventHorizon.createSession(optimizedConfig);
        const createTime = Date.now() - startTime;
        
        this.queryStats.set(session.get('id'), {
            createTime: createTime,
            lastQueryTime: 0,
            queryCount: 0
        });
        
        // Wrap getData for performance tracking
        const originalGetData = session.getData.bind(session);
        session.getData = () => {
            const queryStart = Date.now();
            const result = originalGetData();
            const queryTime = Date.now() - queryStart;
            
            const stats = this.queryStats.get(session.get('id'));
            stats.lastQueryTime = queryTime;
            stats.queryCount++;
            
            if (queryTime > 100) {
                console.log(`⚠️  Slow query detected: ${session.get('id')} took ${queryTime}ms`);
            }
            
            return result;
        };
        
        return session;
    }
    
    optimizeSubSessions(config) {
        const optimized = JSON.parse(JSON.stringify(config)); // Deep clone
        
        // Optimize subSessions
        if (optimized.subSessions) {
            Object.keys(optimized.subSessions).forEach(key => {
                const subSession = optimized.subSessions[key];
                
                // Add performance hints
                subSession.optimizeFilters = true;
                subSession.useSecondaryIndexes = true;
                
                // Optimize column selection - only include needed columns
                if (subSession.columns) {
                    subSession.columns = this.optimizeColumns(subSession.columns);
                }
                
                // Optimize filters - put indexed filters first
                if (subSession.filter) {
                    subSession.filter = this.optimizeFilters(subSession.filter);
                }
            });
        }
        
        return optimized;
    }
    
    optimizeColumns(columns) {
        // Remove unnecessary columns and optimize aggregations
        return columns.filter(col => {
            // Keep primary keys and aggregated columns
            return col.primaryKey || col.aggregator || col.value;
        });
    }
    
    optimizeFilters(filters) {
        // Sort filters by selectivity (most selective first)
        return filters.sort((a, b) => {
            const aScore = this.getFilterSelectivity(a);
            const bScore = this.getFilterSelectivity(b);
            return bScore - aScore; // Higher selectivity first
        });
    }
    
    getFilterSelectivity(filter) {
        // Higher scores = more selective filters
        if (filter.field === 'id') return 100;
        if (filter.comparison === '==') return 80;
        if (filter.comparison === 'in') return 60;
        if (filter.comparison === '>=' || filter.comparison === '<=') return 40;
        if (filter.type === 'custom') return 20;
        return 10;
    }
    
    getPerformanceReport() {
        console.log('📊 SubSession Performance Report:');
        this.queryStats.forEach((stats, sessionId) => {
            console.log(`Session: ${sessionId}`);
            console.log(`  Creation Time: ${stats.createTime}ms`);
            console.log(`  Last Query Time: ${stats.lastQueryTime}ms`);
            console.log(`  Total Queries: ${stats.queryCount}`);
            
            if (stats.queryCount > 0) {
                const avgQueryTime = stats.lastQueryTime; // Simplified for demo
                console.log(`  Avg Query Time: ${avgQueryTime}ms`);
                
                if (avgQueryTime > 50) {
                    console.log(`  ⚠️  Consider optimization`);
                } else {
                    console.log(`  ✅ Good performance`);
                }
            }
            console.log('');
        });
    }
}

// Usage example
const optimizer = new SubSessionOptimizer(eventHorizon);

const optimizedSession = optimizer.createOptimizedRelationalSession({
    id: 'optimized-user-analysis',
    table: 'users',
    subSessions: {
        orderStats: {
            table: 'orders',
            columns: [
                { name: 'user_id', primaryKey: true },
                { name: 'totalAmount', value: 'amount', aggregator: 'sum' }
            ],
            filter: [
                { field: 'status', comparison: '==', value: 'completed' }
            ],
            groupBy: [{ dataIndex: 'user_id' }]
        }
    },
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'name' },
        {
            name: 'totalSpent',
            resolve: {
                underlyingField: 'id',
                session: 'orderStats',
                valueField: 'user_id',
                displayField: 'totalAmount'
            }
        }
    ]
});

// Test performance
console.log('🏁 Testing optimized session performance...');
const testData = optimizedSession.getData();
console.log(`Retrieved ${testData.length} records`);

// Get performance report
setTimeout(() => {
    optimizer.getPerformanceReport();
}, 1000);

console.log('✅ Advanced relational queries and subSessions guide completed');
console.log('🔗 SubSessions enable powerful real-time relational queries');
console.log('📊 GroupBy operations support multi-level aggregation');
console.log('⚡ Real-time updates maintain data consistency across relationships');
```

This comprehensive guide demonstrates how to use Tesseract's advanced relational capabilities with subSessions and complex groupBy operations, including real-time updates, performance optimization, and intelligent event handling across multiple related tables.
