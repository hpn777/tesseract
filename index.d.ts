declare module 'tessio'

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
  updatedIds: (keyof T)[]
  updatedData: T[]
  updateReason?: UpdateReason,
  removedIds: (keyof T)[]
  removedData: T[]
  toJSON(): T
}

interface GetSessionDataRequest {
  filter?: Filter[]
  sort?: Sort[]
  start?: number;
  limit?: number;
}

interface Session<T = any> {
  on(e: 'dataUpdate', callback: (update: DataUpdate<T>) => void): void
  getData(request?: GetSessionDataRequest): T
  getLinq(request?: GetSessionDataRequest): T
  updateColumns(columns: TesseractColumn<T>[]): void
  destroy(): void
}

interface CompareFilter {
  type?: string
  field: string
  // TODO: Pull from /lib/expressionEngine.js
  comparison: 'lt' | 'eq' | 'gt' | string
  value: any
}

interface CustomFilter {
  type: 'custom'
  value: string
}

type Filter = CustomFilter | CompareFilter

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
  value?(data: any): any
  defaultValue?(data: any): any
  expression?: string
  aggregator?: 'sum' | 'avg' | 'max' | 'min' | AggregatorFunction
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

interface Query<T, S, D extends keyof (T | S)> {
  id?: string
  table: T[D]
  columns?: Column<T, S, D>[]
  filter?: Filter[]
  sort?: Sort[]
  groupBy?: GroupBy[]
  start?: number;
  limit?: number;
  subSessions?: SubSessions<T, S, D>
}

interface SubSessions<T, S, D extends keyof (T | S)> {
  [key: string]: Query<T, S, D>
}

interface UnionQuery<T, S, D extends keyof (T | S)> {
  subSessions: SubSessions<T, S, D>
  columns: Column<T, S, D>[]
}

interface TesseractColumn<T> {
  name: keyof T
  primaryKey?: boolean
  value?(data: any): any
}

interface TesseractOptions<T> {
  id: string
  idProperty?: keyof T
  resolve?: ResolveFunction
  columns: TesseractColumn<T>[]
  clusterSync?: boolean
  persistent?: boolean
}

declare class Tesseract<T> {

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
  createSession<T, S, D extends keyof (T | S)>(query: Query<T, S, D>): Session
  getData(): DataRow<T>[]
  getById(id: Id): T
  clear(disableClusterUpdate?: boolean):  Promise<any>
  reset(data: T[], disableClusterUpdate?: boolean): DataRow<T>[]
}

interface EventHorizonOptions {
  namespace: string
}

declare class EventHorizon {
  constructor(option: EventHorizonOptions)
  on(...args: any[]): any
  off(...args: any[]): any
  once(...args: any[]): any
  trigger(...args: any[]): any
  resolve(resolve: any, data: any): any
  get(key: string): any
  getTesseract(table: string): DataRow<any>[] | undefined
  createTesseract<T>(name: string, options: TesseractOptions<T>): Promise<Tesseract<T>> | Tesseract<T>
  registerTesseract(tesseract: Tesseract<any>): void
  registerSession(session: Session): void
  createTesseractFromSession<T>(name: string, session: Session): Tesseract<T>
  createSession<T, S, D extends keyof (T | S)>(query: Query<T, S, D>): Session
  generateHash(): string
  getSession(sessionName: string): Session
}

interface ClusterConnectOptions {
  clientName: string
  syncSchema?: boolean
}

declare class Cluster {

  constructor(option: EventHorizonOptions, evH?: EventHorizon)
  connect(options: ClusterConnectOptions): Promise<any>
  createTesseract<T>(name: string, options: TesseractOptions<T>): Promise<Tesseract<T>> | Tesseract<T>
  on(...args: any[]): any
  off(...args: any[]): any
  once(...args: any[]): any
  trigger(...args: any[]): any
  resolve(resolve: any, data: any): any
  get(key: string): any
  clear(): Promise<any>
  getTesseract(table: string): DataRow<any> | undefined
  pullTesseract(name: string, timeout: number, retryNr: number): Promise<DataRow<any>>
  createTesseractFromSession<T>(name: string, session: Session): Tesseract<T>
  createSession<T, S, D extends keyof (T | S)>(query: Query<T, S, D>): Session
  createSessionAsync<T, S, D extends keyof (T | S)>(query: Query<T, S, D>): Promise<Session>
  createUnion<T, S, D extends keyof (T | S)>(name: string, query: UnionQuery<T, S, D>): Tesseract<T>
  getSession(sessionName: string): Session
}

declare enum UpdateReason {
  UPDATE_REASON_DATA = 'dataUpdate',
  UPDATE_REASON_COLUMNS_CHANGED = 'columnsChanged',
}