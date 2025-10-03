/*
MIT License

Copyright (c) 2019 Rafal Okninski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
*/

import * as _ from 'lodash';
import * as linq from 'linq';
import { ExpressionEngine } from './expressionEngine';
import { DataRow, ColumnDef, SortDef, Comparer } from '../types';

const expressionEngine = new ExpressionEngine();

// Extend Number prototype for comparison
declare global {
  interface Number {
    localeCompare(x: number): number;
  }
}

(Number.prototype as any).localeCompare = function (this: number, x: number): number {
  return this - x;
};

interface GroupByItem {
  dataIndex: string;
}

interface ObjWrapper {
  setData(data: DataRow): ObjWrapper & DataRow;
  object: DataRow;
  raw: DataRow;
}

type GetTesseractFunction = (tableName: string) => any;

interface ResolveConfig {
  childrenTable: string;
  displayField: string;
  underlyingField: string;
  template?: string;
}

interface ExtendedColumnDef extends Omit<ColumnDef, 'aggregator'> {
  name: string;
  hidden?: boolean;
  enum?: any[];
  primaryKey?: boolean;
  resolve?: ResolveConfig;
  value?: string | number | Function;
  dataIndex?: string;
  aggregator?: 'sum' | 'avg' | 'max' | 'min' | 'count' | 'first' | 'last' | 'expression' | 'none' | Function;
  type?: string;
}

// Tesseract utils
let generateSummaryRow = (
  data: DataRow[],
  objWrapper: ObjWrapper,
  columns: ExtendedColumnDef[],
  groupedColumn: string,
  _branchValue: any,
  branchPath: string[],
  parent?: any
): DataRow => {
  const response: DataRow = {};
  
  for (let i = 0; i < columns.length; i++) {
    let tempValue = 0;
    const name = columns[i].name;
    
    switch (columns[i].aggregator) {
      case 'none':
        break;
      case 'sum':
        for (let k = 0; k < data.length; k++) {
          const ttValue = objWrapper.setData(data[k])[name];
          if (ttValue != null && typeof ttValue !== 'object') {
            tempValue += Number(ttValue) || 0;
          }
        }
        response[name] = tempValue;
        break;
      case 'avg':
        for (let k = 0; k < data.length; k++) {
          const ttValue = objWrapper.setData(data[k])[name];
          if (ttValue != null && typeof ttValue !== 'object') {
            tempValue += Number(ttValue) || 0;
          }
        }
        tempValue = tempValue / data.length;
        response[name] = tempValue;
        break;
      case 'max':
        let max = objWrapper.setData(data[0])[name] ?? undefined;
        for (let k = 0; k < data.length; k++) {
          const ttValue = objWrapper.setData(data[k])[name];
          if (ttValue != null && max !== undefined) {
            max = ttValue > max ? ttValue : max;
          }
        }
        response[name] = max;
        break;
      case 'min':
        let min = objWrapper.setData(data[0])[name] ?? undefined;
        for (let k = 0; k < data.length; k++) {
          const ttValue = objWrapper.setData(data[k])[name];
          if (ttValue != null && min !== undefined) {
            min = ttValue < min ? ttValue : min;
          }
        }
        response[name] = min;
        break;
      default:
        if (typeof columns[i].aggregator === 'function') { // if custom aggregator exist
          response[name] = (columns[i].aggregator as Function)(data, objWrapper, name, groupedColumn, branchPath, parent);
        } else if (name === groupedColumn) { // if current summary row refers to particular name
          response[name] = data[0][name];
        } else { // if all child elements are identical
          const tempStr = data[0][name];
          let toAdd = true;
          for (let k = 0; k < data.length; k++) {
            if (tempStr !== objWrapper.setData(data[k])[name]) {
              toAdd = false;
              break;
            }
          }
          if (toAdd) {
            response[name] = tempStr;
          }
        }
    }
  }
  return response;
};

let getSimpleHeader = (allColumns: ExtendedColumnDef[], excludeHiddenColumns?: boolean): any[] => {
  return allColumns
    .filter(x => (!excludeHiddenColumns || (excludeHiddenColumns && !x.hidden)))
    .map(x => ({
      name: x.name,
      title: x.title || x.name,
      type: (x as any).type || 'auto',
      hidden: x.hidden,
      enum: x.enum,
      primaryKey: x.primaryKey
    }));
};

let getHeader = (allColumns: ExtendedColumnDef[], excludeHiddenColumns?: boolean): ExtendedColumnDef[] => {
  return allColumns
    .filter(x => (!excludeHiddenColumns || (excludeHiddenColumns && !x.hidden)))
    .map(x => {
      if (x.resolve || x.value) {
        return {
          name: x.name,
          title: x.title || x.name,
          type: (x as any).type || 'auto',
          hidden: x.hidden,
          primaryKey: x.primaryKey
        } as ExtendedColumnDef;
      } else {
        return x;
      }
    });
};

interface GroupDataResult extends DataRow {
  children: GroupDataResult[];
  leaf?: boolean;
}

let groupData = (
  columns: ExtendedColumnDef[],
  data: DataRow[],
  objWrapper: ObjWrapper,
  groupBy: GroupByItem[],
  includeLeafs?: boolean,
  groupIdPrefix?: string,
  branchPath?: string[],
  parent?: any,
  idProperty?: string
): GroupDataResult[] => {
  const response: GroupDataResult[] = [];
  const currentGroup = groupBy[0];
  
  if (!currentGroup) {
    if (includeLeafs) {
      return data.map(x => {
        const obj = objWrapper.setData(x).object as GroupDataResult;
        obj.leaf = true;
        obj.children = [];
        return obj;
      });
    }
    return [];
  } else {
    branchPath = branchPath || [];
    const branchPathCopy = branchPath.slice(0, branchPath.length);
    branchPath.push(currentGroup.dataIndex);
    
    if (currentGroup.dataIndex !== 'All') {
      // OPTIMIZATION: Use Map for O(1) lookups instead of linq groupBy
      const groups = new Map<string, DataRow[]>();
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const key = String(objWrapper.setData(row)[currentGroup.dataIndex]);
        
        let group = groups.get(key);
        if (!group) {
          group = [];
          groups.set(key, group);
        }
        group.push(row);
      }
      
      // Process each group
      groups.forEach((childRows, groupKey) => {
          const tempAggregatedRow = generateSummaryRow(
            childRows,
            objWrapper,
            columns,
            currentGroup.dataIndex,
            groupKey,
            branchPathCopy,
            parent
          ) as GroupDataResult;
          
          if (idProperty) {
            tempAggregatedRow[idProperty] = groupIdPrefix + '/' + groupKey;
          }
          
          const newGroupBy = groupBy.slice(1, groupBy.length);
          tempAggregatedRow.children = groupData(
            columns,
            childRows,
            objWrapper,
            newGroupBy,
            includeLeafs,
            String(tempAggregatedRow[idProperty || 'id']),
            branchPath!.slice(0, branchPath!.length),
            tempAggregatedRow,
            idProperty
          );
          response.push(tempAggregatedRow);
        });
    } else {
      const tempAggregatedRow = generateSummaryRow(
        data,
        objWrapper,
        columns,
        currentGroup.dataIndex,
        currentGroup.dataIndex,
        branchPathCopy,
        parent
      ) as GroupDataResult;
      
      if (idProperty) {
        tempAggregatedRow[idProperty] = currentGroup.dataIndex;
      }
      
      const newGroupBy = groupBy.slice(1, groupBy.length);
      tempAggregatedRow.children = groupData(
        columns,
        data,
        objWrapper,
        newGroupBy,
        includeLeafs,
        currentGroup.dataIndex,
        branchPath!.slice(0, branchPath!.length),
        tempAggregatedRow,
        idProperty
      );
      return [tempAggregatedRow];
    }
    return response;
  }
};

let groupSelectedData = (
  columns: ExtendedColumnDef[],
  data: DataRow[],
  objWrapper: ObjWrapper,
  groupBy: GroupByItem[],
  selectedRowsIds: { [key: string]: boolean },
  includeLeafs?: boolean,
  groupIdPrefix?: string,
  branchPath?: string[],
  parent?: any,
  idProperty?: string,
  filters?: any[]
): GroupDataResult[] => {
  const response: GroupDataResult[] = [];
  let processChildren = false;
  const currentGroup = groupBy[0];
  
  if (!currentGroup) {
    if (includeLeafs) {
      for (let i = 0; i < data.length; i++) {
        if (selectedRowsIds[String(data[i][idProperty || 'id'])]) {
          const tempObj = objWrapper.setData(data[i]).object as GroupDataResult;
          tempObj.leaf = true;
          tempObj.children = [];
          response.push(tempObj);
        }
      }
      return response;
    }
    return [];
  } else {
    branchPath = branchPath || [];
    const branchPathCopy = branchPath.slice(0, branchPath.length);
    branchPath.push(currentGroup.dataIndex);
    
    if (currentGroup.dataIndex !== 'All') {
      // OPTIMIZATION: Use Map for O(1) lookups instead of linq groupBy
      const groups = new Map<string, DataRow[]>();
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const key = String(objWrapper.setData(row)[currentGroup.dataIndex]);
        
        let group = groups.get(key);
        if (!group) {
          group = [];
          groups.set(key, group);
        }
        group.push(row);
      }
      
      // Process each group
      groups.forEach((childRows, groupKey) => {
        processChildren = false;
        
        if (childRows.length >= 1) {
          for (let i = 0; i < childRows.length; i++) {
            if (selectedRowsIds[String(childRows[i][idProperty || 'id'])]) {
              processChildren = true;
              break;
            }
          }

          if (processChildren) {
            // Map over childRows to get raw data
            const subData: DataRow[] = [];
            for (let i = 0; i < childRows.length; i++) {
              subData.push(objWrapper.setData(childRows[i]).raw);
            }
              
            if (subData.length) {
              const tempAggregatedRow = generateSummaryRow(
                subData,
                objWrapper,
                columns,
                currentGroup.dataIndex,
                groupKey,
                branchPathCopy,
                parent
              ) as GroupDataResult;
              
              if (idProperty) {
                tempAggregatedRow[idProperty] = groupIdPrefix + '/' + groupKey;
              }
              
              const newGroupBy = groupBy.slice(1, groupBy.length);
              tempAggregatedRow.children = groupSelectedData(
                columns,
                subData,
                objWrapper,
                newGroupBy,
                selectedRowsIds,
                includeLeafs,
                String(tempAggregatedRow[idProperty || 'id']),
                branchPath!.slice(0, branchPath!.length),
                tempAggregatedRow,
                idProperty,
                filters
              );
              response.push(tempAggregatedRow);
            }
          }
        }
      });
    } else {
      const tempAggregatedRow = generateSummaryRow(
        data,
        objWrapper,
        columns,
        currentGroup.dataIndex,
        currentGroup.dataIndex,
        branchPathCopy,
        parent
      ) as GroupDataResult;
      
      if (idProperty) {
        tempAggregatedRow[idProperty] = currentGroup.dataIndex;
      }
      
      const newGroupBy = groupBy.slice(1, groupBy.length);
      tempAggregatedRow.children = groupSelectedData(
        columns,
        data,
        objWrapper,
        newGroupBy,
        selectedRowsIds,
        includeLeafs,
        currentGroup.dataIndex,
        branchPath.slice(0, branchPath.length),
        tempAggregatedRow,
        idProperty,
        filters
      );
      response.push(tempAggregatedRow);
    }
    return response;
  }
};

let createSessionProxyConfig = (
  getTesseract: GetTesseractFunction,
  allColumns: ExtendedColumnDef[],
  selectedColumns?: ExtendedColumnDef[]
): any => {
  selectedColumns = selectedColumns || allColumns;
  const selectedPropertyMap: { [key: string]: number } = {};
  const propertyMap: { [key: string]: number } = {};
  
  allColumns.forEach((item, index) => {
    propertyMap[item.name] = index;
    if (selectedColumns!.filter(x => x.name === item.name).length === 1) {
      selectedPropertyMap[item.name] = index;
    }
  });

  const childrenTablesMap: { [key: string]: any } = {};

  let classMeat = 'return class proxyReader{';
  classMeat += 'constructor(tempArray){this.raw = tempArray || []};';
  classMeat += 'get toJSON(){return () => this.array}';

  selectedColumns.forEach((item) => {
    if (item.resolve !== undefined) {
      const childrenTable = getTesseract(item.resolve.childrenTable);

      if (childrenTable !== undefined && !childrenTablesMap[item.resolve.childrenTable]) {
        childrenTablesMap[item.resolve.childrenTable] = {};
        childrenTablesMap[item.resolve.childrenTable][item.resolve.displayField] = 
          childrenTable.columns.findIndex((x: any) => x.name === item.resolve!.displayField);
      }
      
      classMeat += `get ${item.name}(){`;
      classMeat += `let childrenTable = getTesseract("${item.resolve.childrenTable}");`;
      classMeat += 'if(!childrenTable){return;}';
      
      if (item.resolve.underlyingField === item.name || !selectedPropertyMap[item.resolve.underlyingField]) {
        classMeat += `let underlyingData = childrenTable.getById(this.raw.${item.resolve.underlyingField});`;
      } else {
        classMeat += `let underlyingData = childrenTable.getById(this.${item.resolve.underlyingField});`;
      }
      
      classMeat += `if(!underlyingData || underlyingData.removed === true){return null;}`;
      
      if (item.resolve.template) {
        classMeat += `return _.template.call(this,'${item.resolve.template}')(underlyingData);`;
      } else {
        classMeat += `return underlyingData.${item.resolve.displayField};`;
      }
      classMeat += '}';
    } else if (typeof item.value === 'function') {
      classMeat += `get ${item.name}(){return (${item.value.toString()})(this, '${item.name}')}`;
    } else if (typeof item.value === 'string') {
      classMeat += `get ${item.name}(){return \`${item.value.replace(/\$\{[\w]*\}/g, x => x.replace('${', '${this.'))}\`}`;
    } else if (item.value !== undefined) {
      classMeat += `get ${item.name}(){return ${item.value};}`;
    } else if (item.expression !== undefined) {
      const customExpression = expressionEngine.generateExpressionTree(item.expression);
      classMeat += `get ${item.name}(){return expressionEngine.executeExpressionTree(${JSON.stringify(customExpression)}, this)}`;
    } else {
      classMeat += `get ${item.name}(){return this.raw.${item.name}}`;
    }
  });

  classMeat += `get removed(){return this.raw.removed}`;
  classMeat += 'get setData(){return (raw)=>{this.raw = raw;return this;}}';
  classMeat += 'get object(){return (()=>{return {';
  
  allColumns.forEach((item) => {
    if (selectedColumns!.filter(x => x.name === item.name).length === 1) {
      if (item.resolve !== undefined || item.value !== undefined || item.expression !== undefined) {
        classMeat += `${item.name} : this.${item.name},`;
      } else {
        classMeat += `${item.name} : this.raw.${item.name},`;
      }
    }
  });
  classMeat += '}})()}';

  classMeat += 'get array(){return (()=>{return [';
  allColumns.forEach((item) => {
    if (selectedColumns!.filter(x => x.name === item.name).length === 1) {
      if (item.resolve) {
        classMeat += `this.${item.name},`;
      } else {
        classMeat += `this.raw.${item.name},`;
      }
    }
  });
  classMeat += ']})()}';
  classMeat += '}';
  
  return new Function('getTesseract', '_', 'expressionEngine', classMeat)(getTesseract, _, expressionEngine);
};

let mergeColumns = (baseColumns: ExtendedColumnDef[], optionalColumns?: ExtendedColumnDef[]): ExtendedColumnDef[] => {
  if (!optionalColumns) {
    return baseColumns;
  }

  const updatedColumns: ExtendedColumnDef[] = [];
  
  baseColumns.forEach((item) => {
    const selectedColumns = optionalColumns.filter(c => c.name === item.name);
    if (selectedColumns && selectedColumns.length !== 0) {
      updatedColumns.push(_.assign(item, selectedColumns[0]));
    } else {
      updatedColumns.push(item);
    }
  });

  optionalColumns.forEach((item) => {
    if (updatedColumns.filter((c) => c.name === item.name).length === 0) {
      updatedColumns.push(item);
    }
  });
  
  return updatedColumns;
};

function compareFieldSource(field: string, i: number, asc: boolean): string {
  const left = asc ? `a${i}` : `b${i}`;
  const right = asc ? `b${i}` : `a${i}`;

  return `
        const a${i} = a.${field}, b${i} = b.${field};

        if (${left} === undefined || ${left} === null) {
            return -1;
        } else if (${right} === undefined || ${right} === null) {
            return 1;
        }
        switch (typeof ${left}) {
            case 'boolean':
                return ${left} === true ? 1 : -1;
            case 'bigint':
                return ${left} > ${right} ? 1 : -1;
            default:
                const r${i} = ${left}.localeCompare(${right});
                if (r${i} !== 0) {
                    return r${i};
                }
        }
    `;
}

function applyOrder(sort: SortDef[], data: DataRow[], defaultObjDef: any): DataRow[] {
  if (!sort || !data[0]) {
    return data;
  }

  const dataWrapperA = new defaultObjDef(data[0]);
  const dataWrapperB = new defaultObjDef();
  let comparerSource = '';

  sort.forEach((item, index) => {
    comparerSource += compareFieldSource(
      item.field,
      index,
      ((item as any).direction || 'asc').toLowerCase() === 'asc'
    );
  });

  const comparer = new Function('a', 'b', `${comparerSource}; return 0;`) as Comparer;
  return data.sort((a, b) => comparer(dataWrapperA.setData(a), dataWrapperB.setData(b)));
}

interface SmartDebounceFunction {
  (...args: any[]): void;
  flush(): void;
  cancel(): void;
}

function smartDebounce(
  debouncedFn: (...args: any[]) => void = () => {},
  timeout: number = 100,
  leading: boolean = false
): SmartDebounceFunction {
  let maxWait = timeout;
  let flashDebounced: any;
  
  const clearQueue = (...args: any[]) => {
    const startTime = (new Date()).getTime();

    debouncedFn(...args);

    const measuredCalcTime = ((new Date()).getTime() - startTime);
    maxWait = measuredCalcTime < timeout ? timeout : measuredCalcTime;
    flashDebounced = _.debounce(() => {
      debouncedClearQueue.flush();
    }, maxWait, {
      maxWait: maxWait,
      trailing: true
    });
  };
  
  const debouncedClearQueue = _.debounce(clearQueue, maxWait, {
    leading: leading,
    trailing: true
  });
  
  flashDebounced = _.debounce(() => {
    debouncedClearQueue.flush();
  }, maxWait, {
    maxWait: maxWait,
    trailing: true
  });
  
  const run = ((...args: any[]) => {
    debouncedClearQueue(...args);
    flashDebounced();
  }) as SmartDebounceFunction;
  
  run.flush = () => {
    debouncedClearQueue.flush();
    flashDebounced.cancel();
  };
  
  run.cancel = () => {
    debouncedClearQueue.cancel();
    flashDebounced.cancel();
  };
  
  return run;
}

function guid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export {
  generateSummaryRow,
  getSimpleHeader,
  getHeader,
  groupData,
  groupSelectedData,
  applyOrder,
  createSessionProxyConfig,
  mergeColumns,
  smartDebounce,
  guid,
  GroupDataResult,
  ExtendedColumnDef
};
