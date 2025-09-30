const test = require('tape');
import { Test } from 'tape';
import EventHorizon from '../src/lib/eventHorizon';

// Performance Test Configuration - Modify these values to adjust test scale
const PERFORMANCE_CONFIG = {
    // Initial baseline data
    INITIAL_EMPLOYEES: 2000,
    INITIAL_TRANSACTIONS: 10000,
    
    // Bulk add operations
    BULK_ADD_OPERATIONS: 100000,
    EMPLOYEES_PER_ADD: 1,
    TRANSACTIONS_PER_ADD: 25,
    
    // Individual update operations
    UPDATE_OPERATIONS: 1000000,
    
    // Batch remove operations
    REMOVE_OPERATIONS: 10000,
    EMPLOYEES_PER_REMOVE: 10,
    TRANSACTIONS_PER_REMOVE: 50,
    
    // Mixed operations
    MIXED_OPERATIONS: 20000,
    EMPLOYEES_PER_MIXED_ADD: 10,
    TRANSACTIONS_PER_MIXED_ADD: 50,
    
    // Session check frequency (percentage)
    SESSION_CHECK_FREQUENCY: 0, // 10% of operations will check sessions
    MIXED_SESSION_CHECK_FREQUENCY: 0 // 5% for mixed operations
};

interface PerformanceMetrics {
    operation: string;
    totalOperations: number;
    duration: number;
    operationsPerSecond: number;
    averageLatency: number;
}

interface Employee {
    id: number;
    name: string;
    department: string;
    salary: number;
    active: boolean;
    startDate: Date;
    bonus: number;
    region: string;
    level: string;
}

interface Transaction {
    id: number;
    employeeId: number;
    amount: number;
    type: string;
    date: Date;
    category: string;
    status: string;
}

test('Performance Benchmark - Add/Update/Remove Operations with Queries', function (t: Test) {
    console.log('\n🚀 Starting Performance Benchmark Test...\n');
    
    const eventHorizon = new EventHorizon();
    
    // Create employees table with complex schema
    const employeesTable = eventHorizon.createTesseract('employees', {
        columns: [
            { name: 'id', primaryKey: true },
            { name: 'name', columnType: 'string' },
            { name: 'department', columnType: 'string', secondaryKey: true },
            { name: 'salary', columnType: 'number' },
            { name: 'active', columnType: 'boolean', secondaryKey: true },
            { name: 'startDate', columnType: 'date' },
            { name: 'bonus', columnType: 'number' },
            { name: 'region', columnType: 'string', secondaryKey: true },
            { name: 'level', columnType: 'string' }
        ]
    });

    // Create transactions table
    const transactionsTable = eventHorizon.createTesseract('transactions', {
        columns: [
            { name: 'id', primaryKey: true },
            { name: 'employeeId', columnType: 'number', secondaryKey: true },
            { name: 'amount', columnType: 'number' },
            { name: 'type', columnType: 'string', secondaryKey: true },
            { name: 'date', columnType: 'date' },
            { name: 'category', columnType: 'string' },
            { name: 'status', columnType: 'string', secondaryKey: true }
        ]
    });

    // Create multiple complex sessions with expressions and filters
    const highEarnersSession = eventHorizon.createSession({
        id: 'high-earners',
        table: 'employees',
        columns: [
            { name: 'name' },
            { name: 'department' },
            { name: 'salary' },
            { name: 'bonus' },
            { 
                name: 'totalCompensation', 
                expression: 'salary + bonus' 
            },
            { 
                name: 'salaryGrade', 
                expression: 'salary >= 80000 ? "Senior" : salary >= 60000 ? "Mid" : "Junior"' 
            },
            { 
                name: 'isHighPerformer', 
                expression: 'salary > 75000 && bonus > 5000' 
            }
        ],
        filter: [
            { field: 'active', comparison: '==', value: true }
        ],
        sort: [{ field: 'salary', direction: 'desc' }]
    });

    const departmentAnalysisSession = eventHorizon.createSession({
        id: 'department-analysis',
        table: 'employees',
        columns: [
            { name: 'department' },
            { name: 'region' },
            { 
                name: 'employeeCount', 
                value: 1, 
                aggregator: 'sum' 
            },
            { 
                name: 'avgSalary', 
                value: (row: any) => row.salary, 
                aggregator: 'avg' 
            },
            { 
                name: 'totalBonus', 
                value: (row: any) => row.bonus, 
                aggregator: 'sum' 
            }
        ],
        filter: [
            { field: 'active', comparison: '==', value: true }
        ],
        groupBy: [{ dataIndex: 'department' }]
    });

    const transactionAnalysisSession = eventHorizon.createSession({
        id: 'transaction-analysis',
        table: 'transactions',
        columns: [
            { name: 'employeeId' },
            { name: 'type' },
            { name: 'status' },
            { 
                name: 'transactionCount', 
                value: 1, 
                aggregator: 'sum' 
            },
            { 
                name: 'totalAmount', 
                value: (row: any) => row.amount, 
                aggregator: 'sum' 
            },
            { 
                name: 'avgAmount', 
                value: (row: any) => row.amount, 
                aggregator: 'avg' 
            }
        ],
        filter: [
            { field: 'status', comparison: '==', value: 'completed' }
        ],
        groupBy: [{ dataIndex: 'employeeId' }],
        sort: [{ field: 'totalAmount', direction: 'desc' }]
    });

    // Helper functions
    const generateEmployeeData = (count: number, startId: number = 1): Employee[] => {
        const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations'];
        const regions = ['North', 'South', 'East', 'West', 'Central'];
        const levels = ['Junior', 'Mid', 'Senior', 'Lead', 'Principal'];
        const names = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
        
        return Array.from({ length: count }, (_, i) => ({
            id: startId + i,
            name: `${names[i % names.length]} ${Math.floor(Math.random() * 1000)}`,
            department: departments[Math.floor(Math.random() * departments.length)],
            salary: 40000 + Math.floor(Math.random() * 80000),
            active: Math.random() > 0.1, // 90% active
            startDate: new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
            bonus: Math.floor(Math.random() * 15000),
            region: regions[Math.floor(Math.random() * regions.length)],
            level: levels[Math.floor(Math.random() * levels.length)]
        }));
    };

    const generateTransactionData = (count: number, employeeCount: number, startId: number = 1): Transaction[] => {
        const types = ['expense', 'reimbursement', 'bonus', 'salary'];
        const categories = ['travel', 'office', 'training', 'equipment', 'meals'];
        const statuses = ['pending', 'completed', 'rejected'];
        
        return Array.from({ length: count }, (_, i) => ({
            id: startId + i,
            employeeId: Math.floor(Math.random() * employeeCount) + 1,
            amount: 50 + Math.floor(Math.random() * 2000),
            type: types[Math.floor(Math.random() * types.length)],
            date: new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000)),
            category: categories[Math.floor(Math.random() * categories.length)],
            status: statuses[Math.floor(Math.random() * statuses.length)]
        }));
    };

    const measurePerformance = async (
        operation: string,
        operationFn: () => Promise<void> | void,
        iterations: number
    ): Promise<PerformanceMetrics> => {
        const startTime = performance.now();
        const latencies: number[] = [];

        for (let i = 0; i < iterations; i++) {
            const opStart = performance.now();
            await operationFn();
            const opEnd = performance.now();
            latencies.push(opEnd - opStart);
        }

        const endTime = performance.now();
        const duration = (endTime - startTime) / 1000; // Convert to seconds
        const operationsPerSecond = iterations / duration;
        const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

        return {
            operation,
            totalOperations: iterations,
            duration,
            operationsPerSecond,
            averageLatency
        };
    };

    const runBenchmark = async () => {
        const results: PerformanceMetrics[] = [];
        
        console.log('📊 Initializing with baseline data...');
        
        // Initial data load
        const initialEmployees = generateEmployeeData(PERFORMANCE_CONFIG.INITIAL_EMPLOYEES);
        const initialTransactions = generateTransactionData(PERFORMANCE_CONFIG.INITIAL_TRANSACTIONS, PERFORMANCE_CONFIG.INITIAL_EMPLOYEES);
        
        employeesTable.add(initialEmployees);
        transactionsTable.add(initialTransactions);
        
        // Verify sessions are working
        console.log(`Initial high earners: ${highEarnersSession.getData().length}`);
        console.log(`Initial departments: ${departmentAnalysisSession.getData().length}`);
        console.log(`Initial transactions analysis: ${transactionAnalysisSession.getData().length}`);

        // Pre-generate all test data to exclude generation time from measurements
        console.log('� Pre-generating test data...');
        
        // Pre-generate data for bulk add operations
        const addOperationsData: Array<{ employees: Employee[]; transactions: Transaction[] }> = [];
        for (let i = 0; i < PERFORMANCE_CONFIG.BULK_ADD_OPERATIONS; i++) {
            addOperationsData.push({
                employees: generateEmployeeData(PERFORMANCE_CONFIG.EMPLOYEES_PER_ADD, 10000 + i * PERFORMANCE_CONFIG.EMPLOYEES_PER_ADD),
                transactions: generateTransactionData(PERFORMANCE_CONFIG.TRANSACTIONS_PER_ADD, PERFORMANCE_CONFIG.INITIAL_EMPLOYEES, 50000 + i * PERFORMANCE_CONFIG.TRANSACTIONS_PER_ADD)
            });
        }

        // Test 1: Bulk Add Operations (with queries active)
        console.log('\n🔵 Testing ADD operations...');
        let addIndex = 0;
        const addResult = await measurePerformance(
            `Bulk Add (${PERFORMANCE_CONFIG.EMPLOYEES_PER_ADD} employees + ${PERFORMANCE_CONFIG.TRANSACTIONS_PER_ADD} transactions)`,
            () => {
                const data = addOperationsData[addIndex++];
                employeesTable.add(data.employees);
                transactionsTable.add(data.transactions);
                
                // Check session results after each operation
                const highEarners = highEarnersSession.getData();
                const deptAnalysis = departmentAnalysisSession.getData();
            },
            PERFORMANCE_CONFIG.BULK_ADD_OPERATIONS
        );
        results.push(addResult);

        // Pre-generate update data
        const updateOperationsData: Array<{ employeeUpdate: any; transactionUpdate: any; shouldCheckSessions: boolean }> = [];
        for (let i = 0; i < PERFORMANCE_CONFIG.UPDATE_OPERATIONS; i++) {
            updateOperationsData.push({
                employeeUpdate: {
                    id: Math.floor(Math.random() * PERFORMANCE_CONFIG.INITIAL_EMPLOYEES) + 1,
                    salary: 50000 + Math.floor(Math.random() * 70000),
                    bonus: Math.floor(Math.random() * 10000)
                },
                transactionUpdate: {
                    id: Math.floor(Math.random() * PERFORMANCE_CONFIG.INITIAL_TRANSACTIONS) + 1,
                    amount: 100 + Math.floor(Math.random() * 1500),
                    status: Math.random() > 0.5 ? 'completed' : 'pending'
                },
                shouldCheckSessions: Math.random() < PERFORMANCE_CONFIG.SESSION_CHECK_FREQUENCY
            });
        }

        // Test 2: Individual Update Operations
        console.log('\n🟡 Testing UPDATE operations...');
        let updateIndex = 0;
        const updateResult = await measurePerformance(
            'Individual Updates',
            () => {
                const data = updateOperationsData[updateIndex++];
                
                // Update employee
                employeesTable.update(data.employeeUpdate);
                
                // Update transaction
                transactionsTable.update(data.transactionUpdate);
                
                // Access session data periodically
                if (data.shouldCheckSessions) {
                    const results = highEarnersSession.getData();
                    const analysis = transactionAnalysisSession.getData();
                }
            },
            PERFORMANCE_CONFIG.UPDATE_OPERATIONS
        );
        results.push(updateResult);

        // Pre-generate remove data
        const removeOperationsData: Array<{ employeeIds: string[]; transactionIds: string[] }> = [];
        for (let i = 0; i < PERFORMANCE_CONFIG.REMOVE_OPERATIONS; i++) {
            const employeeIds: string[] = [];
            const transactionIds: string[] = [];
            
            // Generate random IDs to remove
            for (let j = 0; j < PERFORMANCE_CONFIG.EMPLOYEES_PER_REMOVE; j++) {
                employeeIds.push(String(Math.floor(Math.random() * 1000) + 20000 + i * PERFORMANCE_CONFIG.EMPLOYEES_PER_REMOVE)); // Use high IDs to avoid conflicts
            }
            for (let j = 0; j < PERFORMANCE_CONFIG.TRANSACTIONS_PER_REMOVE; j++) {
                transactionIds.push(String(Math.floor(Math.random() * 2000) + 100000 + i * PERFORMANCE_CONFIG.TRANSACTIONS_PER_REMOVE));
            }
            
            removeOperationsData.push({ employeeIds, transactionIds });
        }

        // Test 3: Batch Remove Operations
        console.log('\n🔴 Testing REMOVE operations...');
        let removeIndex = 0;
        const removeResult = await measurePerformance(
            `Batch Remove (${PERFORMANCE_CONFIG.EMPLOYEES_PER_REMOVE} employees + ${PERFORMANCE_CONFIG.TRANSACTIONS_PER_REMOVE} transactions)`,
            () => {
                const data = removeOperationsData[removeIndex++];
                
                try {
                    employeesTable.remove(data.employeeIds);
                    transactionsTable.remove(data.transactionIds);
                    
                    // Check sessions after removal
                    const remaining = departmentAnalysisSession.getData();
                } catch (e) {
                    // Some IDs might not exist, which is expected
                }
            },
            PERFORMANCE_CONFIG.REMOVE_OPERATIONS
        );
        results.push(removeResult);

        // Pre-generate mixed operations data
        interface MixedOperation {
            type: 'add' | 'update' | 'remove';
            employees?: Employee[];
            transactions?: Transaction[];
            employeeUpdate?: any;
            removeIds?: string[];
            shouldCheckSessions: boolean;
        }
        
        const mixedOperationsData: MixedOperation[] = [];
        for (let i = 0; i < PERFORMANCE_CONFIG.MIXED_OPERATIONS; i++) {
            const operation = Math.random();
            const shouldCheckSessions = Math.random() < PERFORMANCE_CONFIG.MIXED_SESSION_CHECK_FREQUENCY;
            
            if (operation < 0.5) {
                // 50% Add operations
                mixedOperationsData.push({
                    type: 'add',
                    employees: generateEmployeeData(PERFORMANCE_CONFIG.EMPLOYEES_PER_MIXED_ADD, 30000 + i * PERFORMANCE_CONFIG.EMPLOYEES_PER_MIXED_ADD),
                    transactions: generateTransactionData(PERFORMANCE_CONFIG.TRANSACTIONS_PER_MIXED_ADD, PERFORMANCE_CONFIG.INITIAL_EMPLOYEES, 150000 + i * PERFORMANCE_CONFIG.TRANSACTIONS_PER_MIXED_ADD),
                    shouldCheckSessions
                });
            } else if (operation < 0.8) {
                // 30% Update operations
                mixedOperationsData.push({
                    type: 'update',
                    employeeUpdate: {
                        id: Math.floor(Math.random() * PERFORMANCE_CONFIG.INITIAL_EMPLOYEES) + 1,
                        salary: 45000 + Math.floor(Math.random() * 75000),
                        active: Math.random() > 0.2
                    },
                    shouldCheckSessions
                });
            } else {
                // 20% Remove operations
                mixedOperationsData.push({
                    type: 'remove',
                    removeIds: [String(Math.floor(Math.random() * 1000) + 40000)],
                    shouldCheckSessions
                });
            }
        }

        // Test 4: Mixed Operations (realistic workload)
        console.log('\n🟣 Testing MIXED operations...');
        let mixedIndex = 0;
        const mixedResult = await measurePerformance(
            'Mixed Operations (Add/Update/Remove)',
            () => {
                const op = mixedOperationsData[mixedIndex++];
                
                if (op.type === 'add' && op.employees && op.transactions) {
                    employeesTable.add(op.employees);
                    transactionsTable.add(op.transactions);
                } else if (op.type === 'update' && op.employeeUpdate) {
                    employeesTable.update(op.employeeUpdate);
                } else if (op.type === 'remove' && op.removeIds) {
                    try {
                        employeesTable.remove(op.removeIds);
                    } catch (e) {
                        // ID might not exist
                    }
                }
                
                // Periodically check all sessions to ensure they're being updated
                if (op.shouldCheckSessions) {
                    const highEarners = highEarnersSession.getData();
                    const deptAnalysis = departmentAnalysisSession.getData();
                    const transAnalysis = transactionAnalysisSession.getData();
                }
            },
            PERFORMANCE_CONFIG.MIXED_OPERATIONS
        );
        results.push(mixedResult);

        return results;
    };

    // Run the benchmark
    runBenchmark().then((results) => {
        // Calculate total test time
        const totalDuration = results.reduce((sum, result) => sum + result.duration, 0);
        const totalOperations = results.reduce((sum, result) => sum + result.totalOperations, 0);
        
        console.log('\n📈 PERFORMANCE RESULTS (Events/sec):');
        console.log('=' .repeat(50));
        
        results.forEach((result) => {
            console.log(`${result.operation}: ${result.operationsPerSecond.toFixed(0)} ops/sec`);
        });
        
        console.log('-'.repeat(50));
        console.log(`Overall Performance: ${(totalOperations / totalDuration).toFixed(0)} ops/sec`);
        console.log(`Total Operations: ${totalOperations.toLocaleString()}`);
        console.log(`Total Duration: ${totalDuration.toFixed(1)}s`);

        // Performance assertions
        t.ok(results.length === 4, 'All performance tests completed');

        console.log('\n✅ Performance benchmark completed!');
        t.end();
    }).catch((error) => {
        console.error('❌ Benchmark failed:', error);
        t.fail(`Benchmark error: ${error.message}`);
        t.end();
    });
});

console.log('Performance Benchmark Test loaded...');
