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

class TessSync{
    constructor(options, evH = new EventHorizon(options)){
        this.evH = evH
        this.tesseractConfigs = {}
        this.schemaSynced = false
    }

    async connect({redis = {
            host: 'redis',
            port: 6379
        }, syncSchema = false}){

        this.syncSchema = syncSchema

        return new Promise(resolve => {
            this.redisMQ = new RedisMQ(redis)
            this.syncEvH(syncSchema).then(() => {
                resolve()
            })
        })
    }

    close(){
        this.redisMQ.close()
    }

    clear(){
        return Promise.all([
            ...this.evH.tesseracts
            .map(x => x.clear())
        ]).then(()=>{
            this.redisMQ.keys('tess.*').then(x => {
                x.forEach(item => this.redisMQ.del(item))
            })
            this.redisMQ.del('EvH.def')
        })
    }

    get(...args){
        return this.evH.get(...args)
    }

    getTesseract(...args){
        return this.evH.getTesseract(...args)
    }

    createTesseract(name, options) {
        return new Promise(resolve => {
            let tess = this.get(name)
            if(tess){
                resolve(tess)
            }
            else{
                let tess = this.evH.createTesseract(name, options)
                if(this.redisMQ && !options.disableDefinitionSync){
                    this.redisMQ.hset('EvH.def', name, {name: name, options: options})
                    this.redisMQ.send('EvH.def', {command: 'add', name: name, options: options}, false)
                }

                if(options.clusterSync){
                    this.syncTesseract(tess)
                        .then(()=>{ 
                            resolve(tess)
                        })
                }
                else{
                    resolve(tess)
                }
            }
        })
    }

    pullTesseract(name, timeout = 60, retryNr = 0) {
        return new Promise((resolve, reject) => {
            let tess = this.get(name)
            if(tess){
                resolve(tess)
            }
            else if(this.schemaSynced){
                if(this.tesseractConfigs[name]){
                    this.createTesseract(name, _.extend(this.tesseractConfigs[name], {disableDefinitionSync: true}))
                        .then(pulledTess => {
                            resolve(pulledTess)
                        })
                } else if(retryNr < timeout) {
                    setTimeout(()=>{
                        this.pullTesseract(name, timeout, ++retryNr).then(retriedTess => resolve(retriedTess))
                    }, 1000)
                }
                else{
                    reject(new Error(`Tesseract ${name} doesn't exist.`))
                }
            }
            else{
                setTimeout(()=>{
                    this.pullTesseract(name, timeout, retryNr).then(retriedTess => resolve(retriedTess))
                }, 10)
            }
        })
    }
    
    createSession(...args){
        return this.evH.createSession(...args)
    }

    async createSessionAsync(parameters){
        let pullTableNames = (liveQuery) => {
            return _.uniq([
                liveQuery.table, 
                ...(liveQuery.columns?liveQuery.columns:[])
                    .filter(x => x.resolve && x.resolve.childrenTable)
                    .map((x) => x.resolve.childrenTable),
                ...Object.values(liveQuery.subSessions || {}).map((x) => pullTableNames(x))
            ].flat())
        }
        
        let tableNames =  pullTableNames(parameters)
        
        await Promise.all([
            ...tableNames.map(x => this.pullTesseract(x))
        ])

        return this.evH.createSession(parameters)
    }

    createUnion(...args){
        return this.evH.createUnion(...args)
    }

    createTesseractFromSession(...args){
        return this.evH.createTesseractFromSession(...args)
    }

    getSession(...args){
        return this.evH.getSession(...args)
    }

    // proxies to eventow
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
    
    syncEvH(autoSync) {
        if(!this.redisMQ)
            return;

        return new Promise(resolve => {
            this.redisMQ.hgetall('EvH.def')
            .then(data => {
                _(data).each(x => {
                    x = JSON.parse(x)
                    this.tesseractConfigs[x.name] = x.options
                    
                })

                if(autoSync){
                    Promise.all([
                        ...Object.keys(this.tesseractConfigs)
                        .map(x => this.createTesseract(x, _.extend(this.tesseractConfigs[x], {disableDefinitionSync: true})))
                        ]).then(()=>{
                            resolve()
                        })
                }
                else{
                    resolve()
                }
                this.schemaSynced = true
            })

            this.redisMQ.subscribe('EvH.def', {autoReplay: false})
                .subscribe(msg => {
                    let data = msg.data
                    switch(data.command){
                        case 'add':
                            this.tesseractConfigs[data.name] = data.options
                            if(autoSync){
                                this.createTesseract(data.name, _.extend(data.options, {disableDefinitionSync: true}))
                            }
                            break;
                        case 'remove':
                            let tess = this.evH.get(data.name)
                            if(tess)
                                tess.remove()
                            break;
                    }
                })
        }) 
    }

    syncTesseract(tesseract) {
        let table = tesseract.get('id');
        let updateTopic = 'tess.update.' + table
        let snapshotTopic = 'tess.snapshot.' + table
        let lastSeqNr = 0

        if(!this.redisMQ)
            return;

        let subscribeToUpdates = ()=>{
            return new Promise((resolve)=>{
                let subscription = this.redisMQ.subscribe(updateTopic, {startTime: lastSeqNr})
                    .subscribe((msg) => {
                        let data = msg.data
                        switch(data.command){
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
                                    if(data){
                                        lastSeqNr =  data.lastSeqNr// reset lastSeqNr from the snapshot
                                        tesseract.reset(data.data, true)
                                    }
                                })
                                break
                            case 'replayDone':
                                resolve(subscription)
                                break;
                        }
                        lastSeqNr = msg.sqNr
                    })

                tesseract.on('clusterAdd', (data) => {
                    this.redisMQ.send(updateTopic, {command: 'add', data: data})
                });
            
                tesseract.on('clusterUpdate', (data) => {
                    this.redisMQ.send(updateTopic, {command: 'update', data: data})
                });
            
                tesseract.on('clusterRemove', (data) => {
                    this.redisMQ.send(updateTopic, {command: 'remove', data: data})
                });
            })
        }

        let subscribeToSnapshots = ()=>{
            tesseract.on('clusterReset', (data) => {
                this.redisMQ.set(snapshotTopic, {data: data, lastSeqNr: lastSeqNr })
                this.redisMQ.remove({
                    channel: updateTopic,
                    endTime: lastSeqNr
                })
                this.redisMQ.send(updateTopic, {command: 'reset'}, false)
            });

            return new Promise((resolve)=>{
                this.redisMQ.get(snapshotTopic).then((data) => {
                    if(data){
                        lastSeqNr =  data.lastSeqNr// reset lastSeqNr from the snapshot
                        tesseract.reset(data.data, true)
                    }

                    subscribeToUpdates().then((updatesSubscription) => {
                        resolve(updatesSubscription)
                    })
                })
            })
        }

        if(tesseract.persistent){
            return subscribeToSnapshots()
        }
        else{
            return new Promise((resolve)=>{
                subscribeToUpdates().then((updatesSubscription) => {
                    resolve(updatesSubscription)
                })
            })
        }
    }
}

module.exports = TessSync
