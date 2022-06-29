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
const {
    Observable,
    fromEvent
} = require('rxjs')
const {
    filter
} = require('rxjs/operators')
const baseTime = BigInt(new Date().getTime() * 1000000000)
const basehrTime = process.hrtime.bigint()
//const microtime = require('microtime')

const RedisMQ = function (redisConfig = {}) {
    const self = this
    const pub = new Redis(redisConfig)
    const sub = new Redis(redisConfig)
    sub.setMaxListeners(10000)
    
    this.on = (...args) => {
        return sub.on(...args)
    }

    const subMessage$ = fromEvent(sub, 'message')
    sub.on('message', (x, y) => {console.log(x, y)})
    this.remove = async ({
        channel,
        startTime = 0,
        endTime = '+inf'
    }) => pub.zremrangebyscore(channel, startTime, endTime)

    this.close = () => {
        pub.disconnect()
        sub.disconnect()
    }

    this.del = async channel => pub.del(channel)

    this.keys = async pattern => pub.keys(pattern)

    this.replay = (options) => {
        return Observable.create((observer) => {
            const startTime = options.startTime || 0
            const endTime = options.endTime || '+inf'
            const batchSize = options.batchSize || 10000
            var offset = 0
            var exit = false

            const processBatch = async setName => {
                let batch = await pub.zrangebyscore(setName, startTime, endTime, 'withscores', 'limit', offset, batchSize)
                    
                const batchLength = batch.length / 2

                for (let i = 0; i < batch.length; i += 2) {
                    let message = JSON.parse(batch[i])
                    observer.next(message)
                }

                return {
                    length: batch.length,
                    full: batchLength === batchSize
                }
                    
            }

            const loop = async () => {

                let {full} =await processBatch(options.setName)
                if (full && !exit) {
                    offset += batchSize
                    loop()
                } else {
                    observer.complete()
                }
            }

            loop()

            return () => {
                exit = true
            }
        })
    }

    this.subscribe = (topic, {
        startTime = 0,
        autoReplay = true
    } = {}) => {

        return Observable.create(observer => {
            let subscription = subMessage$.pipe(filter(([channel, message]) => channel === topic))
                .subscribe(([channel, message]) => {
                    let obj = JSON.parse(message)
                    sqNr = obj.sqNr
                    observer.next(obj)
                })

            let replaySub
            if (autoReplay) {
                replaySub = self.replay({
                    setName: topic,
                    startTime
                }).subscribe(
                    message => observer.next(message),
                    null,
                    () => {
                        sub.subscribe(topic, (err, count) => {
                            console.log(err, count)
                            observer.next({
                                data: {
                                    command: 'replayDone'
                                }
                            })
                        })
                    })
            } else {
                sub.subscribe(topic, (err, count) => {
                    console.log(err, count)
                    observer.next({
                        data: {
                            command: 'replayDone'
                        }
                    })
                })
            }

            return () => {
                if (autoReplay) {
                    replaySub.unsubscribe()
                }
                subscription.unsubscribe()
            }
        })
    }

    this.send = async (setName, data, persistant = true) => {
        let obj = {
            data: data,
            sqNr: (baseTime + (process.hrtime.bigint() - basehrTime)).toString()
        }
        let message = JSON.stringify(obj)

        if (persistant) {
            pub.zadd(setName, obj.sqNr, message)
        }

        await pub.publish(setName, message)
        return obj
    }

    this.get = async (setName) => {
        let data = await pub.get(setName)
        return JSON.parse(data)
    }

    this.set = async (setName, data) => {
        return pub.set(setName, JSON.stringify(data))
    }

    this.hget = async (setName, field) => {
        let data = await pub.hget(setName, field)
        return JSON.parse(data)
    }

    this.hgetall = async (setName) => {
        return pub.hgetall(setName)
    }

    this.hset = (setName, field, data) => {
        return pub.hset(setName, field, JSON.stringify(data))
    }

    return this
}

module.exports = RedisMQ