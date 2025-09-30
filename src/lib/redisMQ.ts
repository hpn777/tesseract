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

import Redis from 'ioredis';
import { Observable, fromEvent } from 'rxjs';
import { filter } from 'rxjs/operators';

const baseTime = BigInt(new Date().getTime() * 1000000000);
const basehrTime = process.hrtime.bigint();

export interface RedisMQOptions {
  startTime?: number | string;
  endTime?: number | string;
  batchSize?: number;
  autoReplay?: boolean;
  setName?: string;
}

export interface RedisMQMessage {
  data: any;
  sqNr: string;
}

export interface RemoveOptions {
  channel: string;
  startTime?: number | string;
  endTime?: number | string;
}

export interface ReplayOptions {
  setName: string;
  startTime?: number | string;
  endTime?: number | string;
  batchSize?: number;
}

export interface SubscribeOptions {
  startTime?: number | string;
  autoReplay?: boolean;
}

export class RedisMQ {
  private pub: Redis;
  private sub: Redis;

  constructor(redisConfig: any = {}) {
    this.pub = new Redis(redisConfig);
    this.sub = new Redis(redisConfig);
    this.sub.setMaxListeners(10000);
  }

  on(event: string, listener: (...args: any[]) => void): Redis {
    return this.sub.on(event, listener);
  }

  async remove({ channel, startTime = 0, endTime = '+inf' }: RemoveOptions): Promise<number> {
    return this.pub.zremrangebyscore(channel, startTime, endTime);
  }

  close(): void {
    this.pub.disconnect();
    this.sub.disconnect();
  }

  async del(channel: string): Promise<number> {
    return this.pub.del(channel);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.pub.keys(pattern);
  }

  replay(options: ReplayOptions): Observable<any> {
    return new Observable((observer) => {
      const startTime = options.startTime || 0;
      const endTime = options.endTime || '+inf';
      const batchSize = options.batchSize || 10000;
      let offset = 0;
      let exit = false;

      const processBatch = async (setName: string) => {
        const batch = await this.pub.zrangebyscore(
          setName,
          startTime,
          endTime,
          'WITHSCORES',
          'LIMIT',
          offset,
          batchSize
        );
        
        const batchLength = batch.length / 2;

        for (let i = 0; i < batch.length; i += 2) {
          const message = JSON.parse(batch[i]);
          observer.next(message);
        }

        return {
          length: batch.length,
          full: batchLength === batchSize
        };
      };

      const loop = async () => {
        const { full } = await processBatch(options.setName);
        if (full && !exit) {
          offset += batchSize;
          loop();
        } else {
          observer.complete();
        }
      };

      loop();

      return () => {
        exit = true;
      };
    });
  }

  subscribe(topic: string, options: SubscribeOptions = {}): Observable<any> {
    const { startTime = 0, autoReplay = true } = options;
    const subMessage$ = fromEvent(this.sub, 'message');

    return new Observable(observer => {

      const subscription = subMessage$
        .pipe(filter((data: any): data is [string, string] => {
          const [channel] = data as [string, string];
          return channel === topic;
        }))
        .subscribe(([, message]: [string, string]) => {
          const obj = JSON.parse(message);
          observer.next(obj);
        });

      let replaySub: any;
      if (autoReplay) {
        replaySub = this.replay({
          setName: topic,
          startTime
        }).subscribe(
          message => observer.next(message),
          error => observer.error(error),
          () => {
            this.sub.subscribe(topic);
            observer.next({
              data: {
                command: 'replayDone'
              }
            });
          }
        );
      } else {
        this.sub.subscribe(topic);
        observer.next({
          data: {
            command: 'replayDone'
          }
        });
      }

      return () => {
        if (autoReplay && replaySub) {
          replaySub.unsubscribe();
        }
        subscription.unsubscribe();
      };
    });
  }

  async send(setName: string, data: any, persistant: boolean = true): Promise<RedisMQMessage> {
    const obj: RedisMQMessage = {
      data: data,
      sqNr: (baseTime + (process.hrtime.bigint() - basehrTime)).toString()
    };
    const message = JSON.stringify(obj);

    if (persistant) {
      await this.pub.zadd(setName, obj.sqNr, message);
    }

    await this.pub.publish(setName, message);
    return obj;
  }

  async get(setName: string): Promise<any> {
    const data = await this.pub.get(setName);
    return data ? JSON.parse(data) : null;
  }

  async set(setName: string, data: any): Promise<string> {
    return this.pub.set(setName, JSON.stringify(data));
  }

  async hget(setName: string, field: string): Promise<any> {
    const data = await this.pub.hget(setName, field);
    return data ? JSON.parse(data) : null;
  }

  async hgetall(setName: string): Promise<{ [key: string]: string }> {
    return this.pub.hgetall(setName);
  }

  async hset(setName: string, field: string, data: any): Promise<number> {
    return this.pub.hset(setName, field, JSON.stringify(data));
  }
}
