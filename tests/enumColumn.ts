const test = require('tape');
import { Test } from 'tape';
import { EventHorizon } from '../src/lib/eventHorizon';

/**
 * Ensures enum column metadata propagates into the tesseract definition and headers.
 */
test('Tesseract preserves enum column metadata', (t: Test) => {
  const eventHorizon = new EventHorizon();
  enum OrderStatus {
    New = 'new',
    Active = 'active',
    Closed = 'closed'
  }

  const ordersTable = eventHorizon.createTesseract('orders-enum', {
    columns: [
      { name: 'id', primaryKey: true },
      { name: 'status', columnType: 'enum', enum: OrderStatus }
    ]
  });

  const statusColumn = (ordersTable as any).columns.find((column: any) => column.name === 'status');
  t.ok(statusColumn, 'status column is created');
  t.equal(statusColumn.columnType, 'enum', 'columnType remains enum');
  t.deepEqual(statusColumn.enum, OrderStatus, 'enum definition is preserved on the column definition');

  const headerStatus = ordersTable.getSimpleHeader().find((column: any) => column.name === 'status');
  t.ok(headerStatus, 'status column exists in simple header');
  t.deepEqual(headerStatus.enum, OrderStatus, 'simple header exposes the enum definition');

  t.end();
});
