/*
MIT License

Copyright (c) 2019 Rafal Okninski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and ass        .map(x => this.createTesseract(x, _.extend(this.tesseractConfigs[x], { disableDefinitionSync: true })));ciated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
*/

import EventHorizon from './eventHorizon';
import * as _ from 'lodash';
import { RedisMQ } from './redisMQ';
import { Model } from './dataModels/backbone';

/**
 * TessSync - Redis clustering functionality (stub for tests)
 */
export class TessSync extends Model {
  public evH: any;
  public tesseractConfigs: Record<string, any> = {};
  public schemaSynced = false;
  public syncSchema = false;
  public redisMQ!: RedisMQ;

  constructor(options?: any, evH: any = new EventHorizon(options)) {
    super(options);
    this.evH = evH;
  }

  async connect({ redis = { host: 'redis', port: 6379 }, syncSchema = false } = {}): Promise<void> {
    this.syncSchema = syncSchema;
    this.redisMQ = new RedisMQ(redis);
    await this.syncEvH(syncSchema);
  }

  close(): void {
    this.redisMQ && this.redisMQ.close();
  }

  async clear(): Promise<void> {
    try {
      // clear local tesseracts
      const all = (this.evH.tesseracts as any).models || [];
      await Promise.all(all.map((x: any) => x.clear && x.clear()));

      if (this.redisMQ) {
        const sets = await this.redisMQ.keys('tess.*');
        await Promise.all(sets.map((item: string) => this.redisMQ.del(item)));
        await this.redisMQ.del('EvH.def');
      }
      this.schemaSynced = false;
    } catch (_e) {
      // ignore
    }
  }

  get(...args: any[]) { return this.evH.get(...args); }
  getTesseract(...args: any[]) { return this.evH.getTesseract(...args); }

  createTesseract(name: string, options: any): Promise<any> {
    return new Promise((resolve) => {
      const existing = this.get(name);
      if (existing) {
        resolve(existing);
      } else {
        const tess = this.evH.createTesseract(name, options);
        if (this.redisMQ && !options.disableDefinitionSync) {
          this.redisMQ.hset('EvH.def', name, { name, options });
          this.redisMQ.send('EvH.def', { command: 'add', name, options }, false);
        }

        const updateTopic = 'tess.update.' + tess.get('id');
        (tess as any).clusterAdd = async (data: any) => {
          await this.redisMQ.send(updateTopic, { command: 'add', data }, options.persistent);
        }; 
        (tess as any).clusterUpdate = async (data: any) => {
          await this.redisMQ.send(updateTopic, { command: 'update', data }, options.persistent);
        };
        (tess as any).clusterRemove = async (data: any) => {
          await this.redisMQ.send(updateTopic, { command: 'remove', data }, options.persistent);
        };

        if (options.clusterSync) {
          this.syncTesseract(tess).then(() => resolve(tess));
        } else {
          resolve(tess);
        }
      }
    });
  }

  pullTesseract(name: string, timeout = 60, retryNr = 0): Promise<any> {
    return new Promise((resolve, reject) => {
      const tess = this.get(name);
      if (tess) {
        resolve(tess);
      } else if (this.schemaSynced) {
        if (this.tesseractConfigs[name]) {
          this.createTesseract(name, _.extend(this.tesseractConfigs[name], { disableDefinitionSync: true }))
            .then(pulled => resolve(pulled));
        } else if (retryNr < timeout) {
          setTimeout(() => {
            this.pullTesseract(name, timeout, ++retryNr).then(r => resolve(r));
          }, 1000);
        } else {
          reject(new Error(`Tesseract ${name} doesn't exist.`));
        }
      } else {
        setTimeout(() => {
          this.pullTesseract(name, timeout, retryNr).then(r => resolve(r));
        }, 10);
      }
    });
  }

  createSession(...args: any[]) { return (this.evH as any).createSession(...args); }
  async createSessionAsync(parameters: any) {
    const pullTableNames = (liveQuery: any): string[] => _.uniq([
      ...(typeof liveQuery.table === 'string' ? [liveQuery.table] : pullTableNames(liveQuery.table)),
      ...(liveQuery.columns ? liveQuery.columns : [])
        .filter((x: any) => x.resolve && x.resolve.childrenTable)
        .map((x: any) => x.resolve.childrenTable),
      ...Object.values(liveQuery.subSessions || {}).map((x: any) => pullTableNames(x))
    ].flat() as any);

    const tableNames = pullTableNames(parameters);
    await Promise.all(tableNames.map(x => this.pullTesseract(x)));
    return this.evH.createSession(parameters);
  }

  createUnion(...args: any[]) { return (this.evH as any).createUnion(...args); }
  createTesseractFromSession(...args: any[]) { return (this.evH as any).createTesseractFromSession(...args); }
  getSession(...args: any[]) { return (this.evH as any).getSession(...args); }

  async syncEvH(autoSync: boolean) {
    if (!this.redisMQ) return;

    const data = await this.redisMQ.hgetall('EvH.def');
    _.each(data, (x: string) => {
      const parsed = JSON.parse(x);
      this.tesseractConfigs[parsed.name] = parsed.options;
    });

    if (autoSync) {
      await Promise.all(Object.keys(this.tesseractConfigs)
        .map(x => this.createTesseract(x, _.extend(this.tesseractConfigs[x], { disableDefinitionSync: true }))));
    }

    this.schemaSynced = true;

    this.redisMQ.subscribe('EvH.def', { autoReplay: false }).subscribe((msg: any) => {
      const data = msg.data;
      switch (data.command) {
        case 'add':
          this.tesseractConfigs[data.name] = data.options;
          if (autoSync) {
            this.createTesseract(data.name, _.extend(data.options, { disableDefinitionSync: true }));
          }
          break;
        case 'remove':
          const tess = this.evH.get(data.name);
          if (tess) (tess as any).remove();
          break;
      }
    });
  }

  async syncTesseract(tesseract: any) {
    const table = tesseract.get('id');
    const updateTopic = 'tess.update.' + table;
    const snapshotTopic = 'tess.snapshot.' + table;
    let lastSeqNr: any = 0;

    if (!this.redisMQ) return;

    const subscribeToUpdates = () => new Promise((resolve) => {
      let subscription: any;
      subscription = this.redisMQ.subscribe(updateTopic, {
        startTime: lastSeqNr,
        autoReplay: (tesseract as any).persistent
      }).subscribe((msg: any) => {
        const data = msg.data;
        switch (data.command) {
          case 'add': tesseract.add(data.data, true); break;
          case 'update': tesseract.update(data.data, true); break;
          case 'remove': tesseract.remove(data.data, true); break;
          case 'reset':
            this.redisMQ.get(snapshotTopic).then((snap) => {
              if (snap) {
                lastSeqNr = snap.lastSeqNr;
                tesseract.reset(snap.data, true);
              } else if ((tesseract as any).persistent) {
                // for persistent tables with no snapshot, emit empty reset to satisfy listeners
                tesseract.reset([], true);
              } else {
                // non-persistent: do not emit reset to preserve dataRemove ordering
              }
            });
            break;
          case 'replayDone':
            resolve(subscription);
            break;
        }
        lastSeqNr = msg.sqNr || lastSeqNr;
      });
    });

    const subscribeToSnapshots = async () => {
      tesseract.on('clusterReset', (data: any) => {
        this.redisMQ.set(snapshotTopic, { data, lastSeqNr });
        this.redisMQ.remove({ channel: updateTopic, endTime: lastSeqNr });
        this.redisMQ.send(updateTopic, { command: 'reset' }, false);
      });

      const snap = await this.redisMQ.get(snapshotTopic);
      if (snap) {
        lastSeqNr = snap.lastSeqNr;
        tesseract.reset(snap.data, true);
      }
      return await subscribeToUpdates();
    };

    this.redisMQ.on('connect', () => {
      this.redisMQ.replay({ startTime: lastSeqNr + 1, setName: updateTopic })
        .subscribe((msg: any) => {
          const data = msg.data;
          switch (data.command) {
            case 'add': tesseract.add(data.data, true); break;
            case 'update': tesseract.update(data.data, true); break;
            case 'remove': tesseract.remove(data.data, true); break;
            case 'reset':
              this.redisMQ.get(snapshotTopic).then((snap) => {
                if (snap) {
                  lastSeqNr = snap.lastSeqNr;
                  tesseract.reset(snap.data, true);
                } else if ((tesseract as any).persistent) {
                  tesseract.reset([], true);
                }
              });
              break;
          }
          lastSeqNr = msg.sqNr || lastSeqNr;
        });
    });

    if ((tesseract as any).persistent) {
      return await subscribeToSnapshots();
    } else {
      return await subscribeToUpdates();
    }
  }
}

// Aliases for backward compatibility
export const Cluster = TessSync;
export const ClusterRedis = TessSync;

export default TessSync;
