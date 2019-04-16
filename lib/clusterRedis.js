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
            let subscription = this.syncEvH(syncSchema)
            resolve()
        })
    }

    close(){
        this.redisMQ.close()
    }

    clear(){
        this.redisMQ.keys('tess.*').then(x => {
            x.forEach(item => this.redisMQ.del(item))
        })
        this.redisMQ.del('EvH.def')
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
                    this.redisMQ.send('EvH.def', {command: 'add', name: name, options: options})
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

    pullTesseract(name) {
        return new Promise(resolve => {
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
                }
            }
            else{
                setTimeout(()=>{
                    this.pullTesseract(name).then(retriedTess => resolve(retriedTess))
                }, 10)
            }
        })
    }

    createSession(...args){
        return this.evH.createSession(...args)
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
        
        let initiateDefs = _.debounce(()=>{
            if(autoSync){
                _.each(this.tesseractConfigs, (item, attr) => {
                    this.createTesseract(attr, _.extend(item, {disableDefinitionSync: true}))
                })
            }
            this.schemaSynced = true
        }, 50)

        let subscription = this.redisMQ.subscribe('EvH.def')
            .subscribe(msg => {
                let tess
                let data = msg.data
                switch(data.command){
                    case 'add':
                        this.tesseractConfigs[data.name] = data.options
                        initiateDefs()
                        break;
                    case 'remove':
                        tess = this.evH.get(name,data.tesseract)
                        if(tess)
                            tess.remove()
                        break;
                }
            })

        return subscription
    }

    syncTesseract(tesseract) {
        let table = tesseract.get('id');
        let updateTopic = 'tess.update.' + table
        let snapshotTopic = 'tess.snapshot.' + table
        let lastSeqNr = 0

        if(!this.redisMQ)
            return;

        let subscribeToUpdates = ()=>{
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

            return subscription
        }
        
        let subscribeToSnapshots = ()=>{
            tesseract.on('clusterReset', (data) => {
                this.redisMQ.set(snapshotTopic, {data: data, lastSeqNr: lastSeqNr })
                this.redisMQ.remove({
                    channel: updateTopic,
                    endTime: lastSeqNr
                })
            });

            return new Promise((resolve)=>{
                this.redisMQ.get(snapshotTopic).then((data) => {
                    if(data){
                        lastSeqNr =  data.lastSeqNr// reset lastSeqNr from the snapshot
                        tesseract.reset(data.data, true)
                    }
                    let updatesSubscription = subscribeToUpdates()
                    resolve(updatesSubscription)
                })
            })
        }
        if(tesseract.persistent){
            return subscribeToSnapshots()
        }
        else{
            return new Promise((resolve)=>{
                let updatesSubscription = subscribeToUpdates()
                resolve(updatesSubscription)
            })
        }
    }
}

module.exports = TessSync
