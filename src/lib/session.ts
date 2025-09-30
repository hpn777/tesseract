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

import { Model } from './dataModels/backbone';
import { Filters } from './filters';
import { Filter } from './filter';
import * as _ from 'lodash';
import * as linq from 'linq';
import {
  groupData,
  groupSelectedData,
  applyOrder,
  createSessionProxyConfig,
  getSimpleHeader,
  getHeader,
  mergeColumns,
  // smartDebounce - unused
} from './utils';

const UPDATE_REASON_DATA = 'dataUpdate';
// const UPDATE_REASON_DATA_RESET = 'dataReset'; // unused
const UPDATE_REASON_COLUMNS_CHANGED = 'columnsChanged';

export interface SessionConfig {
  id?: string;
  tesseract: any;
  getTesseract: () => Promise<any>;
  config: any;
}

/**
 * Session class for managing filtered/grouped data views
 * methods: getData, filterData, groupData, groupSelectedData
 * events: update, dataRemove
 */
export class Session extends Model {
  public filters: Filters;
  public isLive: boolean = true;
  public tesseract: any;
  public getTesseract: () => Promise<any>;
  public config: any;
  public columns: any[];
  public defaultObjDef: any;
  public dataWrapper: any;
  public requireFiltring: boolean = false;
  public hasGarbage: boolean = true;
  public idProperty: string;
  public idIndex: number;
  public permanentFilter: any;
  public dataCache: any[] = [];
  public dataMap: { [key: string]: any } = {};
  public requireSorting: boolean = false;
  public requireDataReset: boolean = false;

  constructor(model: SessionConfig, _options?: any) {
    super(model);

    this.filters = new Filters();
    this.isLive = true;

    // TODO: move this to constructor arguments
    this.tesseract = this.get('tesseract');
    this.getTesseract = this.get('getTesseract');
    this.config = this.get('config');
    const tesseractHeader = this.tesseract.getSimpleHeader();
    this.columns = this.config.columns || tesseractHeader;

    // generating proxy config
    const allColumns = mergeColumns(tesseractHeader, this.columns);
    this.defaultObjDef = createSessionProxyConfig(this.getTesseract, allColumns, this.columns);
    this.dataWrapper = new this.defaultObjDef();
    //---------------------

    this.requireFiltring = false;
    this.hasGarbage = true;

    //session primary key
    this.idProperty = this.tesseract.idProperty;
    this.idIndex = this.tesseract.idIndex;
    if (this.config.columns !== undefined) {
      const idColumn = this.columns.find((x: any) => x.primaryKey);

      if (idColumn) {
        this.idProperty = idColumn.name;
      }

      this.idIndex = this.columns.findIndex((x: any) => x.name === this.idProperty);
    }
    //-------------------

    this.permanentFilter = this.config.permanentFilter;

    this.refresh();

    this.tesseract.on('dataUpdate', (data: any, disableClusterUpdate: boolean, reason: string = UPDATE_REASON_DATA) => {
      this.updateData(data, disableClusterUpdate, reason);
    }, this);

    this.tesseract.on('dataRemove', (data: any, disableClusterUpdate: boolean) => {
      this.removeData(data, disableClusterUpdate);
    }, this);

    this.on('destroy', () => {
      this.tesseract.off(null, null, this);
    });
  }

  public refresh(): void {
    let query = linq.from(this.tesseract.getData());
    const idProperty = this.idProperty;

    if (this.columns) {
      query = query.select((x: any) => this.dataWrapper.setData(x));
    }

    if (this.hasGarbage || this.config.filter || this.config.permanentFilter) {
      const tempFilter = this.config.filter || [];
      const tempPermanentFilter = this.config.permanentFilter || [];
      this.config.filter = tempPermanentFilter.concat(tempFilter);
      this.filters.reset(this.config.filter.map((f: any) => new Filter(f)));
      query = query.where((x: any) => this.filters.applyFilters(x))
        .select((x: any) => x.raw);
      this.requireFiltring = false;
      this.hasGarbage = false;
    }

    if (this.config.sort) {
      this.dataCache = applyOrder(this.config.sort, query.toArray(), this.defaultObjDef);
      query = linq.from(this.dataCache);
      this.requireSorting = false;
    }

    this.dataCache = query.toArray();
    this.dataMap = query.aggregate({}, (acc: any, item: any) => {
      acc[item[idProperty]] = item;
      return acc;
    });
  }

  public updateData(data: any[], disableClusterUpdate: boolean, updateReason: string): any {
    const filters = this.filters;
    const addedRows: any[] = [];
    const updatedRows: any[] = [];
    const removedRows: any[] = [];
    const addedIds: any[] = [];
    const updatedIds: any[] = [];
    const removedIds: any[] = [];
    const idProperty = this.idProperty;

    if (filters.length) {
      data.forEach((item: any) => {
        const tempId = item[idProperty];
        const sessionItem = this.dataWrapper.setData(item);
        if (filters.applyFilters(sessionItem)) {
          if (this.dataMap[tempId]) {
            updatedRows.push(this.dataMap[tempId]);
            updatedIds.push(tempId);
          } else {
            this.dataCache.push(item);
            this.dataMap[tempId] = item;
            addedRows.push(item);
            addedIds.push(tempId);
          }
        } else {
          if (this.dataMap[tempId]) {
            removedIds.push(tempId);
            removedRows.push(this.dataMap[tempId]);

            delete this.dataMap[tempId];
            this.requireFiltring = true;
          }
        }
      });

      if (addedIds.length || updatedIds.length || removedIds.length) {
        this.requireSorting = true;
      }
    } else {
      data.forEach((item: any) => {
        const tempId = item[idProperty];

        if (this.dataMap[tempId]) {
          updatedRows.push(item);
          updatedIds.push(tempId);
        } else {
          this.dataCache.push(item);
          this.dataMap[tempId] = item;
          addedRows.push(item);
          addedIds.push(tempId);
        }
      });
      this.requireSorting = true;
    }

    const addedData = linq.from(addedRows).select((x: any) => this.dataWrapper.setData(x));
    const updatedData = linq.from(updatedRows).select((x: any) => this.dataWrapper.setData(x));
    const removedData = linq.from(removedRows).select((x: any) => this.dataWrapper.setData(x));

    const result = {
      addedIds: addedIds,
      addedData: addedData,
      updatedIds: updatedIds,
      updatedData: updatedData,
      updateReason: updateReason,
      removedIds: removedIds,
      removedData: removedData,
      toJSON: () => {
        return {
          addedIds: addedIds,
          addedData: addedData.select((x: any) => x.object).toArray(),
          updatedIds: updatedIds,
          updatedData: updatedData.select((x: any) => x.object).toArray(),
          updateReason: updateReason,
          removedIds: removedIds,
          removedData: removedData.select((x: any) => x.object).toArray(),
        };
      }
    };

    if (addedIds.length || updatedRows.length || removedRows.length) {
      this.trigger('dataUpdate', result, disableClusterUpdate);
    }

    return result;
  }

  public removeData(data: any[], disableClusterUpdate: boolean): any {
    const removedIds: any[] = [];
    const removedRows: any[] = [];
    data.forEach((item: any) => {
      if (this.dataMap[item]) {
        removedIds.push(item);
        removedRows.push(this.dataMap[item]);
        delete this.dataMap[item];
      }
    });

    const removedData = linq.from(removedRows).select((x: any) => this.dataWrapper.setData(x));

    const result = {
      addedIds: [],
      addedData: linq.from([]),
      updatedIds: [],
      updatedData: linq.from([]),
      removedIds: removedIds,
      removedData: removedData,
      toJSON: () => {
        return {
          addedIds: [],
          addedData: [],
          updatedIds: [],
          updatedData: [],
          removedIds: removedIds,
          removedData: removedData.select((x: any) => x.object).toArray()
        };
      }
    };

    if (removedRows.length) {
      this.requireFiltring = true;
      this.trigger('dataUpdate', result, disableClusterUpdate);
    }

    return result;
  }

  public clearSession(): void {
    this.dataCache = [];
    this.dataMap = {};
    this.requireDataReset = true;
  }

  private _getData(request?: any): any {
    const config = this.config;

    if (this.requireDataReset) {
      this.dataCache = this.tesseract.getData();
      this.requireDataReset = false;
    }

    if (request) {
      config.requestId = request.requestId;
      config.page = request.page;
      if (request.sort && JSON.stringify(config.sort) !== JSON.stringify(request.sort)) {
        config.sort = request.sort;
        this.requireSorting = true;
      }

      if (Array.isArray(request.filter)) {
        if (this.permanentFilter && this.permanentFilter.length) {
          request.filter = this.permanentFilter.concat(request.filter);
        }

        if (JSON.stringify(config.filter) !== JSON.stringify(request.filter)) {
          config.filter = request.filter;
          this.filters.reset(request.filter.map((f: any) => new Filter(f)));
          this.requireFiltring = true;
          this.requireSorting = true;
        }
      }

      config.start = request.start;
      config.limit = request.limit;
    }

    if (this.requireFiltring || this.requireSorting || config.start || config.limit) {
      let query = linq.from(this.dataCache);
      if (this.requireFiltring) {
        query = this.collectGarbage();
      }

      if (this.requireSorting && config.sort) {
        this.dataCache = applyOrder(config.sort, this.dataCache, this.defaultObjDef);
        query = linq.from(this.dataCache);
      }

      this.requireSorting = this.requireFiltring = false;

      if (config.start) {
        query = query.skip(config.start);
      }

      if (config.limit) {
        query = query.take(config.limit);
      }
      return query;
    } else {
      return linq.from(this.dataCache);
    }
  }

  public getData(request?: any): any[] {
    return this._getData(request).toArray();
  }

  public getById(id: any): any {
    return this.dataWrapper.setData(this.dataMap[id]);
  }

  public getLinq(request?: any): any {
    return this._getData(request).select((x: any) => this.dataWrapper.setData(x));
  }

  public getCount(): number {
    if (this.requireFiltring) {
      this.collectGarbage();
    }

    return this.dataCache.length;
  }

  public collectGarbage(): any {
    const indexedFilter = linq.from(this.config.filter)
      .firstOrDefault((x: any) =>
        x !== undefined &&
        x.field !== undefined &&
        this.tesseract.secondaryIndexes.indexOf(x.field) !== -1 &&
        (x.comparison === 'eq' || x.comparison === '==')) as any;

    let query;
    if (indexedFilter && indexedFilter.field) {
      query = linq.from(this.tesseract.dataIndex[indexedFilter.field][indexedFilter.value]);
    } else {
      query = linq.from(this.tesseract.getData());
    }

    query = query
      .select((x: any) => this.dataWrapper.setData(x))
      .where((x: any) => this.filters.applyFilters(x))
      .select((x: any) => x.raw);

    this.requireFiltring = false;
    this.hasGarbage = false;
    this.dataCache = [];
    this.dataMap = query.aggregate({}, (acc: any, item: any) => {
      this.dataCache.push(item);
      acc[item[this.idProperty]] = item;
      return acc;
    });
    return linq.from(this.dataCache);
  }

  public filterData(filtersAttr?: any[]): void {
    const config = this.config;

    if (filtersAttr) {
      if (this.permanentFilter) {
        config.filter = this.permanentFilter.concat(filtersAttr);
      } else {
        config.filter = filtersAttr;
      }
      this.filters.reset(config.filter.map((f: any) => new Filter(f)));
      this.requireFiltring = true;
      this.requireSorting = true;
    }
  }

  public groupData(groupBy?: any, includeLeafs?: boolean, nodeId?: string): any[] {
    const config = this.config;

    if (groupBy) {
      config.groupBy = groupBy;
    }

    const dataCache = this.getData();

    if (dataCache.length) {
      return groupData(
        this.columns,
        dataCache,
        this.dataWrapper,
        config.groupBy,
        includeLeafs !== undefined ? includeLeafs : config.includeLeafs,
        '',
        [],
        {},
        nodeId || this.tesseract.idProperty
      );
    } else {
      return [];
    }
  }

  public groupSelectedData(selectedRowsIds: any, groupBy?: any, includeLeafs?: boolean, nodeId?: string): any[] {
    const config = this.config;
    if (groupBy) {
      config.groupBy = groupBy;
    }
    return groupSelectedData(
      this.columns,
      this.getData(),
      this.dataWrapper,
      config.groupBy,
      selectedRowsIds,
      includeLeafs !== undefined ? includeLeafs : config.includeLeafs,
      '',
      [],
      {},
      nodeId || this.tesseract.idProperty,
      this.filters.items || []
    );
  }

  public returnTree(rootIdValue: any, parentIdField: string, groups?: any): any {
    const root = this.dataMap[rootIdValue];
    if (root) {
      if (!groups) {
        groups = this.getLinq()
          .select((x: any) => x.object)
          .groupBy((x: any) => x[parentIdField]);
      }

      const newItem = this.dataWrapper.setData(root).object;
      const subGroup = groups.firstOrDefault((x: any) => x.key() === rootIdValue, 0);
      if (subGroup) {
        newItem.children = [];
        subGroup
          .forEach((x: any) => {
            if (x[this.idProperty] !== rootIdValue) {
              const childrenItem = this.returnTree(x[this.idProperty], parentIdField, groups);
              newItem.children.push(childrenItem);
            }
          });
      }

      newItem.leaf = !newItem.children;
      return newItem;
    }
  }

  public updateColumns(updatedColumns: any[]): void {
    if (updatedColumns.findIndex((x: any) => x.name === 'removed')) {
      updatedColumns.push({
        name: 'removed',
        columnType: 'bool'
      });
    }

    this.columns = updatedColumns;
    const allColumns = mergeColumns(this.tesseract.columns, this.columns);
    this.defaultObjDef = createSessionProxyConfig(this.getTesseract, allColumns, this.columns);
    this.dataWrapper = new this.defaultObjDef();

    this.updateData(this.collectGarbage().toArray(), false, UPDATE_REASON_COLUMNS_CHANGED);
  }

  public getHeader(excludeHiddenColumns?: boolean): any {
    return getHeader(this.columns || this.tesseract, excludeHiddenColumns);
  }

  public getSimpleHeader(excludeHiddenColumns?: boolean): any {
    return getSimpleHeader(this.columns || this.tesseract, excludeHiddenColumns);
  }
}

export {
  UPDATE_REASON_DATA,
  UPDATE_REASON_COLUMNS_CHANGED,
};
