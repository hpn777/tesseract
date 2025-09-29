# Expression Engine and Filtering Guide

This guide covers the powerful expression engine for custom filters, computed columns, and dynamic data processing.

## Table of Contents
- [Expression Syntax](#expression-syntax)
- [Custom Filters](#custom-filters)
- [Computed Columns](#computed-columns)
- [Built-in Functions](#built-in-functions)
- [Advanced Expressions](#advanced-expressions)
- [Performance Tips](#performance-tips)

## Expression Syntax

The Tesseract Expression Engine supports JavaScript-like syntax for creating dynamic expressions.

### Basic Operators

```javascript
const { EventHorizon } = require('../index');
const eventHorizon = new EventHorizon();

// Create sample data table
const employeesTable = eventHorizon.createTesseract('employees', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'name', type: 'string' },
        { name: 'salary', type: 'number' },
        { name: 'department', type: 'string' },
        { name: 'startDate', type: 'date' },
        { name: 'active', type: 'boolean' },
        { name: 'bonus', type: 'number' }
    ]
});

// Add sample data
employeesTable.add([
    { id: 1, name: 'Alice Johnson', salary: 75000, department: 'Engineering', startDate: new Date('2020-03-15'), active: true, bonus: 5000 },
    { id: 2, name: 'Bob Smith', salary: 65000, department: 'Marketing', startDate: new Date('2019-07-20'), active: true, bonus: 3000 },
    { id: 3, name: 'Carol Davis', salary: 80000, department: 'Engineering', startDate: new Date('2018-11-10'), active: false, bonus: 0 },
    { id: 4, name: 'David Wilson', salary: 70000, department: 'Sales', startDate: new Date('2021-01-25'), active: true, bonus: 4000 }
]);

// Arithmetic expressions
const salaryAnalysisSession = eventHorizon.createSession({
    id: 'salary-analysis',
    table: 'employees',
    columns: [
        { name: 'name' },
        { name: 'salary' },
        { name: 'bonus' },
        { 
            name: 'totalCompensation',
            expression: 'salary + bonus'  // Simple arithmetic
        },
        { 
            name: 'monthlyPay',
            expression: '(salary + bonus) / 12'  // With parentheses
        },
        { 
            name: 'salaryIncrease',
            expression: 'salary * 1.05'  // 5% increase
        }
    ]
});

console.log('Salary analysis:', salaryAnalysisSession.getData());
```

### Comparison Operations

```javascript
// Comparison operators in expressions
const comparisonExamples = eventHorizon.createSession({
    id: 'comparison-examples',
    table: 'employees',
    columns: [
        { name: 'name' },
        { name: 'salary' },
        { name: 'active' },
        { 
            name: 'highEarner',
            expression: 'salary > 70000'  // Boolean result
        },
        { 
            name: 'salaryGrade',
            expression: 'salary >= 75000 ? "Senior" : "Junior"'  // Ternary operator
        },
        { 
            name: 'activeStatus',
            expression: 'active == true ? "Active Employee" : "Inactive"'
        }
    ]
});

console.log('Comparison examples:', comparisonExamples.getData());
```

## Custom Filters

### Simple Custom Filters

```javascript
// Custom filter examples
const customFilterSession1 = eventHorizon.createSession({
    id: 'custom-filter-1',
    table: 'employees',
    filter: [
        {
            type: 'custom',
            value: 'salary > 70000'  // Simple condition
        }
    ]
});

console.log('High earners:', customFilterSession1.getData());

// Multiple conditions with AND logic
const customFilterSession2 = eventHorizon.createSession({
    id: 'custom-filter-2',
    table: 'employees',
    filter: [
        {
            type: 'custom',
            value: 'salary > 65000 && active == true'  // AND condition
        }
    ]
});

console.log('Active high earners:', customFilterSession2.getData());

// OR conditions
const customFilterSession3 = eventHorizon.createSession({
    id: 'custom-filter-3',
    table: 'employees',
    filter: [
        {
            type: 'custom',
            value: 'department == "Engineering" || salary > 75000'  // OR condition
        }
    ]
});

console.log('Engineers or high earners:', customFilterSession3.getData());
```

### String Matching Filters

```javascript
// String operations in filters
const stringFilterSession = eventHorizon.createSession({
    id: 'string-filters',
    table: 'employees',
    filter: [
        {
            type: 'custom',
            value: 'name ~ "John"'  // Contains (case-insensitive)
        }
    ]
});

console.log('Names containing "John":', stringFilterSession.getData());

// Multiple string conditions
const advancedStringSession = eventHorizon.createSession({
    id: 'advanced-string',
    table: 'employees',
    filter: [
        {
            type: 'custom',
            value: 'name like "A" || department like "Eng"'  // Like operator
        }
    ]
});

console.log('Names starting with A or Engineering dept:', advancedStringSession.getData());
```

### Date-based Filters

```javascript
// Date filtering with custom expressions
const dateFilterSession = eventHorizon.createSession({
    id: 'date-filters',
    table: 'employees',
    filter: [
        {
            type: 'custom',
            value: 'startDate > "2020-01-01"'  // Date comparison
        }
    ]
});

console.log('Recent hires (after 2020):', dateFilterSession.getData());
```

### Complex Logic Filters

```javascript
// Complex nested conditions
const complexFilterSession = eventHorizon.createSession({
    id: 'complex-filters',
    table: 'employees',
    filter: [
        {
            type: 'custom',
            value: '(salary > 70000 && department == "Engineering") || (salary > 65000 && active == true && bonus > 3000)'
        }
    ]
});

console.log('Complex filter results:', complexFilterSession.getData());

// Using array membership
const departmentFilterSession = eventHorizon.createSession({
    id: 'department-filter',
    table: 'employees',
    filter: [
        {
            type: 'custom',
            value: 'department in ["Engineering", "Sales"]'  // Array membership
        }
    ]
});

console.log('Engineering or Sales employees:', departmentFilterSession.getData());
```

## Computed Columns

### Mathematical Computations

```javascript
// Advanced mathematical expressions
const mathTable = eventHorizon.createTesseract('math_examples', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'x', type: 'number' },
        { name: 'y', type: 'number' },
        { name: 'z', type: 'number' },
        { 
            name: 'euclideanDistance',
            expression: 'Math.sqrt(x*x + y*y + z*z)'  // JavaScript Math functions
        },
        { 
            name: 'average',
            expression: '(x + y + z) / 3'
        },
        { 
            name: 'maxValue',
            expression: 'x > y ? (x > z ? x : z) : (y > z ? y : z)'  // Nested ternary
        }
    ]
});

mathTable.add([
    { id: 1, x: 3, y: 4, z: 5 },
    { id: 2, x: 1, y: 2, z: 3 },
    { id: 3, x: 10, y: 5, z: 8 }
]);

console.log('Mathematical computations:', mathTable.getData());
```

### String Processing

```javascript
// String manipulation in expressions
const stringProcessingTable = eventHorizon.createTesseract('string_processing', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'firstName', type: 'string' },
        { name: 'lastName', type: 'string' },
        { name: 'email', type: 'string' },
        { 
            name: 'fullName',
            expression: 'firstName + " " + lastName'  // String concatenation
        },
        { 
            name: 'initials',
            expression: 'firstName.charAt(0) + "." + lastName.charAt(0) + "."'  // String methods
        },
        { 
            name: 'emailDomain',
            expression: 'email.substring(email.indexOf("@") + 1)'  // Domain extraction
        },
        { 
            name: 'nameLength',
            expression: 'fullName.length'  // String length
        }
    ]
});

stringProcessingTable.add([
    { id: 1, firstName: 'Alice', lastName: 'Johnson', email: 'alice@company.com' },
    { id: 2, firstName: 'Bob', lastName: 'Smith', email: 'bob@enterprise.org' },
    { id: 3, firstName: 'Carol', lastName: 'Davis', email: 'carol@startup.net' }
]);

console.log('String processing:', stringProcessingTable.getData());
```

### Conditional Logic

```javascript
// Complex conditional expressions
const conditionalTable = eventHorizon.createTesseract('conditional_logic', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'score', type: 'number' },
        { name: 'attempts', type: 'number' },
        { name: 'timeSpent', type: 'number' },
        { 
            name: 'grade',
            expression: 'score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F"'
        },
        { 
            name: 'efficiency',
            expression: 'timeSpent > 0 ? Math.round(score / timeSpent * 100) / 100 : 0'
        },
        { 
            name: 'status',
            expression: '(score >= 70 && attempts <= 3) ? "Pass" : (attempts > 5 ? "Fail" : "Retry")'
        }
    ]
});

conditionalTable.add([
    { id: 1, score: 85, attempts: 2, timeSpent: 45 },
    { id: 2, score: 92, attempts: 1, timeSpent: 38 },
    { id: 3, score: 67, attempts: 4, timeSpent: 52 },
    { id: 4, score: 55, attempts: 6, timeSpent: 60 }
]);

console.log('Conditional logic:', conditionalTable.getData());
```

## Built-in Functions

### Available Operators and Functions

```javascript
// Comprehensive example of built-in functions
const functionsDemo = eventHorizon.createSession({
    id: 'functions-demo',
    table: 'employees',
    columns: [
        { name: 'name' },
        { name: 'salary' },
        { name: 'department' },
        { name: 'startDate' },
        { name: 'active' },
        
        // Arithmetic operators
        { name: 'salaryPlus10K', expression: 'salary + 10000' },
        { name: 'salaryMinus5K', expression: 'salary - 5000' },
        { name: 'doubleSalary', expression: 'salary * 2' },
        { name: 'halfSalary', expression: 'salary / 2' },
        
        // Comparison operators
        { name: 'isHighEarner', expression: 'salary > 70000' },
        { name: 'isJuniorLevel', expression: 'salary < 70000' },
        { name: 'isSeniorLevel', expression: 'salary >= 75000' },
        { name: 'isExactly75K', expression: 'salary == 75000' },
        { name: 'isNot75K', expression: 'salary != 75000' },
        
        // Logical operators
        { name: 'seniorEngineer', expression: 'salary > 70000 && department == "Engineering"' },
        { name: 'highEarnerOrActive', expression: 'salary > 70000 || active == true' },
        
        // String operators
        { name: 'nameContainsA', expression: 'name ~ "A"' },
        { name: 'nameStartsWithA', expression: 'name like "A"' },
        { name: 'deptContainsEng', expression: 'department ~ "Eng"' },
        { name: 'nameNotLikeB', expression: 'name !~ "B"' },
        
        // Ternary operator
        { name: 'statusText', expression: 'active == true ? "Active" : "Inactive"' }
    ]
});

console.log('Functions demonstration:', functionsDemo.getData().slice(0, 2)); // Show first 2 rows
```

### List Operations

```javascript
// Working with arrays/lists
const listOperationsSession = eventHorizon.createSession({
    id: 'list-operations',
    table: 'employees',
    columns: [
        { name: 'name' },
        { name: 'department' },
        { name: 'salary' },
        
        // Check if department is in a list
        { 
            name: 'isTechDepartment',
            expression: 'department in ["Engineering", "IT", "Data Science"]'
        },
        
        // Check if NOT in list
        { 
            name: 'isBusinessDepartment',
            expression: 'department notin ["Engineering", "IT", "Data Science"]'
        },
        
        // Complex list conditions
        { 
            name: 'eligibleForBonus',
            expression: 'active == true && department in ["Sales", "Marketing"] && salary > 60000'
        }
    ]
});

console.log('List operations:', listOperationsSession.getData());
```

## Advanced Expressions

### Nested Expressions

```javascript
// Complex nested expressions
const nestedExpressionsTable = eventHorizon.createTesseract('nested_expressions', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'revenue', type: 'number' },
        { name: 'costs', type: 'number' },
        { name: 'employees', type: 'number' },
        { name: 'region', type: 'string' },
        
        // Nested calculations
        { 
            name: 'profit',
            expression: 'revenue - costs'
        },
        { 
            name: 'profitMargin',
            expression: 'revenue > 0 ? ((revenue - costs) / revenue * 100) : 0'
        },
        { 
            name: 'profitPerEmployee',
            expression: 'employees > 0 ? ((revenue - costs) / employees) : 0'
        },
        { 
            name: 'performanceCategory',
            expression: '((revenue - costs) / revenue * 100) > 20 ? "Excellent" : ((revenue - costs) / revenue * 100) > 10 ? "Good" : "Needs Improvement"'
        },
        { 
            name: 'regionalBonus',
            expression: 'region == "North" ? 1.1 : (region == "South" ? 1.05 : 1.0)'
        },
        { 
            name: 'adjustedProfit',
            expression: '(revenue - costs) * (region == "North" ? 1.1 : (region == "South" ? 1.05 : 1.0))'
        }
    ]
});

nestedExpressionsTable.add([
    { id: 1, revenue: 100000, costs: 75000, employees: 10, region: 'North' },
    { id: 2, revenue: 150000, costs: 120000, employees: 8, region: 'South' },
    { id: 3, revenue: 80000, costs: 70000, employees: 12, region: 'East' }
]);

console.log('Nested expressions:', nestedExpressionsTable.getData());
```

### Regular Expressions

```javascript
// Using regular expressions in custom filters
const regexFilterSession = eventHorizon.createSession({
    id: 'regex-filters',
    table: 'employees',
    filter: [
        {
            type: 'custom',
            value: 'name.match(/^[A-C].*/) != null'  // Names starting with A, B, or C
        }
    ]
});

console.log('Names starting with A-C:', regexFilterSession.getData());

// Email validation example (if we had email field)
const emailValidationTable = eventHorizon.createTesseract('email_validation', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        { 
            name: 'isValidEmail',
            expression: 'email.match(/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/) != null'
        },
        { 
            name: 'emailDomain',
            expression: 'email.substring(email.lastIndexOf("@") + 1)'
        },
        { 
            name: 'isCompanyEmail',
            expression: 'email ~ "company.com"'
        }
    ]
});

emailValidationTable.add([
    { id: 1, name: 'Alice', email: 'alice@company.com' },
    { id: 2, name: 'Bob', email: 'bob.smith@gmail.com' },
    { id: 3, name: 'Carol', email: 'invalid-email' }
]);

console.log('Email validation:', emailValidationTable.getData());
```

### Dynamic Expressions with Templates

```javascript
// Template-based expressions
const templateTable = eventHorizon.createTesseract('template_expressions', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'firstName', type: 'string' },
        { name: 'lastName', type: 'string' },
        { name: 'department', type: 'string' },
        { name: 'salary', type: 'number' },
        
        // Template expressions (using lodash template syntax)
        { 
            name: 'displayName',
            value: '${lastName}, ${firstName}'  // Template syntax
        },
        { 
            name: 'summary',
            value: '${firstName} ${lastName} works in ${department} earning $${salary}'
        },
        { 
            name: 'salaryBand',
            value: (row) => `${row.firstName} is in the ${row.salary > 70000 ? 'high' : 'standard'} salary band`
        }
    ]
});

templateTable.add([
    { id: 1, firstName: 'Alice', lastName: 'Johnson', department: 'Engineering', salary: 75000 },
    { id: 2, firstName: 'Bob', lastName: 'Smith', department: 'Marketing', salary: 65000 }
]);

console.log('Template expressions:', templateTable.getData());
```

## Performance Tips

### Expression Optimization

```javascript
// Optimized expressions for better performance

// BAD - Complex expression recalculated for each row
const inefficientTable = eventHorizon.createTesseract('inefficient', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'value', type: 'number' },
        { 
            name: 'complexCalculation',
            expression: 'Math.sqrt(Math.pow(value, 2) + Math.pow(value * 0.5, 2)) * 1.414' // Complex
        }
    ]
});

// BETTER - Simplified expression
const efficientTable = eventHorizon.createTesseract('efficient', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'value', type: 'number' },
        { 
            name: 'optimizedCalculation',
            expression: 'value * 1.58' // Pre-calculated constant
        }
    ]
});

// BEST - Use JavaScript functions for complex logic
const optimizedTable = eventHorizon.createTesseract('optimized', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'value', type: 'number' },
        { 
            name: 'fastCalculation',
            value: (row) => {
                // JavaScript function - compiled once, executed many times
                const baseValue = row.value;
                return Math.sqrt(baseValue * baseValue + (baseValue * 0.5) * (baseValue * 0.5)) * 1.414;
            }
        }
    ]
});

console.log('Performance comparison completed');
```

### Filter Optimization

```javascript
// Optimized filtering strategies

// Use secondary indexes when possible
const indexedFilterSession = eventHorizon.createSession({
    id: 'indexed-filter',
    table: 'employees',
    filter: [
        // This can use secondary index if department has secondaryKey: true
        { field: 'department', comparison: '==', value: 'Engineering' }
    ]
});

// Combine indexed filters with custom logic
const hybridFilterSession = eventHorizon.createSession({
    id: 'hybrid-filter',
    table: 'employees',
    filter: [
        // First apply indexed filter
        { field: 'department', comparison: '==', value: 'Engineering' },
        // Then apply custom logic on smaller dataset
        { type: 'custom', value: 'salary > 70000' }
    ]
});

// Avoid complex string operations in filters when possible
const optimizedStringFilter = eventHorizon.createSession({
    id: 'optimized-string',
    table: 'employees',
    filter: [
        // BETTER: Use exact match or 'in' operator when possible
        { field: 'department', comparison: 'in', value: ['Engineering', 'Marketing'] }
        
        // AVOID: Complex string operations
        // { type: 'custom', value: 'department.toLowerCase().indexOf("eng") >= 0' }
    ]
});

console.log('Optimized filtering examples completed');
```
