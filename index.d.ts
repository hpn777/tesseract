// Re-export common dependencies
export const backbone: any;
export const lodash: any;
export const linq: any;

type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never

// TODO it's something like:
// (table: string) => Tesseract<T>
type ResolveFunction = any
type DataRow<T> = T
type ProxyConfig = any
type Bulkable<T> = T | T[]
type Id = number | string

interface DataUpdate<T> {
  addedIds: (keyof T)[]
  addedData: any  // LINQ enumerable
  updatedIds: (keyof T)[]
  updatedData: any  // LINQ enumerable
  updateReason?: UpdateReason,
  removedIds: (keyof T)[]
  removedData: any  // LINQ enumerable
  toJSON(): {
    addedIds: (keyof T)[]
    addedData: T[]
    updatedIds: (keyof T)[]
    updatedData: T[]
    updateReason?: UpdateReason,
    removedIds: (keyof T)[]
    removedData: T[]
  }
}

interface GetSessionDataRequest {
  filter?: Filter[]
  sort?: Sort[]
  start?: number;
  limit?: number;
}

export interface Session<T = any> {
  on(e: 'dataUpdate', callback: (update: DataUpdate<T>) => void): void
  getData(request?: GetSessionDataRequest): T[]
  getLinq(request?: GetSessionDataRequest): any  // Returns LINQ enumerable
  getById(id: Id): T
  getCount(): number
  updateColumns(columns: TesseractColumn<T>[]): void
  groupData(groupBy?: GroupBy[], includeLeafs?: boolean, nodeId?: string): T[]
  groupSelectedData(selectedRowsIds: any, groupBy?: GroupBy[], includeLeafs?: boolean, nodeId?: string): T[]
  destroy(): void
}

interface CompareFilter {
  type?: string
  field: string
  // From /lib/expressionEngine.js - supported comparison operators
  comparison: 'lt' | '<' | 'eq' | '==' | '=' | 'gt' | '>' | 'gte' | '>=' | 'lte' | '<=' | 'ne' | '!=' | 'in' | 'notin' | 'like' | '~' | '!~' | 'between' | string
  value: any
}

interface CustomFilter {
  type: 'custom'
  value: string
}

export type Filter = CustomFilter | CompareFilter

interface Sort {
  field: string
  direction: 'asc' | 'desc'
}

interface GroupBy {
  dataIndex: string
}

// TODO: needs type params
type AggregatorFunction = (
  data: any,
  name: string,
  //groupedColumn: RegularColumn<T>,
  groupedColumn: string,
  branchPath: string,
  parent: string
) => any

interface ColumnRegular<T> {
  name: keyof T
  primaryKey?: boolean
  secondaryKey?: boolean
  columnType?: 'string' | 'text' | 'number' | 'date' | 'boolean' | 'object'
  value?(data: any): any
  defaultValue?(data: any): any
  expression?: string
  aggregator?: 'sum' | 'avg' | 'max' | 'min' | 'count' | 'expression' | AggregatorFunction
}

interface ResolveSession<T, S, D extends keyof S> {
  underlyingField: keyof T
  childrenTable?: S[D]
  session?: Query<any, any, D>
  valueField?: keyof UnionToIntersection<S>
  displayField: keyof UnionToIntersection<S>
}

interface ResolveTable<T, S, D extends keyof S> {
  underlyingField: keyof T
  childrenTable: S[D]
  valueField?: keyof UnionToIntersection<S>
  displayField: keyof UnionToIntersection<S>
}

type Resolve<T, S, D extends keyof S> =
  ResolveTable<T, S, D> | ResolveSession<T, S, D>

interface ColumnResolved<T, S, D extends keyof S> {
  name: string
  resolve: Resolve<T, S, D>
}

type Column<T, S, D extends keyof S> =
  ColumnRegular<T> | ColumnResolved<T, S, D>

export interface Query<T, S, D extends keyof (T | S)> {
  id?: string
  table: T[D] | Query<T, S, D>
  columns?: Column<T, S, D>[]
  filter?: Filter[]
  sort?: Sort[]
  groupBy?: GroupBy[]
  start?: number;
  limit?: number;
  includeLeafs?: boolean;
  subSessions?: SubSessions<T, S, D>
}

interface SubSessions<T, S, D extends keyof (T | S)> {
  [key: string]: Query<T, S, D>
}

interface UnionQuery<T, S, D extends keyof (T | S)> {
  subSessions: SubSessions<T, S, D>
  columns: Column<T, S, D>[]
}

export interface TesseractColumn<T> {
  name: keyof T
  primaryKey?: boolean
  secondaryKey?: boolean
  columnType?: 'string' | 'text' | 'number' | 'date' | 'boolean' | 'object'
  value?(data: any): any
  defaultValue?(data: any): any
  expression?: string
  aggregator?: 'sum' | 'avg' | 'max' | 'min' | AggregatorFunction
}

export interface TesseractOptions<T> {
  id: string
  idProperty?: keyof T
  resolve?: ResolveFunction
  columns: TesseractColumn<T>[]
  clusterSync?: boolean
  persistent?: boolean
  defferedDataUpdateTime?: number
}

export declare class Tesseract<T = any> {

  constructor(options: TesseractOptions<T>)

  // Properties
  dataMap: { [key: string]: DataRow<T> }
  dataCache: DataRow<T>[]
  sessions: Session[]
  id: string
  idProperty: string
  private idIndex: number
  columns: TesseractColumn<T>[]
  resolve: ResolveFunction
  clusterSync: boolean
  defaultObjDef: ProxyConfig

  // Methods
  refresh(): void
  refreshTesseract(): void
  collectGarbage(): void

  add(data: Bulkable<T>, disableClusterUpdate?: boolean): void
  update(data: Bulkable<Partial<T>>, disableClusterUpdate?: boolean): DataRow<T>[]
  remove(data: Id[], disableClusterUpdate?: boolean): void
  get(key: string): T
  createSession<T, S, D extends keyof (T | S)>(query: Query<T, S, D>): Session<T>
  getData(): DataRow<T>[]
  getById(id: Id): T
  getSimpleHeader(): TesseractColumn<T>[]
  clear(disableClusterUpdate?: boolean): Promise<any>
  reset(data: T[], disableClusterUpdate?: boolean): DataRow<T>[]
}

export interface EventHorizonOptions {
  namespace?: string
  commandPort?: any
}

export declare class EventHorizon {
  constructor(options?: EventHorizonOptions)
  on(...args: any[]): any
  off(...args: any[]): any
  once(...args: any[]): any
  trigger(...args: any[]): any
  resolve(resolve: any, data: any): any
  get(key: string): any
  getTesseract(table: string): Tesseract<any> | undefined
  createTesseract<T>(name: string, options: TesseractOptions<T>): Promise<Tesseract<T>> | Tesseract<T>
  registerTesseract(tesseract: Tesseract<any>): void
  registerSession(session: Session): void
  createTesseractFromSession<T>(name: string, session: Session): Tesseract<T>
  createSession<T, S, D extends keyof (T | S)>(query: Query<T, S, D>, reuseSession?: boolean): Session<T>
  createUnion<T, S, D extends keyof (T | S)>(name: string, options: UnionQuery<T, S, D>): Tesseract<T>
  generateHash(obj: any): string
  getSession(sessionName: string): Session
}

interface ClusterConnectOptions {
  redis?: {
    host?: string
    port?: number
  }
  syncSchema?: boolean
}

export declare class TessSync {
  constructor(options?: EventHorizonOptions, evH?: EventHorizon)
  connect(options: ClusterConnectOptions): Promise<any>
  close(): void
  clear(): Promise<any>
  createTesseract<T>(name: string, options: TesseractOptions<T>): Promise<Tesseract<T>> | Tesseract<T>
  on(...args: any[]): any
  off(...args: any[]): any
  once(...args: any[]): any
  trigger(...args: any[]): any
  resolve(resolve: any, data: any): any
  get(key: string): any
  getTesseract(table: string): Tesseract<any> | undefined
  pullTesseract(name: string, timeout?: number, retryNr?: number): Promise<Tesseract<any>>
  createTesseractFromSession<T>(name: string, session: Session): Tesseract<T>
  createSession<T, S, D extends keyof (T | S)>(query: Query<T, S, D>): Session<T>
  createSessionAsync<T, S, D extends keyof (T | S)>(query: Query<T, S, D>): Promise<Session<T>>
  createUnion<T, S, D extends keyof (T | S)>(name: string, query: UnionQuery<T, S, D>): Tesseract<T>
  getSession(sessionName: string): Session
}

// Alias for backward compatibility
export declare class Cluster extends TessSync {}
export declare class ClusterRedis extends TessSync {}

export enum UpdateReason {
  UPDATE_REASON_DATA = 'dataUpdate',
  UPDATE_REASON_COLUMNS_CHANGED = 'columnsChanged',
  UPDATE_REASON_DATA_RESET = 'dataReset',
}