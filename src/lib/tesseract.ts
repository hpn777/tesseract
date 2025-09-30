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

import { Model, Collection, SetOptions } from './dataModels/backbone';
import * as _ from 'lodash';
import * as linq from 'linq';
import { getHeader, getSimpleHeader } from './utils';
import { Session } from './session';
import { 
  ColumnDef
} from '../types';

// Minimal expressionEngine facade to support expressions
const expressionEngine = {
  generateExpressionTree: (expression: string) => expression,
  executeExpressionTree: (_tree: any, data: any) => data
};

export interface TesseractConfig {
  data?: any[];
  columns?: ColumnDef[];
  primaryKey?: string;
  clusterSync?: boolean;
  defferedDataUpdateTime?: number;
  id?: string;
  resolve?: any;
  persistent?: boolean;
}

const UPDATE_REASON_DATA = 'dataUpdate';
const UPDATE_REASON_DATA_RESET = 'dataReset';

export class Tesseract extends Model {
  public id: string;
  public columns: ColumnDef[];
  private dataCache: any[] = [];
  private dataMap: { [key: string]: any } = {};
  public sessions: Collection
  public idProperty: string = 'id';
  public idIndex: number = 0;
  public clusterSync: boolean = false;
  public persistent: boolean = false;
  private secondaryIndexes: string[] = [];
  private dataIndex: { [key: string]: { [key: string]: any[] } } = {};
  private hasGarbage: boolean = false;
  private objDef: any;
  private defferedDataUpdateTime: number = 0;
  private updatedRows: any[] = [];
  private removedRows: any[] = [];
  private defferedDataUpdate?: Function;
  private defferedDataRemove?: Function;
  public refreshData?: Function;
  public refreshTesseract?: Function;
  private collectGarbage?: Function;
  // Wire-in resolver function from constructor options (EventHorizon.resolve)
  public resolverFn?: (resolver: any, data: any) => any;
  
  constructor(config: TesseractConfig) {
    super(config);
    
    this.id = config.id || this.generateGuid();
    // Support both TS-style { id } and legacy JS-style { name }
    this.columns = (config.columns || []).map((raw: any) => {
      const name = (raw && (raw.name ?? (raw.id as string))) as string;
      const col: ColumnDef = {
        name,
        title: raw?.title,
        primaryKey: raw?.primaryKey,
        secondaryKey: !!raw?.secondaryKey,
        value: raw?.value,
        defaultValue: raw?.defaultValue,
        columnType: raw?.columnType,
        aggregator: raw?.aggregator,
        expression: raw?.expression,
        resolve: raw?.resolve,
      };
      return col;
    });
    this.clusterSync = !!config.clusterSync;
    this.persistent = !!(config as any).persistent;
    this.defferedDataUpdateTime = config.defferedDataUpdateTime || 0;
    // Save resolver function from config
    this.resolverFn = (config as any).resolve;
    
    // Find primary key
    const pkColumn = this.columns.find(col => col.primaryKey);
    if (pkColumn) {
      this.idProperty = pkColumn.name;
    }
    
    this.idIndex = this.columns.findIndex(col => col.name === this.idProperty);
    
    this.sessions = new Collection();
    
    this.objDef = this.generateObjDef(this.columns);
    
    if (config.data) {
      this.dataCache = this.generateData(config.data);
      this.generateIndex();
    }

    // Initialize debounced functions
    this.refreshData = _.debounce(() => {
      this.trigger('dataUpdate', this.dataCache);
    }, 100, { maxWait: 100 });

    this.refreshTesseract = _.debounce((silent: boolean) => {
      this.dataCache.forEach(row => {
        this.generateRow(row, this.columns, row);
      });
      if (!silent) {
        this.trigger('dataUpdate', this.dataCache);
      }
    }, 100, { maxWait: 100 });

    this.collectGarbage = _.debounce(() => {
      if (this.hasGarbage) {
        this.dataCache = this.dataCache.filter(x => !x.removed);
        this.hasGarbage = false;
      }
    }, 100, { maxWait: 100 });

    this.updatedRows = [];
    this.removedRows = [];
    
    if (this.defferedDataUpdateTime > 0) {
      this.defferedDataUpdate = _.debounce((updatedData: any, disableClusterUpdate: boolean, updateReason: string) => {
        this.trigger('dataUpdate', updatedData, disableClusterUpdate, updateReason);
        this.updatedRows = [];
      }, 10, { maxWait: this.defferedDataUpdateTime });
      
      this.defferedDataRemove = _.debounce((removedRows: any, disableClusterUpdate: boolean, updateReason: string) => {
        this.trigger('dataRemove', removedRows, disableClusterUpdate, updateReason);
        this.removedRows = [];
      }, 10, { maxWait: this.defferedDataUpdateTime });
    }
  }

  public generateIndex(): void {
    this.secondaryIndexes = [];
    this.columns.forEach(column => {
      if (column.secondaryKey) {
        this.secondaryIndexes.push(column.name);
        this.dataIndex[column.name] = {};
        linq.from(this.dataCache)
          .groupBy((x: any) => x[column.name])
          .forEach((x: any) => {
            this.dataIndex[column.name][x.key()] = x.getSource();
          });
      }
    });
  }

  public updateIndex(newData: any, dataHolder: any): void {
    if (this.secondaryIndexes.length === 0) return;

    const idProperty = this.idProperty;
    const orgData = this.dataMap[newData[idProperty]];

    this.secondaryIndexes.forEach(indexName => {
      if (!orgData) {
        if (!this.dataIndex[indexName][newData[indexName]]) {
          this.dataIndex[indexName][newData[indexName]] = [];
        }
        this.dataIndex[indexName][newData[indexName]].push(dataHolder);
      } else if (newData[indexName] !== undefined && orgData[indexName] !== newData[indexName]) {
        if (!this.dataIndex[indexName][newData[indexName]]) {
          this.dataIndex[indexName][newData[indexName]] = [];
        }
        this.dataIndex[indexName][newData[indexName]].push(dataHolder);
        
        const tempValue = orgData[indexName];
        const index = this.dataIndex[indexName][tempValue].findIndex(x => x[idProperty] === newData[idProperty]);
        this.dataIndex[indexName][tempValue].splice(index, 1);
      }
    });

    this.dataMap[newData[this.idProperty]] = newData;
  }

  public removeFromIndex(newData: any): void {
    delete this.dataMap[newData[this.idProperty]];

    if (this.secondaryIndexes.length === 0) return;

    const idProperty = this.idProperty;

    this.secondaryIndexes.forEach(indexName => {
      const tempValue = newData[indexName];
      const index = this.dataIndex[indexName][tempValue].findIndex(x => x[idProperty] === newData[idProperty]);
      this.dataIndex[indexName][tempValue].splice(index, 1);
    });
  }

  public get(stuff: string): any {
    if ((this as any)[stuff]) {
      return (this as any)[stuff];
    }
  }

  public createSession(config: any): Session {
    const id = config.id || this.generateGuid();
    
    // Import Session dynamically to avoid circular dependency
    const Session = require('./session').Session;
    const session = new Session({
      id,
      tesseract: this,
      config,
      getTesseract: config.getTesseract || this.getTesseract.bind(this)
    });
    
    this.sessions.add(session);
    return session;
  }

  public getTesseract(): Promise<Tesseract> {
    return new Promise((resolve) => {
      resolve(this);
    });
  }

  public getData(): any[] {
    if (this.hasGarbage) {
      this.dataCache = this.dataCache.filter(x => !x.removed);
      this.hasGarbage = false;
    }
    return this.dataCache;
  }

  public getLinq(): any {
    let tempData = linq.from(this.dataCache);
    if (this.hasGarbage) {
      this.dataCache = tempData.where((x: any) => !x.removed).toArray();
      tempData = linq.from(this.dataCache);
      this.hasGarbage = false;
    }
    return tempData;
  }

  public getCount(): number {
    if (this.hasGarbage) {
      this.dataCache = this.dataCache.filter(x => !x.removed);
      this.hasGarbage = false;
    }
    return this.dataCache.length;
  }

  public getById(id: string): any {
    return this.dataMap[id];
  }

  public async add(data: any | any[], disableClusterUpdate: boolean = false): Promise<any[]> {
    if (!data) return [];
    
    if (!Array.isArray(data)) {
      data = [data];
    }

    const tempRows: any[] = [];
    if (this.clusterSync && !disableClusterUpdate) {
      await this.clusterAdd(data);
    } else {
      for (let i = 0; i < data.length; i++) {
        let tempRow = this.dataMap[data[i][this.idProperty]];
        if (!tempRow) {
          tempRow = this.generateRow(data[i], this.columns);
          this.dataCache.push(tempRow);
          this.updatedRows.push(tempRow);
          tempRows.push(tempRow);
        }
      }

      if (this.updatedRows.length > 0) {
        if (this.defferedDataUpdateTime > 0) {
          if (this.removedRows.length !== 0 && this.defferedDataRemove) {
            (this.defferedDataRemove as any).flush();
          }
          if (this.defferedDataUpdate) {
            this.defferedDataUpdate(this.updatedRows, disableClusterUpdate, UPDATE_REASON_DATA);
          }
        } else {
          this.trigger('dataUpdate', this.updatedRows, disableClusterUpdate, UPDATE_REASON_DATA);
          this.updatedRows = [];
        }
      }
    }

    return tempRows;
  }

  public addAsync(data: any | any[], disableClusterUpdate: boolean = false): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!data) {
        reject();
        return;
      }

      if (!Array.isArray(data)) {
        data = [data];
      }

      const handler = (x: any) => {
        if (x && x.length && x[0][this.idProperty] === (data as any[])[0][this.idProperty]) {
          this.off('dataUpdate', handler);
          resolve(x);
        }
      };

      this.on('dataUpdate', handler);
      this.add(data, disableClusterUpdate);
    });
  }

  public reset(data?: any[], disableClusterUpdate: boolean = false, suppressEvents: boolean = false): any[] {
    if (this.clusterSync && !disableClusterUpdate) {
      this.trigger('clusterReset', data || this.getData());
    } else if (data) {
      this.dataMap = {} as any;
      this.dataCache = this.generateData(data);
      if (!suppressEvents) {
        if (this.defferedDataUpdateTime > 0 && this.defferedDataUpdate) {
          (this.defferedDataUpdate as any).flush();
        }
        this.trigger('dataUpdate', this.dataCache, true, UPDATE_REASON_DATA_RESET);
      } else {
        this.clearSessions();
      }
    }
    return this.dataCache;
  }

  public async update(data: any | any[], disableClusterUpdate: boolean = false): Promise<any[]> {
    if (!data) return [];
    
    if (!Array.isArray(data)) {
      data = [data];
    }

    if ((data as any[]).length === 0) return [];

    const tempRows: any[] = [];
    if (this.clusterSync && !disableClusterUpdate) {
      await this.clusterUpdate(data as any[]);
    } else {
      for (let i = 0; i < (data as any[]).length; i++) {
        let tempRow;
        if (Array.isArray((data as any[])[i])) {
          tempRow = this.dataMap[(data as any[])[i][this.idIndex]];
        } else {
          tempRow = this.dataMap[(data as any[])[i][this.idProperty]];
        }

        if (tempRow) {
          this.generateRow((data as any[])[i], this.columns, tempRow);
          this.updatedRows.push(tempRow);
          tempRows.push(tempRow);
        } else {
          tempRow = this.generateRow((data as any[])[i], this.columns);
          this.updatedRows.push(tempRow);
          this.dataCache.push(tempRow);
          tempRows.push(tempRow);
        }
      }

      if (this.updatedRows.length > 0) {
        if (this.defferedDataUpdateTime > 0) {
          if (this.removedRows.length !== 0 && this.defferedDataRemove) {
            (this.defferedDataRemove as any).flush();
          }
          if (this.defferedDataUpdate) {
            this.defferedDataUpdate(this.updatedRows, disableClusterUpdate, UPDATE_REASON_DATA);
          }
        } else {
          this.trigger('dataUpdate', this.updatedRows, disableClusterUpdate, UPDATE_REASON_DATA);
          this.updatedRows = [];
        }
      }
    }

    return tempRows;
  }

  public updateAsync(data: any | any[], disableClusterUpdate: boolean = false): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!data) {
        reject();
        return;
      }

      if (!Array.isArray(data)) {
        data = [data];
      }

      const handler = (x: any) => {
        if (x && x.length && x[0][this.idProperty] === (data as any[])[0][this.idProperty]) {
          this.off('dataUpdate', handler);
          resolve(x);
        }
      };

      this.on('dataUpdate', handler);
      this.update(data, disableClusterUpdate);
    });
  }

  public async remove(data: string[] | string, disableClusterUpdate: boolean = false): Promise<void> {
    if (!Array.isArray(data)) data = [data];

    if (this.clusterSync && !disableClusterUpdate) {
      await this.clusterRemove(data);
    } else {
      for (let i = 0; i < data.length; i++) {
        const tempRow = this.dataMap[data[i]];
        if (tempRow) {
          tempRow.removed = true;
          this.removedRows.push(tempRow[this.idProperty]);
          this.hasGarbage = true;
          this.removeFromIndex(tempRow);
        }
      }

      if (this.removedRows.length > 0) {
        if (this.defferedDataUpdateTime > 0) {
          if (this.defferedDataUpdate && (this.defferedDataUpdate as any).flush) {
            (this.defferedDataUpdate as any).flush();
          }
          if (this.defferedDataRemove) {
            this.defferedDataRemove(this.removedRows, disableClusterUpdate);
          }
        } else {
          this.trigger('dataRemove', this.removedRows, disableClusterUpdate);
          this.removedRows = [] as any[];
        }
      }
    }
  }

  public removeAsync(data: string | number | Array<string | number>, disableClusterUpdate: boolean = false): Promise<any> {
    return new Promise((resolve, reject) => {
      if (data === undefined || data === null) {
        reject();
        return;
      }

      const ids = Array.isArray(data) ? data : [data];

      const handler = (removedIds: any[]) => {
        if (Array.isArray(removedIds) && ids.some(id => removedIds.includes(id as any))) {
          this.off('dataRemove', handler as any);
          resolve(removedIds);
        }
      };

      this.on('dataRemove', handler as any);
      this.remove(ids as any, disableClusterUpdate);
    });
  }

  public clear(disableClusterUpdate?: boolean | SetOptions, suppressEvents: boolean = false): Promise<void> | any {
    // Handle backbone-style options object vs tesseract-style boolean parameters
    if (typeof disableClusterUpdate === 'object') {
      // Backbone-style call - delegate to parent
      return super.clear(disableClusterUpdate);
    }
    
    // Tesseract-style call
    const disableCluster = disableClusterUpdate || false;
    return new Promise<void>((resolve) => {
      const ids = this.dataCache.map(x => x[this.idProperty]);
      if (this.clusterSync && !disableCluster) {
        const done = () => {
          this.off('dataRemove', onRemove as any);
          this.off('dataUpdate', onUpdate as any);
          resolve();
        };
        const onRemove = () => done();
        const onUpdate = (_data: any, _disable?: boolean, reason?: string) => {
          if (reason === UPDATE_REASON_DATA_RESET) done();
        };
        this.on('dataRemove', onRemove as any);
        this.on('dataUpdate', onUpdate as any);

        // Ensure remove is processed before reset to preserve event order
        const send = async () => {
          try { await this.clusterRemove(ids as any); } catch { /* ignore */ }
          this.trigger('clusterReset', []);
        };
        send();
      } else {
        if (!suppressEvents) {
          this.trigger('dataRemove', ids);
        } else {
          // Clear sessions quietly
          if (this.sessions && (this.sessions as any).models) {
            (this.sessions as any).models.forEach((x: any) => x.clear && x.clear());
          }
        }
        this.dataCache = [];
        this.dataMap = {} as any;
        resolve();
      }
    });
  }

  public updateColumns(newColumns: ColumnDef[], reset?: boolean): void {
    let updatedColumns: ColumnDef[] = reset ? newColumns : newColumns;
    this.columns = updatedColumns;
    this.objDef = this.generateObjDef(this.columns);
    this.refresh();
  }

  public refresh(): void {
    if (this.refreshTesseract) {
      this.refreshTesseract(false);
    }
  }

  private generateData(data: any[]): any[] {
    if (!data) return [];
    
    return data.map(row => this.generateRow(row, this.columns));
  }

  public generateRow(data: any, columns: ColumnDef[], dataHolder?: any, updateDataMap: boolean = true): any {
    let copyData = true;
    let arrayDataType = false;

    if (dataHolder !== undefined) {
      updateDataMap = false;
      if (dataHolder === data) {
        copyData = false;
      }
    } else if (data instanceof this.objDef) {
      dataHolder = data;
    } else {
      dataHolder = new this.objDef();
    }

    this.updateIndex(data, dataHolder);

    if (Array.isArray(data)) {
      arrayDataType = true;
    }

    for (let i = 0; i < columns.length; i++) {
      const column = columns[i];
      const propertyName = column.name;
      const defaultValue = (column as any).defaultValue;
      const value = column.value as any;
      const propertyValue = arrayDataType ? data[i] : data[propertyName];

      if (defaultValue !== undefined && (dataHolder as any)[propertyName] === undefined) {
        const valueType = typeof defaultValue;
        if (valueType === 'function') {
          (dataHolder as any)[propertyName] = (defaultValue as any)(dataHolder, propertyValue, propertyName);
        } else if (valueType === 'string') {
          (dataHolder as any)[propertyName] = _.template.call(dataHolder, defaultValue)(dataHolder);
        } else {
          (dataHolder as any)[propertyName] = defaultValue;
        }
      }

      if (value !== undefined) {
        const valueType = typeof value;
        if (valueType === 'function') {
          (dataHolder as any)[propertyName] = (value as any)(dataHolder, propertyValue, (dataHolder as any)[propertyName], propertyName);
        } else if (valueType === 'string') {
          (dataHolder as any)[propertyName] = _.template.call(dataHolder, value)(dataHolder);
        } else {
          (dataHolder as any)[propertyName] = value;
        }
      } else if (copyData && propertyValue !== undefined) {
        (dataHolder as any)[propertyName] = propertyValue;
      }

      if (column.expression !== undefined) {
        if ((column as any).customExpression === undefined && expressionEngine) {
          (column as any).customExpression = expressionEngine.generateExpressionTree(column.expression as any);
        }
        if ((column as any).customExpression && expressionEngine) {
          (dataHolder as any)[propertyName] = expressionEngine.executeExpressionTree((column as any).customExpression, dataHolder);
        }
      }

      if (column.resolve !== undefined && this.resolverFn) {
        (dataHolder as any)[propertyName] = this.resolverFn(column.resolve, dataHolder);
      }
    }

    if (updateDataMap) {
      this.dataMap[(dataHolder as any)[this.idProperty]] = dataHolder;
    }

    return dataHolder;
  }

  private generateObjDef(columns: ColumnDef[]): any {
    let classMeat = 'return class {';
    columns.forEach((column) => {
      classMeat += `"${column.name}"\n`;
    });
    classMeat += '"removed"\n}';

    // eslint-disable-next-line no-new-func
    return (new Function(classMeat))();
  }

  public returnTree(rootIdValue: any, parentIdField: string, groups?: any): any {
    const root = this.dataMap[rootIdValue];

    if (root) {
      if (!groups) {
        groups = _.groupBy(this.dataCache, (x: any) => x[parentIdField]);
      }

      const newItem = root;
      if (groups[newItem[this.idProperty]] && groups[newItem[this.idProperty]].length) {
        newItem.children = [];
        groups[newItem[this.idProperty]].forEach((x: any) => {
          if (x[this.idProperty] !== x[parentIdField]) {
            const childrenItem = this.returnTree(x[this.idProperty], parentIdField, groups);
            newItem.children.push(childrenItem);
          }
        });
      }

      newItem.leaf = !newItem.children;
      return newItem;
    }
  }

  public getHeader(excludeHiddenColumns?: boolean): any {
    return getHeader(this.columns as any, excludeHiddenColumns);
  }

  public getSimpleHeader(excludeHiddenColumns?: boolean): any {
    return getSimpleHeader(this.columns as any, excludeHiddenColumns);
  }

  // Cluster methods placeholders
  private async clusterAdd(_data: any[]): Promise<void> {
    // Implementation for cluster operations would go here
  }

  private async clusterUpdate(_data: any[]): Promise<void> {
    // Implementation for cluster operations would go here
  }

  private async clusterRemove(_data: string[]): Promise<void> {
    // Implementation for cluster operations would go here
  }

  public destroy(): void {
    this.trigger('destroy');
    this.off();
  }

  private generateGuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private clearSessions(): void {
    try {
      // Try to access sessions and clear them
      const sessions = (this.sessions as any);
      if (sessions && sessions.models && Array.isArray(sessions.models)) {
        sessions.models.forEach((x: any) => x.clearSession && x.clearSession());
      } else if (sessions && sessions.forEach) {
        sessions.forEach((x: any) => x.clearSession && x.clearSession());
      }
    } catch (e) {
      // Ignore errors in clearing sessions
    }
  }
}

export default Tesseract;
