declare module 'tesseract'

type Resolve = any
type DataRow<T> = T
type ProxyConfig = any

type Session = any
type SessionOptions = any

interface ColumnResolve {
  childTable: string
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
