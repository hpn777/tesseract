// Core type definitions for Tesseract

import { Tesseract } from "./export";

export interface DataRow {
  [key: string]: any;
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
    // semantic column classification used in some places
    columnType?: 'string' | 'number' | 'date' | 'boolean' | 'object' | 'text' | 'dimension' | 'metric';
    // additional fields used by utils/session building
    defaultValue?: string | number | Function;
    value?: string | number | Function;
    hidden?: boolean;
    enum?: any[];
    resolve?: ResolveConfig;
}

export interface FilterDef {
  field: string;
  // core code checks `comparison`, legacy places used `type`
  comparison?: '==' | '>' | '<' | '>=' | '<=' | '!=' | 'in' | 'notin' | 'like' | 'notlike' | '~' | '!~' | 'custom';
  value: any;
}

export interface SortDef {
  field: string;
  direction?: 'asc' | 'desc' | 'ASC' | 'DESC';
  comparer?: (a: any, b: any) => number;
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
  value: any;
  children: GroupNode<T>[];
  data: T[];
  aggregates: { [key: string]: any };
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
  resolve?: (resolve: any, data: any) => any;
  persistent?: boolean;
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
  commandPort?: any;
}

export type EventCallback = (...args: any[]) => void;
export type UnsubscribeFunction = () => void;

// Utility types
export type Comparer<T = any> = (a: T, b: T) => number;
export type Predicate<T = any> = (item: T) => boolean;
export type Aggregator<T = any> = (items: T[], column?: string) => any;

export interface ExtendedColumnDef extends ColumnDef {
  name: string;
  primaryKey?: boolean;
  hidden?: boolean;
}

export interface GroupDataResult {
  key: string;
  value: any;
  children?: GroupDataResult[];
  data?: DataRow[];
  aggregates?: { [key: string]: any };
  level?: number;
}

export interface UpdateResult {
  addedIds: any[];
  addedData: any;
  updatedIds: any[];
  updatedData: any;
  updateReason: string;
  removedIds: any[];
  removedData: any;
  toJSON(): {
    addedIds: any[];
    addedData: DataRow[];
    updatedIds: any[];
    updatedData: DataRow[];
    updateReason: string;
    removedIds: any[];
    removedData: DataRow[];
  };
}