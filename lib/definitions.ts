type DataRow = any;
type DataCacheOptions = any;
type TheTree = any;
type FilterType = string;

interface Filter {
    type: FilterType;
    value: string;
    field?: string;
    comparison?: 'lt' | 'eq' | 'gt';
}

interface Sort {
    field: string;
    direction: 'asc' | 'desc';
}

interface LiveQueryConfig {
    filters: Filter[],
    immediateUpdate: boolean,
    sort: Sort[],
    groupBy: any[]
}

enum ColumnType {
    Number = 'number',
    String = 'string',
    Object = 'object',
    StaticResolve = 'staticResolve'
}

interface ColumnResolve {
    childTable: string;
    valueField: string;
    displayField: string;
}

interface Column {
    name: string;
    type: ColumnType;
    primaryKey?: boolean;
    resolve?: ColumnResolve,
    value?(data: any): any,
    aggregator: string // max, min and a few more predefined methods
}

interface Filters {
    filters: Filter[],
    applyFilters(row: DataRow[]): boolean;
}

// AKA Session
interface LiveQuery {
    requireFiltering: boolean;
    filters: Filters;
    config: any;
    dataCache: DataCache;
    localDataCache: any;
    getData(request: any): any;
    filterData(filtersAttr: any); // mutates
    sortData(sorters: any); // mutates
    groupData(groupBy: any, includeLeafs: boolean): any;
    groupSelectedData(
        selectedRowsIds: any,
        groupBy: any,
        includeLeafs: boolean
    ): any;
}

// AKA Tesseract
interface DataCache {
    data: DataRow[],
    dataMap: { [key: string]: DataRow },
    colums: Column[];
    idProperty: string,
    liveQueries: LiveQuery[],
    resolver: DataCacheResolver;
    refresh();
    refreshDataCache();
    collectGarbage();
    // AKA createSession
    createLiveQuery(parameters: LiveQueryConfig): LiveQuery;
    getData(): DataRow[];
    getById(id: string): DataRow;
    add(data: DataRow[], disableClusterUpdate: boolean);
    udpate(
        data: DataRow[],
        reset: boolean,
        disableClusterUpdate: boolean
    ): DataRow[];
    remove(data: DataRow[], disableClusterUpdate: boolean);
    clear(disableClusterUpdate: boolean);
    updateColumns(newColumns: Column[], reset: boolean);
    registerEvents();
    generateData(data: DataRow[]): DataRow[];
    // mutator?
    renderRow(data: DataRow, columns: Column[]): any[];
    returnTree(
        rootIdValue: string,
        parentIdField: string,
        group: any
    ): TheTree;

    // I'm making stuff up here
    groupData(...args): any;
    groupSelectedData(...args): any;
    generateSummaryRow(...args): any;
    getHeader(excludeHiddenColumn: boolean): Column[];
    getSimpleHeader(excludeHiddenColumn: boolean): Column[];
}

// AKA EventHorizon
interface DataCacheResolver {
    caches: DataCache[];
    liveQueries: LiveQuery[];
    resolve(config: any): DataRow;
    get(key: string): DataCache;
    getList(table: string): DataRow[];
    // AKA addTesseract
    addDataCache(name: string, options: DataCacheOptions): DataCache
    mergeColumns(baseColumns: Column[], optionalColumns: Column[]): Column[];
    // AKA createTesseractFromSession
    createDataCacheFromLiveQuery(
        name: string,
        liveQuery: LiveQuery,
        options: DataCacheOptions
    ): DataCache;
    // AKA createTesseractFromAggregaredSession
    createDataCacheFromAggregatedLiveQuery(
        name: string,
        liveQuery: LiveQuery,
        options: DataCacheOptions
    ): DataCache;
    // AKA createSession
    createLiveQuery(
        name: string,
        table: string,
        parameters: any
    ): LiveQuery;
    // AKA getSession
    getLiveQuery(name: string): LiveQuery;
}
