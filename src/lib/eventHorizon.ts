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
import { Tesseract } from './tesseract';
import { Session } from './session';
import { smartDebounce } from './utils';
import { Collection } from './dataModels/backbone';
import { 
  DataRow, 
  EventHorizonOptions, 
  SessionConfig, 
  DataUpdate, 
  EventCallback,
  TesseractOptions,
  ColumnDef,
  ResolveConfig,
  CreateSessionParameters,
} from '../types';

const UPDATE_REASON_DATA = 'dataUpdate';
const UPDATE_REASON_DATA_RESET = 'dataReset';

/**
 * EventHorizon - Central event management and data orchestration system
 */
export class EventHorizon {
  public namespace: string | undefined;
  public tesseracts: Collection;
  public sessions: Collection;

  constructor(options: EventHorizonOptions = {}) {
    this.namespace = options.namespace;
    
    if (options.commandPort) {
      try {
        // Dynamic import for optional CommandPort
        console.log('CommandPort integration would be implemented here');
      } catch (error) {
        console.warn('CommandPort module not available:', error);
      }
    }
    
    this.tesseracts = new Collection();
    this.sessions = new Collection();
  }

  // Proxy methods to tesseracts collection
  // EventHorizon used to inherit from Collection
  public on(...args: any[]): any {
    return (this.tesseracts as any).on(...args);
  }

  public off(...args: any[]): any {
    return (this.tesseracts as any).off(...args);
  }

  public once(...args: any[]): any {
    return (this.tesseracts as any).once(...args);
  }

  public trigger(...args: any[]): any {
    return (this.tesseracts as any).trigger(...args);
  }

  // Resolve data relationships between tables
  public resolve(resolve: ResolveConfig, data: DataRow): any {
    let result: any = null;
    if (!resolve.childrenTable) {
      return data[resolve.underlyingField];
    }
    const childrenTableRef = this.tesseracts.get(resolve.childrenTable) as Tesseract;
    
    if (childrenTableRef) {
      const underlyingData = childrenTableRef.getById(String(data[resolve.underlyingField]));
      
      if (underlyingData) {
        if (underlyingData.removed === true) {
          return result;
        }
        
        if (resolve.displayTemplate) {
          result = _.template.call(underlyingData, resolve.displayTemplate)(underlyingData);
        } else {
          result = underlyingData[resolve.displayField];
        }
      } else {
        result = data[resolve.underlyingField];
      }
    }
    
    return result;
  }

  public get(key: string): Tesseract | undefined {
    const fullName = this.namespace ? `${this.namespace}.${key}` : key;
    return this.tesseracts.get(fullName) as Tesseract | undefined;
  }

  public getTesseract(tableName: string): Promise<Tesseract> {
    return new Promise((resolve) => {
      const tesseract = this.get(tableName);
      
      if (tesseract) {
        resolve(tesseract);
      } else {
        this.on('add', (x: any) => {
          if (x.get('id') === tableName) {
            resolve(x);
          }
        });
      }
    });
  }

  // Create a new Tesseract instance
  public createTesseract(name: string, options: TesseractOptions): Tesseract {
    const tesseract = this.get(name);
    
    if (tesseract) {
      return tesseract;
    } else if (options) {
      const fullName = this.namespace ? `${this.namespace}.${name}` : name;
      const tesseractOptions = {
        ...options,
        id: fullName,
        resolve: this.resolve.bind(this)
      } as TesseractOptions;

      const newTesseract = new Tesseract(tesseractOptions);
      this.tesseracts.add(newTesseract);
      this.registerTesseract(newTesseract);
      return newTesseract;
    }
    
    throw new Error(`Tesseract "${name}" not found and no options provided to create it.`);
  }

  public registerTesseract(newTesseract: Tesseract): void {
    const resolvedColumns = newTesseract.columns.filter((x: any) => x.resolve);

    resolvedColumns.forEach((column: any) => {
      const resolveConfig = column.resolve as ResolveConfig;
      const childrenTable = this.tesseracts.get(resolveConfig.childrenTable) as Tesseract;
      
      if (childrenTable) {
        (childrenTable as any).off('dataUpdate dataRemove');
        (childrenTable as any).on('dataUpdate dataRemove', () => {
          newTesseract.refreshTesseract && newTesseract.refreshTesseract();
        });
      }
    });

    this.tesseracts.forEach((tesseract: any) => {
      const resolved = tesseract.columns
        .filter((column: any) => column.resolve)
        .filter((column: any) => column.resolve.childrenTable === newTesseract.id);

      if (resolved.length) {
        (newTesseract as any).off('dataUpdate dataRemove');
        (newTesseract as any).on('dataUpdate dataRemove', () => {
          tesseract.refreshTesseract();
        });
      }
    });
  }

  public registerSession(newSession: Session): void {
    if (!newSession.config.columns) return;

    const columnsWithResolve = newSession.config.columns.filter((x: ColumnDef) => x.resolve) as ColumnDef[];

    columnsWithResolve.forEach(column => {
      const resolveConfig = (column as any).resolve as ResolveConfig;
      if (!resolveConfig.childrenTable) {
        return; // nothing to wire yet
      }
      const childrenTable = this.get(resolveConfig.childrenTable);
      
      if (childrenTable) {
        (childrenTable as any).off('dataUpdate dataRemove');
        
        (childrenTable as any).on('dataRemove', (data: string[]) => {
          const updatedIds = data.reduce((acc: { [key: string]: boolean }, x: string) => {
            acc[x] = true;
            return acc;
          }, {});
          
          newSession.updateData(
            newSession.tesseract.getLinq().where((x: DataRow) => 
              updatedIds[String(x[resolveConfig.underlyingField])]
            ), 
            false, 
            UPDATE_REASON_DATA
          );
        });
        
        (childrenTable as any).on('dataUpdate', (data: DataRow[], _dissableClusterUpdate?: boolean, updateReason?: string) => {
          const idProperty = childrenTable.idProperty;
          const updatedIds = data.reduce((acc: { [key: string]: boolean }, x: DataRow) => {
            acc[String(x[idProperty])] = true;
            return acc;
          }, {} as { [key: string]: boolean });
          
          const arr = newSession.getLinq()
            .where((x: DataRow) => updatedIds[String(x[resolveConfig.underlyingField])])
            .select((x: any) => x.object)
            .toArray();
          
          newSession.updateData(arr, false, updateReason || UPDATE_REASON_DATA);
        });
      }
    });
  }

  public createUnion(name: string, options: TesseractOptions & { subSessions?: CreateSessionParameters[] }): Tesseract {
    const newTesseract = this.createTesseract(name, options);
    
    if (!newTesseract) {
      throw new Error(`Failed to create union tesseract: ${name}`);
    }
    
    if (options.subSessions) {
      _.each(options.subSessions, (sessionQuery: any) => {
        const session = this.createSession(sessionQuery);
        newTesseract.update(session.getLinq().select((x: any) => x.object).toArray(), true);
        
        session.on('dataUpdate', (data: DataUpdate) => {
          if (data.addedIds.length !== 0) {
            newTesseract.add(data.addedData.map((x: any) => x.object));
          }
          if (data.updatedIds && data.updatedIds.length !== 0) {
            newTesseract.update(data.updatedData?.map((x: any) => x.object) || []);
          }
          if (data.removedIds.length !== 0) {
            newTesseract.remove(data.removedIds);
          }
        }, session);
        
        newTesseract.on('destroy', () => {
          session.destroy();
        });
      });
    }

    return newTesseract;
  }

  public createTesseractFromSession(name: string, session: Session): Tesseract {
    const options: TesseractOptions = {
      columns: session.getSimpleHeader(),
      clusterSync: false
    };
    
    let newTesseract = this.get(name);

    if (session.config.groupBy && session.config.groupBy.length !== 0) {
      const firstGroupByIndex = session.config.groupBy[0].dataIndex;
      
      // Switch primaryKey to GroupBy
      options.columns?.forEach(x => {
        delete (x as any).primaryKey;
        if ((x as any).name === firstGroupByIndex) {
          (x as any).primaryKey = true;
        }
      });

      let isDirtyCache = false;
      let idsCache: { [key: string]: boolean } = {};
      
      const mapIds = (a: { [key: string]: boolean }, b: string[]) => {
        b.reduce((acc, item) => {
          acc[item] = true;
          return acc;
        }, a);
      };

      const clearQueue = smartDebounce(() => {
        if (isDirtyCache) {
          session.collectGarbage();
          newTesseract!.reset(session.groupData());
          isDirtyCache = false;
        } else {
          newTesseract!.update(session.groupSelectedData(idsCache));
        }
        idsCache = {};
      }, 100);

      if (!newTesseract) {
        newTesseract = this.createTesseract(name, options);
        if (!newTesseract) {
          throw new Error(`Failed to create tesseract: ${name}`);
        }
        newTesseract.update(session.groupData(), true);
      }
      
      session.on('dataUpdate', (data: DataUpdate) => {
        if (data.addedIds.length !== 0) {
          mapIds(idsCache, data.addedIds);
        }
        if (data.updatedIds && data.updatedIds.length !== 0) {
          mapIds(idsCache, data.updatedIds);
        }
        isDirtyCache = data.removedIds.length > 0;
        clearQueue();
      }, session);
    } else {
      if (!newTesseract) {
        newTesseract = this.createTesseract(name, options);
        if (!newTesseract) {
          throw new Error(`Failed to create tesseract: ${name}`);
        }
        newTesseract.update(session.getLinq().select((x: any) => x.object).toArray(), true);
      }
      
      session.on('dataUpdate', (data: DataUpdate) => {
        if (data.addedIds.length !== 0) {
          newTesseract!.add(data.addedData.map((x: any) => x.object));
        }
        if (data.updatedIds && data.updatedIds.length !== 0) {
          newTesseract!.update(data.updatedData?.map((x: any) => x.object) || []);
        }
        if (data.removedIds.length !== 0) {
          newTesseract!.remove(data.removedIds);
        }
      }, session);
    }

    newTesseract.on('destroy', () => {
      session.off();
    });
    
    return newTesseract;
  }

  public createSession(parameters: CreateSessionParameters, reuseSession = false): Session {
    const sessionName = parameters.id || this.generateHash(parameters);
    const table = parameters.table;
    const subSessions: Session[] = [];
    const tempCaches: Tesseract[] = [];
    let tesseract: Tesseract | undefined;

    const existingSession = this.sessions.get(sessionName) as unknown as Session;
    if (existingSession) {
      if (!reuseSession) {
        throw new Error(`Session "${sessionName}" already exists.`);
      }
      return existingSession;
    }

    (parameters as any).getTesseract = this.get.bind(this);

    if (typeof table === 'string') {
      tesseract = this.get(table);
    } else if (typeof table === 'object') {
      const subSession = this.createSession(table as CreateSessionParameters, true);
      subSessions.push(subSession);
      const subSessionId = subSession.get('id');
      tesseract = this.createTesseractFromSession(subSessionId, subSession);
      tempCaches.push(tesseract);
    }

    if (parameters.subSessions) {
      _.each(parameters.subSessions, (item: any, ref: any) => {
        const subSession = this.createSession(item, true);
        subSessions.push(subSession);
        const subSessionId = subSession.get('id');
        tempCaches.push(this.createTesseractFromSession(subSessionId, subSession));
        
        parameters.columns?.forEach((column) => {
          const resolveConfig = (column as any).resolve;
          if (resolveConfig && resolveConfig.session === ref) {
            resolveConfig.childrenTable = subSessionId;
          }
        });
      });
    }

    if (parameters.columns) {
      parameters.columns.forEach((item) => {
        const resolveConfig = (item as any).resolve;
        if (resolveConfig && typeof resolveConfig.session === 'object') {
          const subSession = this.createSession(resolveConfig.session as CreateSessionParameters, true);
          subSessions.push(subSession);
          const subSessionId = subSession.get('id');
          tempCaches.push(this.createTesseractFromSession(subSessionId, subSession));
          resolveConfig.childrenTable = subSessionId;
        }
      });
    }

    if (tesseract) {
      parameters.id = parameters.id || sessionName;
      this.sessions.add(tesseract.createSession(parameters as any));
      const session = this.sessions.get(parameters.id) as Session;

      session.on('destroy', () => {
        tempCaches.forEach(x => {
          if (!(x as any)._events.dataUpdate) {
            x.destroy();
          }
        });
        subSessions.forEach(x => {
          if (!(x as any)._events.dataUpdate) {
            x.destroy();
          }
        });
        this.sessions.remove(session as any);
      });
      
      this.registerSession(session);
      return session;
    } else {
      throw new Error(`Requested cache "${table}" doesn't exist.`);
    }
  }

  public generateHash(obj: any): string {
    // Simple hash implementation as md5.js placeholder
    return JSON.stringify(obj)
      .split('')
      .reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0)
      .toString(16);
  }

  public getSession(sessionName: string): Session | undefined {
    return this.sessions.get(sessionName) as Session | undefined;
  }
}

export default EventHorizon;
