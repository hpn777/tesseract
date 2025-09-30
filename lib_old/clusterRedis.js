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

const EventHorizon = require('./eventHorizon')
const _ = require('lodash')
const RedisMQ = require('./redisMQ')

class TessSync {
    constructor(options, evH = new EventHorizon(options)) {
        this.evH = evH
        this.tesseractConfigs = {}
        this.schemaSynced = false
    }

    async connect({
        redis = {
            host: 'redis',
            port: 6379
        },
        syncSchema = false
    }) {
        this.syncSchema = syncSchema
        this.redisMQ = new RedisMQ(redis)
        await this.syncEvH(syncSchema)
    }

    close() {
        this.redisMQ.close()
    }

    async clear() {
        await Promise.all([
            ...this.evH.tesseracts
            .map(x => x.clear())
        ])
        let sets = await this.redisMQ.keys('tess.*')
        await Promise.all(sets.map(item => this.redisMQ.del(item)))
        await this.redisMQ.del('EvH.def')
        this.schemaSynced = false
    }

    get(...args) {
        return this.evH.get(...args)
    }

    getTesseract(...args) {
        return this.evH.getTesseract(...args)
    }

    createTesseract(name, options) {
        return new Promise(resolve => {
            let tess = this.get(name)
            if (tess) {
                resolve(tess)
            } else {
                let tess = this.evH.createTesseract(name, options)
                if (this.redisMQ && !options.disableDefinitionSync) {
                    this.redisMQ.hset('EvH.def', name, {
                        name: name,
                        options: options
                    })
                    this.redisMQ.send('EvH.def', {
                        command: 'add',
                        name: name,
                        options: options
                    }, false)
                }

                const updateTopic = 'tess.update.' + tess.get('id')

                tess.clusterAdd = async data => {
                    await this.redisMQ.send(updateTopic, {
                        command: 'add',
                        data: data
                    }, options.persistent)
                }

                tess.clusterUpdate = async data => {
                    await this.redisMQ.send(updateTopic, {
                        command: 'update',
                        data: data
                    }, options.persistent)
                }

                tess.clusterRemove = async data => {
                    await this.redisMQ.send(updateTopic, {
                        command: 'remove',
                        data: data
                    }, options.persistent)
                }

                if (options.clusterSync) {
                    this.syncTesseract(tess)
                        .then(() => {
                            resolve(tess)
                        })
                } else {
                    resolve(tess)
                }
            }
        })
    }

    pullTesseract(name, timeout = 60, retryNr = 0) {
        return new Promise((resolve, reject) => {
            let tess = this.get(name)
            if (tess) {
                resolve(tess)
            } else if (this.schemaSynced) {
                if (this.tesseractConfigs[name]) {
                    this.createTesseract(name, _.extend(this.tesseractConfigs[name], {
                            disableDefinitionSync: true
                        }))
                        .then(pulledTess => {
                            resolve(pulledTess)
                        })
                } else if (retryNr < timeout) {
                    setTimeout(() => {
                        this.pullTesseract(name, timeout, ++retryNr).then(retriedTess => resolve(retriedTess))
                    }, 1000)
                } else {
                    reject(new Error(`Tesseract ${name} doesn't exist.`))
                }
            } else {
                setTimeout(() => {
                    this.pullTesseract(name, timeout, retryNr).then(retriedTess => resolve(retriedTess))
                }, 10)
            }
        })
    }

    createSession(...args) {
        return this.evH.createSession(...args)
    }

    async createSessionAsync(parameters) {
        let pullTableNames = (liveQuery) => {
            return _.uniq([
                ...(typeof liveQuery.table == 'string' ? [liveQuery.table] : pullTableNames(liveQuery.table)),
                ...(liveQuery.columns ? liveQuery.columns : [])
                .filter(x => x.resolve && x.resolve.childrenTable)
                .map((x) => x.resolve.childrenTable),
                ...Object.values(liveQuery.subSessions || {}).map((x) => pullTableNames(x))
            ].flat())
        }

        let tableNames = pullTableNames(parameters)

        await Promise.all([
            ...tableNames.map(x => this.pullTesseract(x))
        ])

        return this.evH.createSession(parameters)
    }

    createUnion(...args) {
        return this.evH.createUnion(...args)
    }

    createTesseractFromSession(...args) {
        return this.evH.createTesseractFromSession(...args)
    }

    getSession(...args) {
        return this.evH.getSession(...args)
    }

    // proxies to events
    // EventHorizon used to inherit from Collection
    on(...args) {
        return this.evH.on(...args)
    }

    off(...args) {
        return this.evH.off(...args)
    }

    once(...args) {
        return this.evH.once(...args)
    }

    trigger(...args) {
        return this.evH.trigger(...args)
    }

    async syncEvH(autoSync) {
        if (!this.redisMQ)
            return;

        let data = await this.redisMQ.hgetall('EvH.def')
            
        _(data).each(x => {
            x = JSON.parse(x)
            this.tesseractConfigs[x.name] = x.options
        })

        if (autoSync) {
            await Promise.all([
                ...Object.keys(this.tesseractConfigs)
                .map(x => this.createTesseract(x, _.extend(this.tesseractConfigs[x], {
                    disableDefinitionSync: true
                })))
            ])
        }

        this.schemaSynced = true

        this.redisMQ.subscribe('EvH.def', {
                autoReplay: false
            })
            .subscribe(msg => {
                let data = msg.data
                switch (data.command) {
                    case 'add':
                        this.tesseractConfigs[data.name] = data.options
                        if (autoSync) {
                            this.createTesseract(data.name, _.extend(data.options, {
                                disableDefinitionSync: true
                            }))
                        }
                        break;
                    case 'remove':
                        let tess = this.evH.get(data.name)
                        if (tess)
                            tess.remove()
                        break;
                }
            })
    }

    async syncTesseract(tesseract) {
        let table = tesseract.get('id');
        let updateTopic = 'tess.update.' + table
        let snapshotTopic = 'tess.snapshot.' + table
        let lastSeqNr = 0

        if (!this.redisMQ)
            return;

        let subscribeToUpdates = () => {
            return new Promise((resolve) => {
                let subscription = this.redisMQ.subscribe(updateTopic, {
                        startTime: lastSeqNr,
                        autoReplay: tesseract.persistent
                    })
                    .subscribe((msg) => {
                        let data = msg.data
                        switch (data.command) {
                            case 'add':
                                tesseract.add(data.data, true)
                                break;
                            case 'update':
                                tesseract.update(data.data, true)
                                break;
                            case 'remove':
                                tesseract.remove(data.data, true)
                                break;
                            case 'reset':
                                this.redisMQ.get(snapshotTopic).then((data) => {
                                    if (data) {
                                        lastSeqNr = data.lastSeqNr // reset lastSeqNr from the snapshot
                                        tesseract.reset(data.data, true)
                                    }
                                })
                                break
                            case 'replayDone':
                                resolve(subscription)
                                break;
                        }
                        lastSeqNr = msg.sqNr || lastSeqNr
                    })
            })
        }

        let subscribeToSnapshots = async () => {
            tesseract.on('clusterReset', (data) => {
                this.redisMQ.set(snapshotTopic, {
                    data: data,
                    lastSeqNr: lastSeqNr
                })
                this.redisMQ.remove({
                    channel: updateTopic,
                    endTime: lastSeqNr
                })
                this.redisMQ.send(updateTopic, {
                    command: 'reset'
                }, false)
            });

            let data = await this.redisMQ.get(snapshotTopic)
            if (data) {
                lastSeqNr = data.lastSeqNr // reset lastSeqNr from the snapshot
                tesseract.reset(data.data, true)
            }

            return await subscribeToUpdates()
                
        }

        this.redisMQ.on('connect', () => {
            this.redisMQ.replay({
                startTime: lastSeqNr + 1,
                setName: updateTopic
            }).subscribe(
                msg => {
                    let data = msg.data
                    switch (data.command) {
                        case 'add':
                            tesseract.add(data.data, true)
                            break;
                        case 'update':
                            tesseract.update(data.data, true)
                            break;
                        case 'remove':
                            tesseract.remove(data.data, true)
                            break;
                        case 'reset':
                            this.redisMQ.get(snapshotTopic).then((data) => {
                                if (data) {
                                    lastSeqNr = data.lastSeqNr // reset lastSeqNr from the snapshot
                                    tesseract.reset(data.data, true)
                                }
                            })
                            break;
                    }
                    lastSeqNr = msg.sqNr || lastSeqNr
                }
            )
        })


        if (tesseract.persistent) {
            return await subscribeToSnapshots()
        } else {
            return await subscribeToUpdates()
        }
    }
}

module.exports = TessSync