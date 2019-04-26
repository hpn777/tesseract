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

const Redis = require('ioredis')
const { Observable, fromEvent} = require('rxjs')
const { filter } = require('rxjs/operators')
const baseTime = BigInt(new Date().getTime() * 1000000000)
const basehrTime = process.hrtime.bigint()
//const microtime = require('microtime')

const RedisMQ = function(redisConfig = {}){
    const self = this
    const pub = new Redis(redisConfig)
    const sub = new Redis(redisConfig)
    const subMessage$ = fromEvent(sub, 'message')

    this.remove = async ({channel, startTime = 0, endTime = '+inf'}) => {
        return new Promise((resolve) => {
            return pub.zremrangebyscore(channel, startTime, endTime, (err, data)=>{
                resolve(data)    
            })
        })
    }

    this.close = () => {
        pub.disconnect()
        sub.disconnect()
    }

    this.del = async (channel) => {
        return new Promise((resolve) => {
            pub.del(channel, (err, data)=>{
                resolve(data)    
            })
        })
    }

    this.keys = async (pattern) => {
        return new Promise((resolve) => {
            pub.keys(pattern, (err, data)=>{
                resolve(data)    
            })
        })
    }

    this.replay = (options) => {
        return Observable.create((observer) => {
            const startTime = options.startTime || 0
            const endTime = options.endTime || '+inf'
            const batchSize = options.batchSize || 10000
            var offset = 0
            var exit = false

            const processBatch = (setName) => {
                return pub.zrangebyscore(setName, startTime, endTime, 'withscores', 'limit', offset, batchSize)
                    .then(batch => {
                        const batchLength = batch.length / 2
    
                        for(let i = 0; i < batch.length; i += 2) {
                            let message = JSON.parse(batch[i])
                            observer.next(message)
                        }
        
                        return {
                            length: batch.length,
                            full: batchLength === batchSize
                        }
                    })
            }

            const loop = () => {
                
                processBatch(options.setName)
                    .then(({length, full}) => {
                        // if batch is full do it all again immediatelly
                        if(full && !exit) {
                            offset += batchSize
                            loop()
                        } else {
                            observer.complete()
                        }
                    })
            }
        
            loop()

            return ()=>{
                exit = true
            }
        })
    }
    
    this.subscribe = (topic, {startTime = 0, autoReplay = true} = {}) => {

        return Observable.create(observer => {
            let subscription = subMessage$.pipe(filter(([channel, message]) => channel === topic))
                .subscribe(([channel, message]) => {
                    let obj = JSON.parse(message)
                    sqNr = obj.sqNr
                    observer.next(obj)
                })
            
            let replaySub
            if(autoReplay){
                replaySub = self.replay({setName: topic, startTime}).subscribe(
                message => observer.next(message),
                null, 
                ()=>{
                    sub.subscribe(topic, (err, count) => {
                        observer.next({data: {command: 'replayDone'}})
                    })
                })
            }
            else{
                sub.subscribe(topic, (err, count) => {
                    observer.next({data: {command: 'replayDone'}})
                })
            }

            return () => {
                if(autoReplay){
                    replaySub.unsubscribe()
                }
                subscription.unsubscribe()
            }
        })
    }

    let transaction = pub.multi()
    let schduleFlush = false
    
    this.send = (setName, data, persistant = true) => {
        let obj = {
            data: data,
            sqNr: (baseTime + (process.hrtime.bigint() - basehrTime)).toString()
        }
        let message = JSON.stringify(obj)

        if(persistant){
            transaction = transaction.zadd(setName, obj.sqNr, message)
        }
        transaction = transaction.publish(setName, message);
        
        if(!schduleFlush){
            schduleFlush = true
            schduleFlush = setImmediate(()=>{
                transaction.exec()
                transaction = pub.multi()
                schduleFlush = false
            })
        }
        return obj.sqNr
    }

    this.get = async (setName) => {
        return new Promise(resolve => {
            pub.get(setName, (err, data)=>{
                resolve(JSON.parse(data))
            })
        })
    }

    this.set = (setName, data) => {
        pub.set(setName, JSON.stringify(data))
    }

    this.hget = async (setName, field) => {
        return new Promise(resolve => {
            pub.hget(setName, field, (err, data)=>{
                resolve(JSON.parse(data))
            })
        })
    }

    this.hgetall = async (setName) => {
        return new Promise(resolve => {
            pub.hgetall(setName, (err, data)=>{
                resolve(data)
            })
        })
    }

    this.hset = (setName, field, data) => {
        pub.hset(setName, field, JSON.stringify(data))
    }

    return this
}

module.exports = RedisMQ