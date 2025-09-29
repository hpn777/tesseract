# Migration and Upgrade Guide

This guide helps you migrate from older versions of Tesseract and provides best practices for upgrading your applications.

## Table of Contents
- [Version Compatibility](#version-compatibility)
- [Migration Strategies](#migration-strategies)
- [Data Migration](#data-migration)
- [API Changes](#api-changes)
- [Performance Optimizations](#performance-optimizations)
- [Troubleshooting](#troubleshooting)

## Version Compatibility

### Current Version Features

The latest version of Tesseract includes:
- Enhanced EventHorizon with improved memory management
- Optimized sorting with the new compare function
- Better Redis clustering support
- Improved session management
- Advanced expression engine capabilities

### Breaking Changes

#### From v1.x to v2.x

```javascript
// OLD (v1.x) - Direct table access
const tesseract = require('tesseract');
const table = new tesseract.Table('users', config);

// NEW (v2.x) - EventHorizon pattern
const { EventHorizon } = require('tesseract');
const eventHorizon = new EventHorizon();
const table = eventHorizon.createTesseract('users', config);
```

#### Session API Changes

```javascript
// OLD - Direct session creation
const session = table.createSession(config);

// NEW - Through EventHorizon
const session = eventHorizon.createSession({
    id: 'session-id',
    table: 'users',
    ...config
});
```

## Migration Strategies

### Gradual Migration Approach

```javascript
// Step 1: Create compatibility layer
class TesseractV1Compatibility {
    constructor() {
        this.eventHorizon = new EventHorizon();
        this.tables = new Map();
    }
    
    // V1 compatible table creation
    createTable(name, config) {
        const table = this.eventHorizon.createTesseract(name, config);
        this.tables.set(name, table);
        
        // Add v1 compatibility methods
        table.createSession = (sessionConfig) => {
            return this.eventHorizon.createSession({
                id: `${name}_${Date.now()}`,
                table: name,
                ...sessionConfig
            });
        };
        
        return table;
    }
    
    getTable(name) {
        return this.tables.get(name);
    }
}

// Usage - allows gradual migration
const compat = new TesseractV1Compatibility();
const usersTable = compat.createTable('users', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' }
    ]
});

// This works with old code patterns
const session = usersTable.createSession({
    filter: [{ field: 'name', comparison: 'like', value: 'John' }]
});
```

### Database-First Migration

```javascript
// Migrating from external database to Tesseract
class DatabaseMigrator {
    constructor(databaseConnection, eventHorizon) {
        this.db = databaseConnection;
        this.eventHorizon = eventHorizon;
    }
    
    async migrateTable(tableName, config, batchSize = 1000) {
        console.log(`🔄 Starting migration of table: ${tableName}`);
        
        // Create Tesseract table
        const tesseractTable = this.eventHorizon.createTesseract(tableName, config);
        
        // Get total record count
        const totalQuery = `SELECT COUNT(*) as total FROM ${tableName}`;
        const totalResult = await this.db.query(totalQuery);
        const totalRecords = totalResult[0].total;
        
        console.log(`📊 Total records to migrate: ${totalRecords}`);
        
        let offset = 0;
        let migratedCount = 0;
        
        while (offset < totalRecords) {
            // Fetch batch
            const batchQuery = `SELECT * FROM ${tableName} LIMIT ${batchSize} OFFSET ${offset}`;
            const batchData = await this.db.query(batchQuery);
            
            if (batchData.length === 0) break;
            
            // Transform data if needed
            const transformedData = this.transformData(batchData, config);
            
            // Insert into Tesseract
            tesseractTable.add(transformedData);
            
            migratedCount += batchData.length;
            offset += batchSize;
            
            const progress = Math.round((migratedCount / totalRecords) * 100);
            console.log(`📈 Migration progress: ${progress}% (${migratedCount}/${totalRecords})`);
            
            // Yield control to prevent blocking
            await this.sleep(10);
        }
        
        console.log(`✅ Migration completed: ${tableName} (${migratedCount} records)`);
        return tesseractTable;
    }
    
    transformData(rows, config) {
        return rows.map(row => {
            const transformed = {};
            
            // Apply column transformations
            config.columns.forEach(col => {
                if (row.hasOwnProperty(col.name)) {
                    let value = row[col.name];
                    
                    // Type conversions
                    switch (col.type) {
                        case 'date':
                            value = new Date(value);
                            break;
                        case 'number':
                            value = parseFloat(value);
                            break;
                        case 'boolean':
                            value = Boolean(value);
                            break;
                        case 'string':
                            value = String(value);
                            break;
                    }
                    
                    transformed[col.name] = value;
                }
            });
            
            return transformed;
        });
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Example usage
/*
const migrator = new DatabaseMigrator(mysqlConnection, eventHorizon);

await migrator.migrateTable('users', {
    columns: [
        { name: 'id', primaryKey: true, type: 'number' },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'created_at', type: 'date' },
        { name: 'is_active', type: 'boolean' }
    ]
});
*/
```

## Data Migration

### Backup and Restore

```javascript
// Data backup utility
class TesseractBackup {
    constructor(eventHorizon) {
        this.eventHorizon = eventHorizon;
    }
    
    async backupTable(tableName, filePath) {
        const table = this.eventHorizon.getTesseract(tableName);
        if (!table) {
            throw new Error(`Table ${tableName} not found`);
        }
        
        const backup = {
            metadata: {
                tableName: tableName,
                backupDate: new Date().toISOString(),
                version: '2.0',
                recordCount: table.getData().length
            },
            schema: table.getSchema ? table.getSchema() : null,
            data: table.getData()
        };
        
        const fs = require('fs');
        const backupJson = JSON.stringify(backup, null, 2);
        fs.writeFileSync(filePath, backupJson);
        
        console.log(`✅ Backup created: ${filePath} (${backup.metadata.recordCount} records)`);
        return backup;
    }
    
    async restoreTable(filePath, newTableName = null) {
        const fs = require('fs');
        const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        const tableName = newTableName || backupData.metadata.tableName;
        
        console.log(`🔄 Restoring table: ${tableName} from ${filePath}`);
        console.log(`📊 Records to restore: ${backupData.metadata.recordCount}`);
        
        // Recreate table with schema if available
        let table;
        if (backupData.schema) {
            table = this.eventHorizon.createTesseract(tableName, backupData.schema);
        } else {
            // Infer schema from data
            const inferredSchema = this.inferSchema(backupData.data);
            table = this.eventHorizon.createTesseract(tableName, inferredSchema);
        }
        
        // Restore data in batches
        const batchSize = 1000;
        const data = backupData.data;
        
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            table.add(batch);
            
            const progress = Math.round(((i + batch.length) / data.length) * 100);
            console.log(`📈 Restore progress: ${progress}%`);
        }
        
        console.log(`✅ Restore completed: ${tableName}`);
        return table;
    }
    
    inferSchema(data) {
        if (data.length === 0) {
            throw new Error('Cannot infer schema from empty data');
        }
        
        const sample = data[0];
        const columns = Object.keys(sample).map(key => {
            const value = sample[key];
            let type = 'string';
            
            if (typeof value === 'number') {
                type = 'number';
            } else if (typeof value === 'boolean') {
                type = 'boolean';
            } else if (value instanceof Date) {
                type = 'date';
            } else if (typeof value === 'string' && !isNaN(Date.parse(value))) {
                type = 'date';
            }
            
            return {
                name: key,
                type: type,
                primaryKey: key === 'id'
            };
        });
        
        return { columns };
    }
}

// Example backup/restore usage
const backup = new TesseractBackup(eventHorizon);

// Create backup
/*
await backup.backupTable('users', './backups/users_backup.json');

// Restore from backup
await backup.restoreTable('./backups/users_backup.json', 'users_restored');
*/
```

### Schema Evolution

```javascript
// Schema migration utility
class SchemaMigrator {
    constructor(eventHorizon) {
        this.eventHorizon = eventHorizon;
        this.migrations = [];
    }
    
    addMigration(version, migration) {
        this.migrations.push({ version, migration });
        this.migrations.sort((a, b) => a.version - b.version);
    }
    
    async migrate(tableName, currentVersion, targetVersion) {
        console.log(`🔄 Migrating ${tableName} from v${currentVersion} to v${targetVersion}`);
        
        const applicableMigrations = this.migrations.filter(m => 
            m.version > currentVersion && m.version <= targetVersion
        );
        
        let table = this.eventHorizon.getTesseract(tableName);
        
        for (const { version, migration } of applicableMigrations) {
            console.log(`⚡ Applying migration v${version}`);
            table = await migration(table, this.eventHorizon);
            console.log(`✅ Migration v${version} completed`);
        }
        
        return table;
    }
}

// Define migrations
const schemaMigrator = new SchemaMigrator(eventHorizon);

// Migration v1 -> v2: Add email column
schemaMigrator.addMigration(2, async (table, eventHorizon) => {
    const currentData = table.getData();
    const tableName = 'users'; // Would get this dynamically in real implementation
    
    // Create new table with additional column
    const newTable = eventHorizon.createTesseract(tableName + '_v2', {
        columns: [
            { name: 'id', primaryKey: true, type: 'number' },
            { name: 'name', type: 'string' },
            { name: 'email', type: 'string' }, // New column
            { name: 'created_at', type: 'date' }
        ]
    });
    
    // Migrate data with new column
    const migratedData = currentData.map(row => ({
        ...row,
        email: row.email || `${row.name.toLowerCase().replace(' ', '.')}@example.com`
    }));
    
    newTable.add(migratedData);
    
    // Replace old table
    eventHorizon.removeTesseract(tableName);
    eventHorizon.renameTesseract(tableName + '_v2', tableName);
    
    return newTable;
});

// Migration v2 -> v3: Add computed columns
schemaMigrator.addMigration(3, async (table, eventHorizon) => {
    const tableName = 'users';
    const currentData = table.getData();
    
    const enhancedTable = eventHorizon.createTesseract(tableName + '_v3', {
        columns: [
            { name: 'id', primaryKey: true, type: 'number' },
            { name: 'name', type: 'string' },
            { name: 'email', type: 'string' },
            { name: 'created_at', type: 'date' },
            {
                name: 'account_age_days',
                expression: '(Date.now() - created_at.getTime()) / (1000 * 60 * 60 * 24)'
            },
            {
                name: 'display_name',
                expression: 'name + " <" + email + ">"'
            }
        ]
    });
    
    enhancedTable.add(currentData);
    
    eventHorizon.removeTesseract(tableName);
    eventHorizon.renameTesseract(tableName + '_v3', tableName);
    
    return enhancedTable;
});

// Example usage
/*
await schemaMigrator.migrate('users', 1, 3);
*/
```

## API Changes

### Updated Sorting API

```javascript
// OLD - Custom sorting functions
const oldSession = table.createSession({
    sort: [
        { 
            field: 'name',
            direction: 'asc',
            compareFn: (a, b) => a.localeCompare(b)
        }
    ]
});

// NEW - Using enhanced compare utility
const { compare } = require('./lib/utils');

const newSession = eventHorizon.createSession({
    id: 'sorted-session',
    table: 'users',
    sort: [
        { 
            field: 'name',
            direction: 'asc'
            // compareFn automatically uses optimized compare function
        },
        {
            field: 'created_at',
            direction: 'desc'
            // Handles dates automatically
        }
    ]
});

// Manual sorting with new compare function
const manualSort = (data) => {
    return data.sort((a, b) => {
        // Compare by name first
        let result = compare(a.name, b.name);
        if (result !== 0) return result;
        
        // Then by date (newest first)
        return compare(b.created_at, a.created_at);
    });
};
```

### Enhanced Filter API

```javascript
// OLD - Basic filters only
const oldFilters = [
    { field: 'status', value: 'active' }
];

// NEW - Enhanced filtering with custom expressions
const newFilters = [
    // Traditional field filters still work
    { field: 'status', comparison: '==', value: 'active' },
    
    // New custom expression filters
    { 
        type: 'custom',
        value: 'created_at > "2023-01-01" && name ~ "John"'
    },
    
    // Array membership
    { 
        field: 'department',
        comparison: 'in',
        value: ['Engineering', 'Sales', 'Marketing']
    },
    
    // Range queries
    {
        field: 'salary',
        comparison: 'between',
        value: [50000, 100000]
    }
];

// Apply enhanced filters
const enhancedSession = eventHorizon.createSession({
    id: 'enhanced-filters',
    table: 'employees',
    filter: newFilters
});
```

### Event System Updates

```javascript
// OLD - Basic event handling
table.on('change', (data) => {
    console.log('Data changed:', data.length);
});

// NEW - Granular event handling
table.on('add', (newRows) => {
    console.log('Rows added:', newRows.length);
    newRows.forEach(row => {
        console.log('New employee:', row.name);
    });
});

table.on('update', (updatedRows) => {
    console.log('Rows updated:', updatedRows.length);
    updatedRows.forEach(row => {
        console.log('Updated employee:', row.name);
    });
});

table.on('remove', (removedRows) => {
    console.log('Rows removed:', removedRows.length);
});

// Session-level events
const session = eventHorizon.createSession({
    id: 'monitored-session',
    table: 'employees'
});

session.on('data', (sessionData) => {
    console.log('Session data updated:', sessionData.length);
});

session.on('filterChange', (filteredData, filterInfo) => {
    console.log('Filter results changed:', filteredData.length);
});
```

## Performance Optimizations

### Memory Management

```javascript
// Memory optimization strategies
class MemoryOptimizedTesseract {
    constructor(eventHorizon) {
        this.eventHorizon = eventHorizon;
        this.cleanupIntervals = new Map();
    }
    
    createTable(name, config, memoryConfig = {}) {
        const table = this.eventHorizon.createTesseract(name, {
            ...config,
            // Enable memory optimization features
            secondaryIndexes: true,
            compressionThreshold: memoryConfig.compressionThreshold || 10000
        });
        
        // Set up automatic cleanup
        if (memoryConfig.autoCleanup) {
            this.setupAutoCleanup(name, table, memoryConfig.autoCleanup);
        }
        
        return table;
    }
    
    setupAutoCleanup(tableName, table, cleanupConfig) {
        const interval = setInterval(() => {
            this.performCleanup(table, cleanupConfig);
        }, cleanupConfig.interval || 300000); // Default 5 minutes
        
        this.cleanupIntervals.set(tableName, interval);
    }
    
    performCleanup(table, config) {
        const data = table.getData();
        const now = Date.now();
        
        // Remove old records
        if (config.maxAge) {
            const cutoffTime = now - config.maxAge;
            const oldRecords = data.filter(row => {
                const recordTime = row.created_at ? row.created_at.getTime() : row.timestamp;
                return recordTime < cutoffTime;
            });
            
            if (oldRecords.length > 0) {
                table.remove({
                    filter: [{
                        type: 'custom',
                        value: `(created_at ? created_at.getTime() : timestamp) < ${cutoffTime}`
                    }]
                });
                console.log(`🧹 Cleaned up ${oldRecords.length} old records`);
            }
        }
        
        // Limit total records
        if (config.maxRecords && data.length > config.maxRecords) {
            const excessCount = data.length - config.maxRecords;
            const sortedData = data.sort((a, b) => {
                const aTime = a.created_at ? a.created_at.getTime() : a.timestamp;
                const bTime = b.created_at ? b.created_at.getTime() : b.timestamp;
                return aTime - bTime; // Oldest first
            });
            
            const idsToRemove = sortedData.slice(0, excessCount).map(row => row.id);
            
            table.remove({
                filter: [{
                    field: 'id',
                    comparison: 'in',
                    value: idsToRemove
                }]
            });
            
            console.log(`🧹 Removed ${excessCount} excess records`);
        }
    }
    
    // Graceful cleanup
    destroy(tableName) {
        const interval = this.cleanupIntervals.get(tableName);
        if (interval) {
            clearInterval(interval);
            this.cleanupIntervals.delete(tableName);
        }
    }
}

// Usage
const optimizedTesseract = new MemoryOptimizedTesseract(eventHorizon);

const efficientTable = optimizedTesseract.createTable('sensor_data', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'timestamp', type: 'date' },
        { name: 'sensor_id', type: 'string', secondaryKey: true },
        { name: 'value', type: 'number' }
    ]
}, {
    autoCleanup: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        maxRecords: 100000,
        interval: 600000 // 10 minutes
    },
    compressionThreshold: 50000
});
```

### Query Optimization

```javascript
// Query performance improvements
class QueryOptimizer {
    constructor(eventHorizon) {
        this.eventHorizon = eventHorizon;
        this.queryCache = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;
    }
    
    createOptimizedSession(config) {
        // Generate cache key
        const cacheKey = this.generateCacheKey(config);
        
        // Check cache
        if (this.queryCache.has(cacheKey)) {
            this.cacheHits++;
            console.log(`📊 Query cache hit (${this.cacheHits} hits, ${this.cacheMisses} misses)`);
            return this.queryCache.get(cacheKey);
        }
        
        // Create session with optimizations
        const optimizedConfig = this.optimizeQuery(config);
        const session = this.eventHorizon.createSession(optimizedConfig);
        
        // Cache the session
        this.queryCache.set(cacheKey, session);
        this.cacheMisses++;
        
        // Set up cache invalidation
        this.setupCacheInvalidation(cacheKey, config.table);
        
        return session;
    }
    
    optimizeQuery(config) {
        const optimized = { ...config };
        
        // Optimize filters - put indexed filters first
        if (optimized.filter) {
            optimized.filter = this.optimizeFilters(optimized.filter);
        }
        
        // Optimize sorting - use secondary keys when possible
        if (optimized.sort) {
            optimized.sort = this.optimizeSorting(optimized.sort);
        }
        
        // Add performance hints
        optimized.useIndexes = true;
        optimized.batchSize = optimized.batchSize || 1000;
        
        return optimized;
    }
    
    optimizeFilters(filters) {
        // Sort filters: indexed fields first, custom expressions last
        return filters.sort((a, b) => {
            const aScore = this.getFilterScore(a);
            const bScore = this.getFilterScore(b);
            return bScore - aScore; // Higher score first
        });
    }
    
    getFilterScore(filter) {
        // Higher scores = better performance
        if (filter.field && filter.field.endsWith('_id')) return 100; // Primary keys
        if (filter.field && filter.comparison === '==') return 80; // Exact matches
        if (filter.field && filter.comparison === 'in') return 70; // Array membership
        if (filter.field) return 50; // Field filters
        if (filter.type === 'custom') return 10; // Custom expressions
        return 0;
    }
    
    optimizeSorting(sort) {
        // Prefer sorting by indexed fields
        return sort.sort((a, b) => {
            const aScore = a.field.endsWith('_id') ? 100 : 50;
            const bScore = b.field.endsWith('_id') ? 100 : 50;
            return bScore - aScore;
        });
    }
    
    generateCacheKey(config) {
        return JSON.stringify({
            table: config.table,
            filter: config.filter,
            sort: config.sort,
            columns: config.columns
        });
    }
    
    setupCacheInvalidation(cacheKey, tableName) {
        const table = this.eventHorizon.getTesseract(tableName);
        if (table) {
            const invalidateCache = () => {
                this.queryCache.delete(cacheKey);
                console.log('🗑️  Query cache invalidated');
            };
            
            table.on('add', invalidateCache);
            table.on('update', invalidateCache);
            table.on('remove', invalidateCache);
        }
    }
    
    clearCache() {
        this.queryCache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        console.log('🧹 Query cache cleared');
    }
    
    getCacheStats() {
        const total = this.cacheHits + this.cacheMisses;
        const hitRate = total > 0 ? (this.cacheHits / total * 100).toFixed(1) : 0;
        
        return {
            hits: this.cacheHits,
            misses: this.cacheMisses,
            hitRate: hitRate + '%',
            cacheSize: this.queryCache.size
        };
    }
}

// Usage
const queryOptimizer = new QueryOptimizer(eventHorizon);

const optimizedSession = queryOptimizer.createOptimizedSession({
    id: 'high-performance-query',
    table: 'employees',
    filter: [
        { field: 'department', comparison: '==', value: 'Engineering' },
        { type: 'custom', value: 'salary > 75000' }
    ],
    sort: [
        { field: 'employee_id', direction: 'asc' }
    ]
});

// Check cache performance
setInterval(() => {
    console.log('📊 Query Cache Stats:', queryOptimizer.getCacheStats());
}, 60000);
```

## Troubleshooting

### Common Issues and Solutions

```javascript
// Troubleshooting utilities
class TesseractTroubleshooter {
    constructor(eventHorizon) {
        this.eventHorizon = eventHorizon;
    }
    
    diagnoseTable(tableName) {
        const table = this.eventHorizon.getTesseract(tableName);
        if (!table) {
            return { error: `Table '${tableName}' not found` };
        }
        
        const data = table.getData();
        const diagnosis = {
            tableName: tableName,
            recordCount: data.length,
            memoryUsage: this.estimateMemoryUsage(data),
            columnAnalysis: this.analyzeColumns(data),
            performanceIssues: this.detectPerformanceIssues(data),
            recommendations: []
        };
        
        // Generate recommendations
        this.generateRecommendations(diagnosis);
        
        return diagnosis;
    }
    
    estimateMemoryUsage(data) {
        if (data.length === 0) return { estimated: '0 KB' };
        
        const sampleRow = JSON.stringify(data[0]);
        const avgRowSize = sampleRow.length;
        const totalSize = avgRowSize * data.length;
        
        return {
            estimated: this.formatBytes(totalSize),
            avgRowSize: this.formatBytes(avgRowSize),
            totalRows: data.length
        };
    }
    
    analyzeColumns(data) {
        if (data.length === 0) return {};
        
        const analysis = {};
        const sample = data[0];
        
        Object.keys(sample).forEach(column => {
            const values = data.map(row => row[column]).filter(v => v != null);
            const uniqueValues = new Set(values);
            
            analysis[column] = {
                type: typeof values[0],
                uniqueCount: uniqueValues.size,
                nullCount: data.length - values.length,
                cardinality: uniqueValues.size / data.length,
                sampleValues: Array.from(uniqueValues).slice(0, 5)
            };
        });
        
        return analysis;
    }
    
    detectPerformanceIssues(data) {
        const issues = [];
        
        // Large dataset without indexes
        if (data.length > 10000) {
            issues.push({
                type: 'performance',
                severity: 'warning',
                message: 'Large dataset detected. Consider adding secondary indexes.',
                recommendation: 'Add secondaryKey: true to frequently queried columns'
            });
        }
        
        // High memory usage
        const estimatedSize = JSON.stringify(data).length;
        if (estimatedSize > 10 * 1024 * 1024) { // 10MB
            issues.push({
                type: 'memory',
                severity: 'warning',
                message: 'High memory usage detected.',
                recommendation: 'Consider implementing data cleanup or pagination'
            });
        }
        
        return issues;
    }
    
    generateRecommendations(diagnosis) {
        const recs = diagnosis.recommendations;
        
        // Column-based recommendations
        Object.entries(diagnosis.columnAnalysis).forEach(([column, analysis]) => {
            if (analysis.cardinality < 0.1 && analysis.uniqueCount > 1) {
                recs.push(`Consider adding secondary index to '${column}' (low cardinality)`);
            }
            
            if (analysis.nullCount > diagnosis.recordCount * 0.5) {
                recs.push(`Column '${column}' has high null rate (${analysis.nullCount} nulls)`);
            }
        });
        
        // Performance recommendations
        diagnosis.performanceIssues.forEach(issue => {
            recs.push(issue.recommendation);
        });
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Performance test
    async runPerformanceTest(tableName, operations = 1000) {
        console.log(`🧪 Running performance test on ${tableName} (${operations} operations)`);
        
        const table = this.eventHorizon.getTesseract(tableName);
        if (!table) {
            throw new Error(`Table '${tableName}' not found`);
        }
        
        const results = {
            tableName: tableName,
            operations: operations,
            tests: {}
        };
        
        // Test data insertion
        const insertStart = Date.now();
        const testData = Array.from({ length: operations }, (_, i) => ({
            id: `test_${i}`,
            timestamp: new Date(),
            value: Math.random() * 100,
            category: ['A', 'B', 'C'][i % 3]
        }));
        
        table.add(testData);
        results.tests.insertion = {
            duration: Date.now() - insertStart,
            throughput: Math.round(operations / ((Date.now() - insertStart) / 1000))
        };
        
        // Test querying
        const queryStart = Date.now();
        for (let i = 0; i < 100; i++) {
            const session = this.eventHorizon.createSession({
                id: `test_query_${i}`,
                table: tableName,
                filter: [{ field: 'category', comparison: '==', value: 'A' }]
            });
            session.getData();
        }
        results.tests.querying = {
            duration: Date.now() - queryStart,
            queriesPerSecond: Math.round(100 / ((Date.now() - queryStart) / 1000))
        };
        
        // Cleanup test data
        table.remove({
            filter: [{ field: 'id', comparison: 'like', value: 'test_' }]
        });
        
        console.log('🏁 Performance test completed:', results);
        return results;
    }
}

// Usage
const troubleshooter = new TesseractTroubleshooter(eventHorizon);

// Diagnose a table
const diagnosis = troubleshooter.diagnoseTable('employees');
console.log('🔍 Table Diagnosis:', diagnosis);

// Run performance test
/*
await troubleshooter.runPerformanceTest('employees', 5000);
*/
```

### Debug Mode

```javascript
// Debug utilities
class TesseractDebugger {
    constructor(eventHorizon) {
        this.eventHorizon = eventHorizon;
        this.debugMode = false;
        this.logs = [];
    }
    
    enableDebug(enabled = true) {
        this.debugMode = enabled;
        
        if (enabled) {
            console.log('🐛 Debug mode enabled');
            this.setupDebugHandlers();
        } else {
            console.log('🐛 Debug mode disabled');
        }
    }
    
    setupDebugHandlers() {
        // Override console methods to capture logs
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        
        console.log = (...args) => {
            if (this.debugMode) {
                this.logs.push({ type: 'log', timestamp: new Date(), args });
            }
            originalLog.apply(console, args);
        };
        
        console.error = (...args) => {
            if (this.debugMode) {
                this.logs.push({ type: 'error', timestamp: new Date(), args });
            }
            originalError.apply(console, args);
        };
        
        console.warn = (...args) => {
            if (this.debugMode) {
                this.logs.push({ type: 'warn', timestamp: new Date(), args });
            }
            originalWarn.apply(console, args);
        };
    }
    
    getDebugLogs(filterType = null) {
        let logs = this.logs;
        
        if (filterType) {
            logs = logs.filter(log => log.type === filterType);
        }
        
        return logs.map(log => ({
            type: log.type,
            timestamp: log.timestamp.toISOString(),
            message: log.args.join(' ')
        }));
    }
    
    clearDebugLogs() {
        this.logs = [];
        console.log('🧹 Debug logs cleared');
    }
    
    exportDebugLogs(filePath) {
        const fs = require('fs');
        const exportData = {
            exportDate: new Date().toISOString(),
            logCount: this.logs.length,
            logs: this.getDebugLogs()
        };
        
        fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
        console.log(`📁 Debug logs exported to: ${filePath}`);
    }
}

// Usage
const debugger = new TesseractDebugger(eventHorizon);

// Enable debug mode during migration
debugger.enableDebug(true);

// ... perform migration operations ...

// Export debug logs for analysis
/*
debugger.exportDebugLogs('./debug_logs.json');
*/

console.log('📚 Migration and upgrade guide loaded');
console.log('🔧 Troubleshooting utilities available');
console.log('🐛 Debug mode ready for activation');
```

This migration guide provides comprehensive tools and strategies for upgrading Tesseract applications, including data migration utilities, schema evolution tools, performance optimization techniques, and troubleshooting utilities.
