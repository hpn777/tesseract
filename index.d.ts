declare module 'tesseract'

type Resolve = any
type DataRow<T> = T
type ProxyConfig = any

type Session = any
type ColumnType = any

// not sure what this is
type NatsCluster = any

interface CompareFilter {
  field: string
  comparison: 'lt' | 'eq' | 'gt'
}

interface CustomFilter {
  type: 'custom'
  value: string
}

type Filter = CustomFilter

interface Sort {
  property: string
  direction: 'asc' | 'desc'
}

interface GroupBy {
  dataIndex: string
}

interface Query {
  id: string
  table: string
  columns: Column[]
  filter: Filter[]
  sort: Sort[]
  groupBy: GroupBy[]
}

interface ColumnResolveBase {
  underlyingName: string
  valueField: string
  displayField: string
}

interface ColumnResolveSession extends ColumnResolveBase {
  session?: Query
}

interface ColumnResolveTable extends ColumnResolveBase {
  childrenTable?: string
}

type ColumnResolve = ColumnResolveSession
                   | ColumnResolveTable

type AggregatorFunction = (
  data: any,
  name: string,
  groupedColumn: Column,
  branchPath: string,
  parent: string
) => any

interface Column {
  name: string
  primaryKey?: boolean
  resolve?: ColumnResolve
  value?(data: any): any
  aggregator?: 'sum' | 'avg' | 'max' | 'min' | AggregatorFunction
}

interface TesseractOptions {
  id: string
  idProperty?: string
  resolve?: Resolve
  columns: Column[]
  clusterSync?: boolean
}

declare class Tesseract<T> {

  constructor(options: TesseractOptions)

  // Properties
  dataMap: { [key: string]: DataRow<T> }
  dataCache: DataRow<T>[] 
  sessions: Session[]
  id: string
  idProperty: string
  idIndex: number
  columns: Column[]
  idColumn: Column
  resolve: Resolve
  clusterSync: boolean
  defaultObjDef: ProxyConfig

  // Methods
  refresh(): void
  refreshTesseract(): void
  collectGarbage(): void

  add(t: T): void
  get(key: string): T
  createSession(query: Query): Session
  getData(): DataRow<T>[]
  getById(id: string): T
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
  resolve(resolve: ColumnResolve, data: any): any
  get(key: string): any
  getList(table: string): DataRow<any>[] | undefined
  createTesseract(name: string, options: TesseractOptions): Promise<Tesseract<any>> | Tesseract<any>
  registerTesseract(tesseract: Tesseract<any>): void
  registerSession(session: Session): void
  createTesseractFromSession(name: string, session: Session): Tesseract<any>
  createSession(query: Query): Session
  generateHash(): string
  getSession(sessionName: string): Session
}

interface ClusterConnectOptions {
  clientName: string
}

type InnerData = any

declare class Cluster extends EventHorizon {

  constructor()
  connect(options: ClusterConnectOptions): Promise<NatsCluster>
  createTesseract(name: string, options: TesseractOptions): Promise<Tesseract<InnerData>>
}
