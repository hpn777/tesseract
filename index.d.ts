declare module 'tesseract'

type Resolve = any
type DataRow<T> = T
type ProxyConfig = any

type Session = any
type SessionOptions = any
type ColumnType = any

// not sure what this is
type NatsCluster = any

interface ColumnResolve {
  childrenTable: string
  underlyingName: string
  valueField: string
  displayField: string
}

interface Column {
  name: string
  type: ColumnType
  primaryKey?: boolean
  resolve?: ColumnResolve
  value?(data: any): any
  aggregator: string
}

interface TesseractOptions {
  id: string,
  idProperty: string
  resolve: Resolve
  columns: Column[]
  clusterSync: boolean
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

  get(key: string): T
  createSession(config: SessionOptions): Session
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
  registerTessearct(tesseract: Tesseract<any>): void
  registerSession(session: Session): void
  createTesseractFromSession(name: string, session: Session): Tesseract<any>
  createSession(sessionOptions: SessionOptions): Session
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
