// Core type definitions for Tesseract

import { Tesseract } from "./export";
import { ExpressionTree } from "./lib/expressionEngine";

// Type aliases for better type safety
// RowValue: Flexible type for row data values
export type RowValue = string | number | boolean | Date | null | undefined | object;
// PrimitiveValue: Values that can be used as dictionary keys and in comparisons
export type PrimitiveValue = string | number | boolean | null | undefined;
// AggregateValue: Values returned by aggregation functions
export type AggregateValue = number | string | null | undefined;
// EnumValue: Values that can appear in enum lists
export type EnumValue = string | number | boolean;
// EnumDefinition: Object holding the mapping of enum keys to values
export type EnumDefinition = Record<string, EnumValue>;
// IdValue: Values used for row identification
export type IdValue = string | number;

export interface DataRow {
  [key: string]: RowValue;
}

// Resolve configuration used by Tesseract/EventHorizon and proxy getters
export interface ResolveConfig {
  childrenTable?: string; // filled by EventHorizon when wiring subSessions
  underlyingField: string;
  displayField: string;
  valueField?: string; // optional mapping key used in some tests
  // Optional extras supported in core
  session?: string | CreateSessionParameters;
  template?: string; // utils uses `template`
  displayTemplate?: string; // EventHorizon uses `displayTemplate`
}

export interface ColumnDef {
    name: string;
    primaryKey?: boolean;
    secondaryKey?: boolean | string;
    title?: string;
    aggregator?: 'sum' | 'avg' | 'max' | 'min' | 'count' | 'first' | 'last' | 'expression' | 'none' | Function;
    expression?: string;
    expressionTree?: ExpressionTree;
    // semantic column classification used in some places
    columnType?: 'string' | 'number' | 'date' | 'boolean' | 'object' | 'text' | 'dimension' | 'metric' | 'enum';
    // additional fields used by utils/session building
    defaultValue?: string | number | Function | null;
    value?: string | number | null | Function;
    hidden?: boolean;
    enum?: EnumDefinition;
    resolve?: ResolveConfig;
}

export interface FilterDef {
  field: string;
  // core code checks `comparison`, legacy places used `type`
  comparison?: '==' | '>' | '<' | '>=' | '<=' | '!=' | 'in' | 'notin' | 'like' | 'notlike' | '~' | '!~' | 'custom';
  value: string | number | boolean | Date | null | Array<string | number>;
}

export interface SortDef {
  field: string;
  direction?: 'asc' | 'desc' | 'ASC' | 'DESC';
  comparer?: (a: PrimitiveValue, b: PrimitiveValue) => number;
}

// Nested SubSession map (subSessions: { name: CreateSessionParameters })
export interface SubSessionsMap {
  [name: string]: CreateSessionParameters;
}

// Public session/createSession config used throughout tests and core
export interface CreateSessionParameters {
  id?: string;
  table?: string | object;
  subSessions?: SubSessionsMap;
  columns?: ColumnDef[];
  // support both spellings, core uses `filter`/`sort`
  filter?: FilterDef[];
  filters?: FilterDef[];
  sort?: SortDef[];
  sorts?: SortDef[];
  groupBy?: Array<string | { dataIndex: string }>;
  includeLeafs?: boolean;
  limit?: number;
  offset?: number;
  // optional permanent filter used by Session internals
  permanentFilter?: FilterDef[];
}

// Backwards-compatible alias
export type SessionConfig = CreateSessionParameters;

export interface GroupNode<T = DataRow> {
  key: string;
  value: PrimitiveValue;
  children: GroupNode<T>[];
  data: T[];
  aggregates: { [key: string]: AggregateValue };
  level: number;
}

export interface DataUpdate<T = DataRow> {
  removedData: T[];
  addedData: T[];
  removedIds: string[];
  addedIds: string[];
  updatedData?: T[];
  updatedIds?: string[];
}

export interface TesseractOptions {
  columns?: ColumnDef[];
  primaryKey?: string;
  defferedDataUpdateTime?: number;
  clusterSync?: boolean;
  id?: string;
  resolve?: (resolve: ResolveConfig, data: DataRow) => RowValue;
  persistent?: boolean;
}

export interface CommandPort {
  listen: (callback: () => void) => void;
  close: () => void;
}

export interface EventHorizonOptions {
  redis?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  };
  cluster?: boolean;
  clusterName?: string;
  namespace?: string;
  commandPort?: CommandPort;
}

export type EventCallback = (...args: PrimitiveValue[]) => void;
export type UnsubscribeFunction = () => void;

// Utility types with default type parameter for flexibility
export type Comparer<T = PrimitiveValue> = (a: T, b: T) => number;
export type Predicate<T = DataRow> = (item: T) => boolean;
export type Aggregator<T = DataRow> = (items: T[], column?: string) => AggregateValue;

export interface GroupDataResult {
  key: string;
  value: PrimitiveValue;
  children?: GroupDataResult[];
  data?: DataRow[];
  aggregates?: { [key: string]: AggregateValue };
  level?: number;
}

export interface UpdateResult {
  addedIds: IdValue[];
  addedData: DataRow[];
  updatedIds: IdValue[];
  updatedData: DataRow[];
  updateReason: string;
  removedIds: IdValue[];
  removedData: DataRow[];
  toJSON(): {
    addedIds: IdValue[];
    addedData: DataRow[];
    updatedIds: IdValue[];
    updatedData: DataRow[];
    updateReason: string;
    removedIds: IdValue[];
    removedData: DataRow[];
  };
}