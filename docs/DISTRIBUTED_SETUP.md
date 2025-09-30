# Distributed Setup Guide

This guide covers setting up Tesseract in a distributed environment using Redis for synchronization and clustering.

## Table of Contents
- [Redis Setup](#redis-setup)
- [Cluster Configuration](#cluster-configuration)
- [Synchronization](#synchronization)
- [Persistence](#persistence)
- [Multi-Node Examples](#multi-node-examples)
- [Best Practices](#best-practices)

## Redis Setup

### Installing Redis

```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis

# Or use Docker
docker run -d -p 6379:6379 redis:alpine
```

### Redis Configuration

```javascript
// Basic Redis configuration
const redisConfig = {
    host: 'localhost',
    port: 6379,
    // password: 'your-password', // if authentication is required
    // db: 0,                     // database number
    retryDelayOnFailover: 100,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 3
};
```

## Cluster Configuration

### Setting up TessSync

```javascript
// For npm package usage:
// const { ClusterRedis: TessSync, EventHorizon } = require('tessio');

// For local development:
const { ClusterRedis: TessSync, EventHorizon } = require('../index');

// Create a TessSync instance for distributed operations
const cluster = new TessSync(
    { namespace: 'myapp' },           // EventHorizon options
    new EventHorizon({ namespace: 'myapp' })  // EventHorizon instance
);

// Connect to Redis
async function initializeCluster() {
    try {
        await cluster.connect({
            redis: {
                host: 'localhost',
                port: 6379
            },
            syncSchema: true  // Auto-sync table definitions
        });
        console.log('Connected to Redis cluster');
    } catch (error) {
        console.error('Failed to connect to Redis:', error);
    }
}

initializeCluster();
```

### Creating Distributed Tables

```javascript
// Create a table that will be synchronized across nodes
const createDistributedTable = async () => {
    const userTable = await cluster.createTesseract('users', {
        columns: [
            { name: 'id', primaryKey: true },
            { name: 'name', type: 'string' },
            { name: 'email', type: 'string' },
            { name: 'department', type: 'string' },
            { name: 'lastSeen', type: 'date' }
        ],
        clusterSync: true,    // Enable cluster synchronization
        persistent: true      // Enable persistence for snapshots
    });

    console.log('Distributed table created');
    return userTable;
};

createDistributedTable();
```

## Synchronization

### Real-time Data Synchronization

```javascript
// Node 1: Add data
const node1Setup = async () => {
    const cluster1 = new TessSync({ namespace: 'myapp' });
    await cluster1.connect({
        redis: { host: 'localhost', port: 6379 },
        syncSchema: true
    });

    const userTable1 = await cluster1.createTesseract('users', {
        columns: [
            { name: 'id', primaryKey: true },
            { name: 'name', type: 'string' },
            { name: 'email', type: 'string' },
            { name: 'status', type: 'string' }
        ],
        clusterSync: true,
        persistent: true
    });

    // Listen for data changes from other nodes
    userTable1.on('dataUpdate', (data) => {
        console.log('Node 1 - Data updated from cluster:', data.length, 'rows');
    });

    // Add data - will be synchronized to other nodes
    await userTable1.add([
        { id: 1, name: 'Alice Johnson', email: 'alice@company.com', status: 'active' },
        { id: 2, name: 'Bob Smith', email: 'bob@company.com', status: 'active' }
    ]);

    console.log('Node 1 - Data added');
    return { cluster1, userTable1 };
};

// Node 2: Receive synchronized data
const node2Setup = async () => {
    const cluster2 = new TessSync({ namespace: 'myapp' });
    await cluster2.connect({
        redis: { host: 'localhost', port: 6379 },
        syncSchema: true
    });

    // Pull existing table from cluster
    const userTable2 = await cluster2.pullTesseract('users');

    // Listen for changes
    userTable2.on('dataUpdate', (data) => {
        console.log('Node 2 - Received update from cluster:', data.length, 'rows');
        data.forEach(row => {
            console.log(`  - ${row.name} (${row.email})`);
        });
    });

    // Update data - will be synchronized to other nodes
    setTimeout(async () => {
        await userTable2.update({ id: 1, status: 'offline' });
        console.log('Node 2 - Updated user status');
    }, 2000);

    return { cluster2, userTable2 };
};

// Run both nodes
Promise.all([node1Setup(), node2Setup()]);
```

### Schema Synchronization

```javascript
// Automatic schema synchronization example
const createTablesWithSchemaSync = async () => {
    const cluster = new TessSync({ namespace: 'ecommerce' });
    await cluster.connect({
        redis: { host: 'localhost', port: 6379 },
        syncSchema: true  // Automatically sync table definitions
    });

    // Create multiple related tables
    const tables = {};

    // Products table
    tables.products = await cluster.createTesseract('products', {
        columns: [
            { name: 'id', primaryKey: true },
            { name: 'name', type: 'string' },
            { name: 'price', type: 'number' },
            { name: 'categoryId', type: 'number', secondaryKey: true }
        ],
        clusterSync: true,
        persistent: true
    });

    // Categories table
    tables.categories = await cluster.createTesseract('categories', {
        columns: [
            { name: 'id', primaryKey: true },
            { name: 'name', type: 'string' },
            { name: 'description', type: 'string' }
        ],
        clusterSync: true,
        persistent: true
    });

    // Orders table
    tables.orders = await cluster.createTesseract('orders', {
        columns: [
            { name: 'id', primaryKey: true },
            { name: 'customerId', type: 'number' },
            { name: 'productId', type: 'number' },
            { name: 'quantity', type: 'number' },
            { name: 'total', type: 'number' },
            { name: 'orderDate', type: 'date' }
        ],
        clusterSync: true,
        persistent: true
    });

    console.log('All tables created and schema synchronized');
    return tables;
};

createTablesWithSchemaSync();
```

## Persistence

### Snapshot-based Persistence

```javascript
// Configure persistent tables with snapshots
const setupPersistentTable = async () => {
    const cluster = new TessSync({ namespace: 'analytics' });
    await cluster.connect({
        redis: { host: 'localhost', port: 6379 },
        syncSchema: true
    });

    const metricsTable = await cluster.createTesseract('metrics', {
        columns: [
            { name: 'id', primaryKey: true },
            { name: 'timestamp', type: 'date' },
            { name: 'metricName', type: 'string' },
            { name: 'value', type: 'number' },
            { name: 'tags', type: 'object' }
        ],
        clusterSync: true,
        persistent: true  // Enables snapshots for recovery
    });

    // Add large dataset
    const metrics = [];
    for (let i = 1; i <= 1000; i++) {
        metrics.push({
            id: i,
            timestamp: new Date(Date.now() - Math.random() * 86400000), // Random time in last 24h
            metricName: ['cpu_usage', 'memory_usage', 'disk_io', 'network_bytes'][Math.floor(Math.random() * 4)],
            value: Math.random() * 100,
            tags: { server: `server-${Math.ceil(i / 100)}`, env: 'production' }
        });
    }

    await metricsTable.add(metrics);
    console.log('Added 1000 metrics with persistence enabled');

    // Trigger manual snapshot (optional - usually automatic)
    metricsTable.trigger('clusterReset', metricsTable.getData());

    return metricsTable;
};

setupPersistentTable();
```

### Recovery from Persistence

```javascript
// Demonstrate recovery from persistent data
const demonstrateRecovery = async () => {
    console.log('Setting up cluster node for recovery demo...');
    
    const cluster = new TessSync({ namespace: 'analytics' });
    await cluster.connect({
        redis: { host: 'localhost', port: 6379 },
        syncSchema: true
    });

    // Pull existing persistent table
    const recoveredTable = await cluster.pullTesseract('metrics');
    
    console.log('Recovered table data count:', recoveredTable.getCount());
    
    // Verify data integrity
    const sampleData = recoveredTable.getData().slice(0, 5);
    console.log('Sample recovered data:', sampleData);
    
    return recoveredTable;
};

// Run recovery after a delay to ensure data exists
setTimeout(demonstrateRecovery, 3000);
```

## Multi-Node Examples

### Load Balancer Scenario

```javascript
// Simulate multiple application nodes with load balancing
const simulateLoadBalancer = async () => {
    const nodes = [];
    const nodeCount = 3;

    // Create multiple cluster nodes
    for (let i = 0; i < nodeCount; i++) {
        const cluster = new TessSync({ 
            namespace: 'loadbalancer-demo',
            nodeId: `node-${i + 1}`
        });
        
        await cluster.connect({
            redis: { host: 'localhost', port: 6379 },
            syncSchema: true
        });

        const sessionsTable = await cluster.createTesseract('user_sessions', {
            columns: [
                { name: 'sessionId', primaryKey: true },
                { name: 'userId', type: 'number' },
                { name: 'nodeId', type: 'string' },
                { name: 'startTime', type: 'date' },
                { name: 'lastActivity', type: 'date' },
                { name: 'data', type: 'object' }
            ],
            clusterSync: true,
            persistent: false  // Sessions are temporary
        });

        // Each node handles different users
        sessionsTable.on('dataUpdate', (data) => {
            console.log(`Node ${i + 1} - Sessions updated:`, data.length);
        });

        nodes.push({ cluster, sessionsTable, nodeId: i + 1 });
    }

    // Simulate user sessions across nodes
    for (let i = 0; i < 10; i++) {
        const nodeIndex = i % nodeCount;
        const node = nodes[nodeIndex];
        
        await node.sessionsTable.add({
            sessionId: `session-${i + 1}`,
            userId: 1000 + i,
            nodeId: `node-${node.nodeId}`,
            startTime: new Date(),
            lastActivity: new Date(),
            data: { page: '/dashboard', role: 'user' }
        });

        console.log(`Created session ${i + 1} on node ${node.nodeId}`);
    }

    // Check data distribution
    setTimeout(() => {
        nodes.forEach((node, index) => {
            console.log(`Node ${index + 1} has ${node.sessionsTable.getCount()} sessions`);
        });
    }, 1000);

    return nodes;
};

simulateLoadBalancer();
```

### Microservices Communication

```javascript
// Simulate microservices communicating through shared data
const microservicesDemo = async () => {
    // User Service
    const userService = new TessSync({ namespace: 'microservices' });
    await userService.connect({
        redis: { host: 'localhost', port: 6379 },
        syncSchema: true
    });

    const usersTable = await userService.createTesseract('users', {
        columns: [
            { name: 'id', primaryKey: true },
            { name: 'name', type: 'string' },
            { name: 'email', type: 'string' },
            { name: 'status', type: 'string' }
        ],
        clusterSync: true,
        persistent: true
    });

    // Order Service
    const orderService = new TessSync({ namespace: 'microservices' });
    await orderService.connect({
        redis: { host: 'localhost', port: 6379 },
        syncSchema: true
    });

    const ordersTable = await orderService.createTesseract('orders', {
        columns: [
            { name: 'id', primaryKey: true },
            { name: 'userId', type: 'number' },
            { name: 'amount', type: 'number' },
            { name: 'status', type: 'string' },
            { name: 'createdAt', type: 'date' }
        ],
        clusterSync: true,
        persistent: true
    });

    // Notification Service
    const notificationService = new TessSync({ namespace: 'microservices' });
    await notificationService.connect({
        redis: { host: 'localhost', port: 6379 },
        syncSchema: true
    });

    // Pull existing tables
    const usersTableInNotification = await notificationService.pullTesseract('users');
    const ordersTableInNotification = await notificationService.pullTesseract('orders');

    // Listen for user changes in notification service
    usersTableInNotification.on('dataUpdate', (data) => {
        data.forEach(user => {
            console.log(`Notification: User ${user.name} updated (${user.status})`);
        });
    });

    // Listen for order changes in notification service
    ordersTableInNotification.on('dataUpdate', (data) => {
        data.forEach(order => {
            const user = usersTableInNotification.getById(order.userId);
            console.log(`Notification: Order ${order.id} for ${user?.name} - $${order.amount}`);
        });
    });

    // User service creates users
    await usersTable.add([
        { id: 1, name: 'Alice Johnson', email: 'alice@example.com', status: 'active' },
        { id: 2, name: 'Bob Smith', email: 'bob@example.com', status: 'active' }
    ]);

    // Order service creates orders
    setTimeout(async () => {
        await ordersTable.add([
            { id: 101, userId: 1, amount: 99.99, status: 'pending', createdAt: new Date() },
            { id: 102, userId: 2, amount: 149.99, status: 'pending', createdAt: new Date() }
        ]);
    }, 1000);

    // Update order status
    setTimeout(async () => {
        await ordersTable.update({ id: 101, status: 'completed' });
    }, 2000);

    return { userService, orderService, notificationService };
};

microservicesDemo();
```

## Best Practices

### Connection Management

```javascript
// Proper connection management with error handling
class TesseractClusterManager {
    constructor(namespace, redisConfig) {
        this.namespace = namespace;
        this.redisConfig = redisConfig;
        this.cluster = null;
        this.tables = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    async initialize() {
        try {
            this.cluster = new TessSync({ namespace: this.namespace });
            
            // Set up connection event handlers
            this.cluster.on('connect', () => {
                console.log('Redis connected');
                this.reconnectAttempts = 0;
            });

            this.cluster.on('disconnect', () => {
                console.log('Redis disconnected');
                this.handleReconnect();
            });

            this.cluster.on('error', (error) => {
                console.error('Redis error:', error);
            });

            await this.cluster.connect({
                redis: this.redisConfig,
                syncSchema: true
            });

            console.log('Cluster manager initialized');
        } catch (error) {
            console.error('Failed to initialize cluster:', error);
            throw error;
        }
    }

    async handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
        
        console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        
        setTimeout(async () => {
            try {
                await this.cluster.connect({
                    redis: this.redisConfig,
                    syncSchema: true
                });
            } catch (error) {
                console.error('Reconnection failed:', error);
                this.handleReconnect();
            }
        }, delay);
    }

    async createTable(name, options) {
        try {
            const table = await this.cluster.createTesseract(name, {
                ...options,
                clusterSync: true,
                persistent: options.persistent !== false
            });

            this.tables.set(name, table);
            console.log(`Table '${name}' created and registered`);
            return table;
        } catch (error) {
            console.error(`Failed to create table '${name}':`, error);
            throw error;
        }
    }

    async getTable(name) {
        if (this.tables.has(name)) {
            return this.tables.get(name);
        }

        try {
            const table = await this.cluster.pullTesseract(name);
            this.tables.set(name, table);
            return table;
        } catch (error) {
            console.error(`Failed to get table '${name}':`, error);
            throw error;
        }
    }

    async close() {
        if (this.cluster) {
            await this.cluster.close();
            console.log('Cluster connection closed');
        }
    }
}

// Usage example
const manager = new TesseractClusterManager('myapp', {
    host: 'localhost',
    port: 6379,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
});

manager.initialize().then(async () => {
    const userTable = await manager.createTable('users', {
        columns: [
            { name: 'id', primaryKey: true },
            { name: 'name', type: 'string' },
            { name: 'email', type: 'string' }
        ]
    });

    // Use the table...
});
```

### Performance Optimization

```javascript
// Optimized configuration for high-throughput scenarios
const optimizedClusterSetup = async () => {
    const cluster = new TessSync({ namespace: 'highperf' });
    
    await cluster.connect({
        redis: {
            host: 'localhost',
            port: 6379,
            // Optimize Redis connection
            lazyConnect: true,
            keepAlive: 30000,
            connectTimeout: 10000,
            commandTimeout: 5000,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3,
            // Use connection pooling
            family: 4,
            enableAutoPipelining: true
        },
        syncSchema: true
    });

    // Create table with optimized settings
    const highThroughputTable = await cluster.createTesseract('metrics', {
        columns: [
            { name: 'id', primaryKey: true },
            { name: 'timestamp', type: 'date' },
            { name: 'value', type: 'number' },
            { name: 'source', type: 'string', secondaryKey: true } // Index for fast queries
        ],
        clusterSync: true,
        persistent: true,
        defferedDataUpdateTime: 100 // Batch updates for better performance
    });

    console.log('High-performance cluster setup complete');
    return { cluster, highThroughputTable };
};

optimizedClusterSetup();
```
