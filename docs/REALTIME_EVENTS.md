# Real-time Events and Data Streaming

This guide covers Tesseract's powerful real-time event system and data streaming capabilities.

## Table of Contents
- [Event System Overview](#event-system-overview)
- [Table Events](#table-events)
- [Session Events](#session-events)
- [Custom Event Handlers](#custom-event-handlers)
- [Data Streaming](#data-streaming)
- [Event Aggregation](#event-aggregation)
- [Performance Monitoring](#performance-monitoring)

## Event System Overview

Tesseract uses an event-driven architecture to provide real-time updates when data changes occur.

### Basic Event Setup

```javascript
const { EventHorizon } = require('../index');
const eventHorizon = new EventHorizon();

// Create a table with event tracking
const realtimeTable = eventHorizon.createTesseract('realtime_data', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'timestamp', type: 'date' },
        { name: 'sensor', type: 'string' },
        { name: 'temperature', type: 'number' },
        { name: 'humidity', type: 'number' },
        { name: 'status', type: 'string' }
    ]
});

// Basic event listener for all data changes
eventHorizon.on('update', (tableName, eventData) => {
    console.log(`Table ${tableName} updated:`, eventData);
});

// Add initial data
realtimeTable.add([
    { id: 1, timestamp: new Date(), sensor: 'Sensor_A', temperature: 23.5, humidity: 45.0, status: 'normal' },
    { id: 2, timestamp: new Date(), sensor: 'Sensor_B', temperature: 24.2, humidity: 48.5, status: 'normal' }
]);

console.log('Basic event system initialized');
```

## Table Events

### Row Addition Events

```javascript
// Listen for new row additions
realtimeTable.on('add', (rows) => {
    console.log(`${rows.length} new rows added:`);
    rows.forEach(row => {
        console.log(`  - Sensor ${row.sensor}: ${row.temperature}°C, ${row.humidity}% humidity`);
        
        // Trigger alerts for abnormal readings
        if (row.temperature > 30 || row.humidity > 70) {
            console.log(`    ⚠️  ALERT: Abnormal reading from ${row.sensor}`);
            
            // You could send notifications, log to external systems, etc.
            handleTemperatureAlert(row);
        }
    });
});

// Function to handle temperature alerts
function handleTemperatureAlert(sensorData) {
    console.log(`🚨 Temperature alert: ${sensorData.sensor} reading ${sensorData.temperature}°C`);
    
    // Example: Update status and log
    realtimeTable.update({
        filter: [{ field: 'id', comparison: '==', value: sensorData.id }],
        update: { status: 'alert' }
    });
}

// Simulate sensor data coming in
setInterval(() => {
    const sensorId = Math.random() > 0.5 ? 'Sensor_A' : 'Sensor_B';
    const temperature = 20 + Math.random() * 15; // 20-35°C
    const humidity = 40 + Math.random() * 35;    // 40-75%
    
    realtimeTable.add({
        id: Date.now(),
        timestamp: new Date(),
        sensor: sensorId,
        temperature: Math.round(temperature * 10) / 10,
        humidity: Math.round(humidity * 10) / 10,
        status: 'normal'
    });
}, 2000); // New reading every 2 seconds
```

### Row Update Events

```javascript
// Listen for row updates
realtimeTable.on('update', (updatedRows) => {
    console.log(`${updatedRows.length} rows updated:`);
    updatedRows.forEach(row => {
        console.log(`  - ${row.sensor} status changed to: ${row.status}`);
        
        if (row.status === 'alert') {
            console.log(`    🔔 Alert status set for ${row.sensor} at ${row.timestamp}`);
        } else if (row.status === 'normal') {
            console.log(`    ✅ ${row.sensor} returned to normal`);
        }
    });
});

// Listen for row deletions
realtimeTable.on('remove', (removedRows) => {
    console.log(`${removedRows.length} rows removed:`);
    removedRows.forEach(row => {
        console.log(`  - Removed data for ${row.sensor} from ${row.timestamp}`);
    });
});

// Example: Clean up old data periodically
setInterval(() => {
    const cutoffTime = new Date(Date.now() - 60000); // Remove data older than 1 minute
    const oldDataCount = realtimeTable.getData().filter(row => row.timestamp < cutoffTime).length;
    
    if (oldDataCount > 0) {
        realtimeTable.remove({
            filter: [{ 
                type: 'custom', 
                value: `timestamp < "${cutoffTime.toISOString()}"` 
            }]
        });
        console.log(`🧹 Cleaned up ${oldDataCount} old sensor readings`);
    }
}, 30000); // Check every 30 seconds
```

### Batch Operation Events

```javascript
// Listen for batch operations
realtimeTable.on('batch', (batchInfo) => {
    console.log('Batch operation completed:', {
        operation: batchInfo.operation,
        affectedRows: batchInfo.count,
        duration: batchInfo.duration + 'ms'
    });
    
    if (batchInfo.operation === 'bulkInsert' && batchInfo.count > 10) {
        console.log('📊 Large data batch received - updating dashboard...');
        updateDashboard();
    }
});

function updateDashboard() {
    const recentData = realtimeTable.getData()
        .filter(row => row.timestamp > new Date(Date.now() - 300000)) // Last 5 minutes
        .sort((a, b) => b.timestamp - a.timestamp);
        
    const avgTemp = recentData.reduce((sum, row) => sum + row.temperature, 0) / recentData.length;
    const avgHumidity = recentData.reduce((sum, row) => sum + row.humidity, 0) / recentData.length;
    const alertCount = recentData.filter(row => row.status === 'alert').length;
    
    console.log('📈 Dashboard Update:', {
        avgTemperature: Math.round(avgTemp * 10) / 10,
        avgHumidity: Math.round(avgHumidity * 10) / 10,
        alertCount: alertCount,
        totalReadings: recentData.length
    });
}
```

## Session Events

### Session Data Changes

```javascript
// Create a session with real-time filtering
const alertSession = eventHorizon.createSession({
    id: 'alert-monitor',
    table: 'realtime_data',
    filter: [
        { field: 'status', comparison: '==', value: 'alert' }
    ],
    columns: [
        { name: 'timestamp' },
        { name: 'sensor' },
        { name: 'temperature' },
        { name: 'humidity' },
        { name: 'status' }
    ]
});

// Listen to session data changes
alertSession.on('data', (sessionData) => {
    console.log(`🚨 Alert Session Update - ${sessionData.length} active alerts:`);
    sessionData.forEach(alert => {
        console.log(`  - ${alert.sensor}: ${alert.temperature}°C (${alert.timestamp})`);
    });
    
    // Trigger escalation for multiple alerts
    if (sessionData.length >= 2) {
        console.log('🔥 MULTIPLE ALERTS DETECTED - Escalating to supervisor');
        escalateAlerts(sessionData);
    }
});

function escalateAlerts(alerts) {
    console.log('📧 Sending escalation notification...');
    console.log('Alert summary:', alerts.map(a => `${a.sensor}: ${a.temperature}°C`).join(', '));
    
    // In a real application, you might:
    // - Send email notifications
    // - Push to mobile app
    // - Log to external monitoring system
    // - Trigger automated responses
}

// Session for temperature trends
const temperatureTrendSession = eventHorizon.createSession({
    id: 'temp-trends',
    table: 'realtime_data',
    groupBy: ['sensor'],
    aggregates: [
        { 
            type: 'avg', 
            field: 'temperature',
            as: 'avgTemp'
        },
        { 
            type: 'max', 
            field: 'temperature',
            as: 'maxTemp'
        },
        { 
            type: 'count',
            as: 'readingCount'
        }
    ]
});

temperatureTrendSession.on('data', (trendData) => {
    console.log('🌡️  Temperature Trends Update:');
    trendData.forEach(trend => {
        const avgTemp = Math.round(trend.avgTemp * 10) / 10;
        const maxTemp = Math.round(trend.maxTemp * 10) / 10;
        console.log(`  ${trend.sensor}: Avg ${avgTemp}°C, Max ${maxTemp}°C (${trend.readingCount} readings)`);
        
        // Check for concerning trends
        if (trend.avgTemp > 28) {
            console.log(`    ⚠️  ${trend.sensor} average temperature is elevated`);
        }
    });
});
```

### Session Filter Changes

```javascript
// Dynamic session filtering with events
const dynamicFilterSession = eventHorizon.createSession({
    id: 'dynamic-filter',
    table: 'realtime_data',
    filter: [
        { field: 'temperature', comparison: '>', value: 25 }
    ]
});

// Listen for filter result changes
dynamicFilterSession.on('filterChange', (filteredData, filterInfo) => {
    console.log(`Filter changed - now showing ${filteredData.length} rows`);
    console.log('Current filter:', filterInfo);
    
    if (filteredData.length === 0) {
        console.log('✅ All readings are within normal temperature range');
    } else {
        console.log(`⚠️  ${filteredData.length} readings above 25°C`);
    }
});

// Example: Dynamically adjust filters based on conditions
setInterval(() => {
    const currentData = realtimeTable.getData();
    const avgTemp = currentData.reduce((sum, row) => sum + row.temperature, 0) / currentData.length;
    
    // Adjust threshold based on average temperature
    const newThreshold = avgTemp > 26 ? 28 : 25;
    
    dynamicFilterSession.updateFilter([
        { field: 'temperature', comparison: '>', value: newThreshold }
    ]);
    
    console.log(`🔄 Updated temperature threshold to ${newThreshold}°C (avg: ${Math.round(avgTemp * 10) / 10}°C)`);
}, 45000); // Update every 45 seconds
```

## Custom Event Handlers

### Event Filtering and Routing

```javascript
// Create a comprehensive event router
class EventRouter {
    constructor(eventHorizon) {
        this.eventHorizon = eventHorizon;
        this.handlers = new Map();
        this.setupGlobalHandlers();
    }
    
    setupGlobalHandlers() {
        // Route all events through central handler
        this.eventHorizon.on('update', (tableName, eventData) => {
            this.routeEvent('table.update', tableName, eventData);
        });
        
        this.eventHorizon.on('add', (tableName, eventData) => {
            this.routeEvent('table.add', tableName, eventData);
        });
    }
    
    routeEvent(eventType, tableName, eventData) {
        const key = `${eventType}.${tableName}`;
        
        if (this.handlers.has(key)) {
            this.handlers.get(key).forEach(handler => {
                try {
                    handler(eventData, { eventType, tableName });
                } catch (error) {
                    console.error(`Error in event handler for ${key}:`, error);
                }
            });
        }
        
        // Global handlers
        if (this.handlers.has(eventType)) {
            this.handlers.get(eventType).forEach(handler => {
                try {
                    handler(eventData, { eventType, tableName });
                } catch (error) {
                    console.error(`Error in global event handler for ${eventType}:`, error);
                }
            });
        }
    }
    
    on(eventPattern, handler) {
        if (!this.handlers.has(eventPattern)) {
            this.handlers.set(eventPattern, []);
        }
        this.handlers.get(eventPattern).push(handler);
    }
    
    off(eventPattern, handler) {
        if (this.handlers.has(eventPattern)) {
            const handlers = this.handlers.get(eventPattern);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
}

// Initialize event router
const eventRouter = new EventRouter(eventHorizon);

// Register specific handlers
eventRouter.on('table.add.realtime_data', (eventData) => {
    console.log('📊 New sensor data received:', eventData.length, 'readings');
    
    // Process each new reading
    eventData.forEach(reading => {
        if (reading.temperature > 30) {
            console.log(`🔥 High temperature alert: ${reading.sensor} at ${reading.temperature}°C`);
        }
        
        if (reading.humidity > 70) {
            console.log(`💧 High humidity alert: ${reading.sensor} at ${reading.humidity}%`);
        }
    });
});

// Global handler for all table updates
eventRouter.on('table.update', (eventData, context) => {
    console.log(`🔄 Table ${context.tableName} updated with ${eventData.length} changes`);
});
```

### Event Debouncing and Throttling

```javascript
// Utility functions for event control
class EventController {
    static debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    static throttle(func, interval) {
        let lastCall = 0;
        return function (...args) {
            const now = Date.now();
            if (now - lastCall >= interval) {
                lastCall = now;
                return func.apply(this, args);
            }
        };
    }
}

// Debounced dashboard update - only update after data stops changing for 1 second
const debouncedDashboardUpdate = EventController.debounce(() => {
    console.log('📊 Debounced dashboard update triggered');
    updateDashboard();
}, 1000);

// Throttled alert processing - process alerts at most once every 5 seconds
const throttledAlertProcessor = EventController.throttle((alertData) => {
    console.log('🚨 Throttled alert processing:', alertData.length, 'alerts');
    processAlerts(alertData);
}, 5000);

// Apply debouncing and throttling to event handlers
realtimeTable.on('add', debouncedDashboardUpdate);
alertSession.on('data', throttledAlertProcessor);

function processAlerts(alerts) {
    const criticalAlerts = alerts.filter(alert => alert.temperature > 32);
    const warningAlerts = alerts.filter(alert => alert.temperature > 28 && alert.temperature <= 32);
    
    console.log(`  Critical: ${criticalAlerts.length}, Warnings: ${warningAlerts.length}`);
    
    if (criticalAlerts.length > 0) {
        console.log('🆘 CRITICAL ALERTS - Immediate action required');
        criticalAlerts.forEach(alert => {
            console.log(`    ${alert.sensor}: ${alert.temperature}°C`);
        });
    }
}
```

## Data Streaming

### Continuous Data Streams

```javascript
// Simulate multiple data streams
class DataStreamSimulator {
    constructor(table) {
        this.table = table;
        this.streams = new Map();
        this.isRunning = false;
    }
    
    startStream(streamId, config) {
        if (this.streams.has(streamId)) {
            console.log(`Stream ${streamId} already running`);
            return;
        }
        
        const stream = {
            id: streamId,
            config: config,
            intervalId: null,
            messageCount: 0
        };
        
        // Start the stream
        stream.intervalId = setInterval(() => {
            const data = this.generateStreamData(streamId, config);
            this.table.add(data);
            stream.messageCount++;
            
            if (stream.messageCount % 10 === 0) {
                console.log(`📡 Stream ${streamId}: ${stream.messageCount} messages sent`);
            }
        }, config.interval || 1000);
        
        this.streams.set(streamId, stream);
        console.log(`🚀 Started data stream: ${streamId}`);
    }
    
    stopStream(streamId) {
        const stream = this.streams.get(streamId);
        if (stream) {
            clearInterval(stream.intervalId);
            this.streams.delete(streamId);
            console.log(`⏹️  Stopped data stream: ${streamId} (${stream.messageCount} messages)`);
        }
    }
    
    generateStreamData(streamId, config) {
        const baseId = Date.now() + Math.random();
        
        switch (config.type) {
            case 'sensor':
                return {
                    id: baseId,
                    timestamp: new Date(),
                    sensor: streamId,
                    temperature: config.baseTemp + (Math.random() - 0.5) * config.variance,
                    humidity: config.baseHumidity + (Math.random() - 0.5) * config.variance,
                    status: Math.random() > 0.9 ? 'alert' : 'normal'
                };
                
            case 'financial':
                return {
                    id: baseId,
                    timestamp: new Date(),
                    symbol: streamId,
                    price: config.basePrice * (1 + (Math.random() - 0.5) * 0.02),
                    volume: Math.floor(Math.random() * 1000) + 100,
                    status: 'active'
                };
                
            default:
                return {
                    id: baseId,
                    timestamp: new Date(),
                    source: streamId,
                    value: Math.random() * 100,
                    status: 'normal'
                };
        }
    }
    
    stopAllStreams() {
        for (const [streamId] of this.streams) {
            this.stopStream(streamId);
        }
    }
}

// Create multiple data streams
const streamSimulator = new DataStreamSimulator(realtimeTable);

// Start sensor streams
streamSimulator.startStream('TempSensor_01', {
    type: 'sensor',
    baseTemp: 22,
    baseHumidity: 45,
    variance: 8,
    interval: 2000
});

streamSimulator.startStream('TempSensor_02', {
    type: 'sensor',
    baseTemp: 24,
    baseHumidity: 50,
    variance: 6,
    interval: 3000
});

streamSimulator.startStream('TempSensor_03', {
    type: 'sensor',
    baseTemp: 26,
    baseHumidity: 55,
    variance: 10,
    interval: 1500
});

// Stop streams after 30 seconds for demo
setTimeout(() => {
    console.log('🛑 Stopping all streams...');
    streamSimulator.stopAllStreams();
}, 30000);
```

### Stream Processing Pipeline

```javascript
// Create a processing pipeline for streaming data
class StreamProcessor {
    constructor(eventHorizon) {
        this.eventHorizon = eventHorizon;
        this.processors = [];
        this.metrics = {
            processed: 0,
            errors: 0,
            startTime: Date.now()
        };
    }
    
    addProcessor(processor) {
        this.processors.push(processor);
        return this;
    }
    
    process(data) {
        let processedData = data;
        
        for (const processor of this.processors) {
            try {
                processedData = processor(processedData);
                if (!processedData) break; // Processor filtered out the data
            } catch (error) {
                console.error('Stream processor error:', error);
                this.metrics.errors++;
                return null;
            }
        }
        
        this.metrics.processed++;
        return processedData;
    }
    
    getMetrics() {
        const runtime = Date.now() - this.metrics.startTime;
        return {
            ...this.metrics,
            runtime: runtime,
            throughput: this.metrics.processed / (runtime / 1000)
        };
    }
}

// Create processing pipeline
const streamProcessor = new StreamProcessor(eventHorizon);

// Add processing stages
streamProcessor
    .addProcessor((data) => {
        // Validation processor
        if (!data.temperature || !data.humidity || !data.sensor) {
            console.log('❌ Invalid data filtered out:', data);
            return null;
        }
        return data;
    })
    .addProcessor((data) => {
        // Enrichment processor
        return {
            ...data,
            temperatureF: (data.temperature * 9/5) + 32,
            heatIndex: calculateHeatIndex(data.temperature, data.humidity),
            severity: data.temperature > 30 ? 'high' : data.temperature < 15 ? 'low' : 'normal'
        };
    })
    .addProcessor((data) => {
        // Alert processor
        if (data.temperature > 35 || data.humidity > 80) {
            console.log('🔴 Critical alert generated for', data.sensor);
            return {
                ...data,
                status: 'critical',
                alertGenerated: true
            };
        }
        return data;
    });

function calculateHeatIndex(tempC, humidity) {
    const tempF = (tempC * 9/5) + 32;
    if (tempF < 80) return tempF;
    
    // Simplified heat index calculation
    const hi = -42.379 + 2.04901523 * tempF + 10.14333127 * humidity 
               - 0.22475541 * tempF * humidity;
    return Math.round(hi);
}

// Process streaming data through pipeline
realtimeTable.on('add', (newRows) => {
    newRows.forEach(row => {
        const processedData = streamProcessor.process(row);
        if (processedData && processedData.alertGenerated) {
            console.log('🚨 Processed alert data:', {
                sensor: processedData.sensor,
                temp: processedData.temperature,
                heatIndex: processedData.heatIndex,
                severity: processedData.severity
            });
        }
    });
    
    // Log metrics every 100 processed items
    const metrics = streamProcessor.getMetrics();
    if (metrics.processed % 100 === 0) {
        console.log('📈 Stream Processing Metrics:', {
            processed: metrics.processed,
            errors: metrics.errors,
            throughput: Math.round(metrics.throughput * 10) / 10 + ' items/sec'
        });
    }
});
```

## Event Aggregation

### Time-window Aggregations

```javascript
// Time-based event aggregation
class TimeWindowAggregator {
    constructor(windowSizeMs = 60000) { // 1 minute default
        this.windowSize = windowSizeMs;
        this.windows = new Map();
        this.aggregatedData = [];
    }
    
    addEvent(event) {
        const windowStart = Math.floor(event.timestamp.getTime() / this.windowSize) * this.windowSize;
        const windowKey = windowStart.toString();
        
        if (!this.windows.has(windowKey)) {
            this.windows.set(windowKey, {
                start: new Date(windowStart),
                end: new Date(windowStart + this.windowSize),
                events: [],
                aggregates: {}
            });
        }
        
        const window = this.windows.get(windowKey);
        window.events.push(event);
        
        // Update aggregates
        this.updateWindowAggregates(window);
        
        // Clean old windows (keep only last 10)
        this.cleanOldWindows();
        
        return window;
    }
    
    updateWindowAggregates(window) {
        const events = window.events;
        const temperatures = events.map(e => e.temperature);
        const humidities = events.map(e => e.humidity);
        
        window.aggregates = {
            count: events.length,
            avgTemp: temperatures.reduce((a, b) => a + b, 0) / temperatures.length,
            maxTemp: Math.max(...temperatures),
            minTemp: Math.min(...temperatures),
            avgHumidity: humidities.reduce((a, b) => a + b, 0) / humidities.length,
            alertCount: events.filter(e => e.status === 'alert').length,
            sensors: [...new Set(events.map(e => e.sensor))],
            sensorCount: [...new Set(events.map(e => e.sensor))].length
        };
    }
    
    cleanOldWindows() {
        const windowKeys = Array.from(this.windows.keys()).sort();
        if (windowKeys.length > 10) {
            const toRemove = windowKeys.slice(0, windowKeys.length - 10);
            toRemove.forEach(key => this.windows.delete(key));
        }
    }
    
    getCurrentWindows() {
        return Array.from(this.windows.values())
            .sort((a, b) => a.start.getTime() - b.start.getTime());
    }
    
    getLatestWindow() {
        const windows = this.getCurrentWindows();
        return windows[windows.length - 1];
    }
}

// Create time-window aggregator
const windowAggregator = new TimeWindowAggregator(30000); // 30-second windows

// Process events through aggregator
realtimeTable.on('add', (newRows) => {
    newRows.forEach(row => {
        const window = windowAggregator.addEvent(row);
        
        // Log window summary when it's updated
        console.log(`⏰ Time Window [${window.start.toLocaleTimeString()} - ${window.end.toLocaleTimeString()}]:`, {
            events: window.aggregates.count,
            avgTemp: Math.round(window.aggregates.avgTemp * 10) / 10,
            sensors: window.aggregates.sensorCount,
            alerts: window.aggregates.alertCount
        });
        
        // Trigger alerts for anomalous windows
        if (window.aggregates.alertCount > 2) {
            console.log('🔥 WINDOW ALERT: Multiple alerts in time window!');
            console.log('Window details:', window.aggregates);
        }
    });
});

// Periodic window analysis
setInterval(() => {
    const windows = windowAggregator.getCurrentWindows();
    if (windows.length >= 3) {
        const recentWindows = windows.slice(-3);
        const avgAlertRate = recentWindows.reduce((sum, w) => sum + w.aggregates.alertCount, 0) / recentWindows.length;
        
        if (avgAlertRate > 1) {
            console.log('📊 TREND ALERT: Increasing alert rate detected');
            console.log(`Recent 3 windows average: ${avgAlertRate.toFixed(1)} alerts per window`);
        }
    }
}, 45000); // Check every 45 seconds
```

## Performance Monitoring

### Event System Metrics

```javascript
// Performance monitoring for event system
class EventPerformanceMonitor {
    constructor() {
        this.metrics = {
            eventCounts: new Map(),
            processingTimes: [],
            memoryUsage: [],
            errorCounts: new Map(),
            lastReset: Date.now()
        };
        this.startMonitoring();
    }
    
    recordEvent(eventType, processingTime, error = null) {
        // Count events
        const currentCount = this.metrics.eventCounts.get(eventType) || 0;
        this.metrics.eventCounts.set(eventType, currentCount + 1);
        
        // Record processing time
        if (processingTime) {
            this.metrics.processingTimes.push({
                type: eventType,
                time: processingTime,
                timestamp: Date.now()
            });
            
            // Keep only recent times (last 1000 events)
            if (this.metrics.processingTimes.length > 1000) {
                this.metrics.processingTimes = this.metrics.processingTimes.slice(-1000);
            }
        }
        
        // Record errors
        if (error) {
            const errorCount = this.metrics.errorCounts.get(eventType) || 0;
            this.metrics.errorCounts.set(eventType, errorCount + 1);
        }
    }
    
    startMonitoring() {
        // Memory monitoring
        setInterval(() => {
            if (typeof process !== 'undefined' && process.memoryUsage) {
                const usage = process.memoryUsage();
                this.metrics.memoryUsage.push({
                    timestamp: Date.now(),
                    heapUsed: usage.heapUsed,
                    heapTotal: usage.heapTotal,
                    external: usage.external
                });
                
                // Keep only recent memory snapshots
                if (this.metrics.memoryUsage.length > 100) {
                    this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
                }
            }
        }, 5000); // Every 5 seconds
    }
    
    getReport() {
        const runtime = Date.now() - this.metrics.lastReset;
        const runtimeSeconds = runtime / 1000;
        
        // Calculate averages
        const avgProcessingTime = this.metrics.processingTimes.length > 0
            ? this.metrics.processingTimes.reduce((sum, item) => sum + item.time, 0) / this.metrics.processingTimes.length
            : 0;
        
        // Event rates
        const eventRates = new Map();
        for (const [eventType, count] of this.metrics.eventCounts) {
            eventRates.set(eventType, count / runtimeSeconds);
        }
        
        // Memory info
        const latestMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
        
        return {
            runtime: Math.round(runtimeSeconds),
            totalEvents: Array.from(this.metrics.eventCounts.values()).reduce((sum, count) => sum + count, 0),
            eventCounts: Object.fromEntries(this.metrics.eventCounts),
            eventRates: Object.fromEntries(Array.from(eventRates).map(([k, v]) => [k, Math.round(v * 10) / 10])),
            avgProcessingTime: Math.round(avgProcessingTime * 100) / 100,
            errorCounts: Object.fromEntries(this.metrics.errorCounts),
            memoryUsage: latestMemory ? {
                heapUsedMB: Math.round(latestMemory.heapUsed / 1024 / 1024),
                heapTotalMB: Math.round(latestMemory.heapTotal / 1024 / 1024)
            } : null
        };
    }
    
    reset() {
        this.metrics.eventCounts.clear();
        this.metrics.processingTimes = [];
        this.metrics.errorCounts.clear();
        this.metrics.lastReset = Date.now();
    }
}

// Initialize performance monitor
const perfMonitor = new EventPerformanceMonitor();

// Wrap event handlers with performance monitoring
function monitoredEventHandler(eventType, handler) {
    return function(...args) {
        const startTime = Date.now();
        try {
            const result = handler.apply(this, args);
            const processingTime = Date.now() - startTime;
            perfMonitor.recordEvent(eventType, processingTime);
            return result;
        } catch (error) {
            const processingTime = Date.now() - startTime;
            perfMonitor.recordEvent(eventType, processingTime, error);
            throw error;
        }
    };
}

// Apply monitoring to event handlers
const monitoredAddHandler = monitoredEventHandler('table.add', (rows) => {
    // Original handler logic
    console.log(`Processing ${rows.length} new rows`);
    rows.forEach(row => {
        if (row.temperature > 30) {
            console.log(`High temp: ${row.sensor} at ${row.temperature}°C`);
        }
    });
});

const monitoredUpdateHandler = monitoredEventHandler('table.update', (rows) => {
    console.log(`Processing ${rows.length} updated rows`);
});

// Register monitored handlers
realtimeTable.on('add', monitoredAddHandler);
realtimeTable.on('update', monitoredUpdateHandler);

// Regular performance reporting
setInterval(() => {
    const report = perfMonitor.getReport();
    console.log('📊 Event System Performance Report:', report);
    
    // Alert on performance issues
    if (report.avgProcessingTime > 100) {
        console.log('⚠️  HIGH PROCESSING TIME DETECTED');
    }
    
    if (report.memoryUsage && report.memoryUsage.heapUsedMB > 100) {
        console.log('⚠️  HIGH MEMORY USAGE DETECTED');
    }
}, 60000); // Every minute

console.log('🎯 Real-time events and streaming system initialized');
console.log('📡 Multiple data streams running with comprehensive event handling');
console.log('📊 Performance monitoring active');
```

This comprehensive guide covers all aspects of Tesseract's real-time event system, from basic event handling to advanced streaming data processing and performance monitoring. The examples show practical implementations for building responsive, event-driven applications with proper error handling and performance optimization.
