const test = require('tape');
import { Test } from 'tape';
import { EventHorizon } from '../src/lib/eventHorizon';

test('Session permanentFilter remains fixed after creation', (t: Test) => {
  const eventHorizon = new EventHorizon();

  const usersTable = eventHorizon.createTesseract('users', {
    columns: [
      { name: 'id', primaryKey: true },
      { name: 'name' },
      { name: 'status' }
    ]
  });

  usersTable.add([
    { id: 1, name: 'Alice', status: 'active' },
    { id: 2, name: 'Bob', status: 'inactive' },
    { id: 3, name: 'Carol', status: 'active' }
  ]);

  const activeSession = eventHorizon.createSession({
    id: 'permanent-filter-active',
    table: 'users',
    permanentFilter: [
      { field: 'status', comparison: '==', value: 'active' }
    ]
  });

  const activeRows = activeSession.getData();
  t.equal(activeRows.length, 2, 'Permanent filter should apply when session is created');
  t.ok(activeRows.every((row: any) => row.status === 'active'), 'Only active rows should be returned initially');

  (activeSession as any).config.permanentFilter = [
    { field: 'status', comparison: '==', value: 'inactive' }
  ];

  activeSession.filterData([]);

  const rowsAfterMutation = activeSession.getData();
  t.equal(rowsAfterMutation.length, 2, 'Changing config.permanentFilter after creation should have no effect');
  t.ok(rowsAfterMutation.every((row: any) => row.status === 'active'), 'Permanent filter should remain the original value');

  const inactiveSession = eventHorizon.createSession({
    id: 'permanent-filter-inactive',
    table: 'users',
    permanentFilter: [
      { field: 'status', comparison: '==', value: 'inactive' }
    ]
  });

  const inactiveRows = inactiveSession.getData();
  t.equal(inactiveRows.length, 1, 'New session with different permanent filter should return a different dataset');
  t.ok(inactiveRows.every((row: any) => row.status === 'inactive'), 'New permanent filter should apply only when creating new session');

  activeSession.destroy();
  inactiveSession.destroy();

  t.end();
});

test('Session getData preserves permanent filter when request filters are provided', (t: Test) => {
  const eventHorizon = new EventHorizon();

  const usersTable = eventHorizon.createTesseract('users-getData', {
    columns: [
      { name: 'id', primaryKey: true },
      { name: 'name' },
      { name: 'status' },
      { name: 'department' }
    ]
  });

  usersTable.add([
    { id: 1, name: 'Alice', status: 'active', department: 'Engineering' },
    { id: 2, name: 'Bob', status: 'inactive', department: 'Sales' },
    { id: 3, name: 'Carol', status: 'active', department: 'Marketing' }
  ]);

  const session = eventHorizon.createSession({
    id: 'permanent-filter-getdata',
    table: 'users-getData',
    permanentFilter: [
      { field: 'status', comparison: '==', value: 'active' }
    ]
  });

  const conflictingFilterResult = session.getData({
    filter: [
      { field: 'status', comparison: '==', value: 'inactive' }
    ]
  });

  t.equal(conflictingFilterResult.length, 0, 'Request filter cannot override permanent filter to include inactive rows');

  const resetWithEmptyFilter = session.getData({ filter: [] });
  t.equal(resetWithEmptyFilter.length, 2, 'Permanent filter remains intact when getData is called with an empty filter array');
  t.ok(resetWithEmptyFilter.every((row: any) => row.status === 'active'), 'All rows returned remain active');

  const departmentFilterResult = session.getData({
    filter: [
      { field: 'department', comparison: '==', value: 'Marketing' }
    ]
  });

  t.equal(departmentFilterResult.length, 1, 'Request filter should narrow results while respecting permanent filter');
  t.equal(departmentFilterResult[0].name, 'Carol', 'Only rows matching both permanent and request filters are returned');

  const permanentFilterValue = ((session as any).permanentFilter || [])[0]?.value;
  t.equal(permanentFilterValue, 'active', 'Permanent filter value remains unchanged after getData with filters');

  session.destroy();
  t.end();
});
