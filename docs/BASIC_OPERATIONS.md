# Basic Operations Guide

This guide covers fundamental CRUD operations and data manipulation with Tesseract.

## Table of Contents
- [Creating Tables](#creating-tables)
- [Adding Data](#adding-data)
- [Reading Data](#reading-data)
- [Updating Data](#updating-data)
- [Removing Data](#removing-data)
- [Working with Columns](#working-with-columns)

## Creating Tables

### Simple Table Creation

```javascript
const { EventHorizon } = require('../index');
const eventHorizon = new EventHorizon();

// Define a products table
const productsTable = eventHorizon.createTesseract('products', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'name', type: 'string' },
        { name: 'price', type: 'number' },
        { name: 'category', type: 'string' },
        { name: 'inStock', type: 'boolean' },
        { name: 'createdAt', type: 'date' }
    ]
});
```

### Table with Secondary Indexes

```javascript
const ordersTable = eventHorizon.createTesseract('orders', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'customerId', type: 'number', secondaryKey: true }, // Secondary index
        { name: 'productId', type: 'number', secondaryKey: true },  // Secondary index
        { name: 'quantity', type: 'number' },
        { name: 'total', type: 'number' },
        { name: 'status', type: 'string' }
    ]
});
```

## Adding Data

### Single Row Addition

```javascript
// Add a single product
const newProduct = await productsTable.add({
    id: 1,
    name: 'Wireless Headphones',
    price: 99.99,
    category: 'Electronics',
    inStock: true,
    createdAt: new Date()
});

console.log('Added product:', newProduct);
```

### Batch Data Addition

```javascript
// Add multiple products at once
const products = [
    { id: 2, name: 'Laptop Stand', price: 49.99, category: 'Accessories', inStock: true, createdAt: new Date() },
    { id: 3, name: 'USB Cable', price: 19.99, category: 'Accessories', inStock: false, createdAt: new Date() },
    { id: 4, name: 'Smartphone', price: 699.99, category: 'Electronics', inStock: true, createdAt: new Date() }
];

const addedProducts = await productsTable.add(products);
console.log(`Added ${addedProducts.length} products`);
```

### Asynchronous Addition with Promise

```javascript
// Add data and wait for confirmation
const addProductAsync = async () => {
    try {
        const result = await productsTable.addAsync({
            id: 5,
            name: 'Gaming Mouse',
            price: 79.99,
            category: 'Gaming',
            inStock: true,
            createdAt: new Date()
        });
        console.log('Product added successfully:', result);
    } catch (error) {
        console.error('Failed to add product:', error);
    }
};

addProductAsync();
```

## Reading Data

### Get All Data

```javascript
// Retrieve all products
const allProducts = productsTable.getData();
console.log('All products:', allProducts);
```

### Get Data by ID

```javascript
// Get specific product by ID
const product = productsTable.getById(1);
console.log('Product with ID 1:', product);
```

### Get Data Count

```javascript
// Get total number of products
const count = productsTable.getCount();
console.log('Total products:', count);
```

### Using Linq Queries

```javascript
// Get products using linq.js
const expensiveProducts = productsTable.getLinq()
    .where(p => p.price > 50)
    .orderBy(p => p.price)
    .toArray();

console.log('Expensive products (>$50):', expensiveProducts);

// Get products by category
const electronicsProducts = productsTable.getLinq()
    .where(p => p.category === 'Electronics')
    .select(p => ({ id: p.id, name: p.name, price: p.price }))
    .toArray();

console.log('Electronics products:', electronicsProducts);
```

## Updating Data

### Single Row Update

```javascript
// Update a product's price
await productsTable.update({
    id: 1,
    price: 89.99  // New price
});

console.log('Product price updated');
```

### Batch Updates

```javascript
// Update multiple products
const updates = [
    { id: 2, inStock: false },
    { id: 3, price: 17.99, inStock: true }
];

await productsTable.update(updates);
console.log('Multiple products updated');
```

### Conditional Updates with Sessions

```javascript
// Create a session to update all out-of-stock items
const outOfStockSession = eventHorizon.createSession({
    id: 'out-of-stock-updates',
    table: 'products',
    filter: [
        { field: 'inStock', comparison: '==', value: false }
    ]
});

// Get IDs of out-of-stock products
const outOfStockIds = outOfStockSession.getData().map(p => p.id);

// Update all out-of-stock products to have a discount
const discountUpdates = outOfStockIds.map(id => ({
    id: id,
    price: productsTable.getById(id).price * 0.9 // 10% discount
}));

await productsTable.update(discountUpdates);
```

## Removing Data

### Remove by IDs

```javascript
// Remove single product
await productsTable.remove([1]);

// Remove multiple products
await productsTable.remove([2, 3, 4]);

console.log('Products removed');
```

### Conditional Removal

```javascript
// Remove all products below a certain price
const cheapProducts = productsTable.getLinq()
    .where(p => p.price < 20)
    .select(p => p.id)
    .toArray();

await productsTable.remove(cheapProducts);
console.log(`Removed ${cheapProducts.length} cheap products`);
```

### Clear All Data

```javascript
// Remove all data from the table
await productsTable.clear();
console.log('All products removed');
```

## Working with Columns

### Dynamic Column Definitions

```javascript
// Table with computed columns
const enhancedProductsTable = eventHorizon.createTesseract('enhanced_products', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'name', type: 'string' },
        { name: 'price', type: 'number' },
        { name: 'cost', type: 'number' },
        { 
            name: 'profit', 
            value: (row) => row.price - row.cost 
        },
        { 
            name: 'profitMargin', 
            value: (row) => ((row.price - row.cost) / row.price * 100).toFixed(2) + '%'
        },
        { 
            name: 'priceCategory',
            value: (row) => {
                if (row.price < 25) return 'Budget';
                if (row.price < 100) return 'Mid-range';
                return 'Premium';
            }
        }
    ]
});

// Add data - computed columns will be automatically calculated
enhancedProductsTable.add([
    { id: 1, name: 'Widget A', price: 15.99, cost: 8.50 },
    { id: 2, name: 'Widget B', price: 45.99, cost: 22.00 },
    { id: 3, name: 'Widget C', price: 129.99, cost: 65.00 }
]);

console.log('Products with computed columns:', enhancedProductsTable.getData());
```

### Default Values

```javascript
const customersTable = eventHorizon.createTesseract('customers', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'status', type: 'string', defaultValue: 'active' },
        { name: 'createdAt', type: 'date', defaultValue: () => new Date() },
        { name: 'lastLogin', type: 'date', defaultValue: null }
    ]
});

// Add customer without status or createdAt - defaults will be used
customersTable.add({
    id: 1,
    name: 'John Doe',
    email: 'john@example.com'
});

console.log('Customer with defaults:', customersTable.getById(1));
```

### Column Templates

```javascript
const notificationsTable = eventHorizon.createTesseract('notifications', {
    columns: [
        { name: 'id', primaryKey: true },
        { name: 'userId', type: 'number' },
        { name: 'type', type: 'string' },
        { name: 'data', type: 'object' },
        { 
            name: 'message', 
            value: '${type}: ${data.subject}' // Template using lodash template syntax
        },
        { 
            name: 'timestamp', 
            defaultValue: () => new Date().toISOString() 
        }
    ]
});

notificationsTable.add({
    id: 1,
    userId: 123,
    type: 'Email',
    data: { subject: 'Welcome to our service!' }
});

console.log('Notification with template:', notificationsTable.getById(1));
```

## Event-Driven Operations

### Listening to Data Changes

```javascript
// Set up event listeners
productsTable.on('dataUpdate', (data, disableClusterUpdate, updateReason) => {
    console.log(`Data updated: ${data.length} rows`);
    console.log('Update reason:', updateReason);
    data.forEach(row => {
        console.log(`Updated product: ${row.name} (ID: ${row.id})`);
    });
});

productsTable.on('dataRemove', (removedIds) => {
    console.log(`Data removed: ${removedIds.length} rows`);
    removedIds.forEach(id => {
        console.log(`Removed product ID: ${id}`);
    });
});

// Operations will now trigger events
productsTable.add({ id: 100, name: 'Test Product', price: 25.99, category: 'Test', inStock: true });
productsTable.update({ id: 100, price: 29.99 });
productsTable.remove([100]);
```
