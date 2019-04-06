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

const  {connect} = require('node-nats-streaming')
const EventHorizon = require('./eventHorizon')
const _ = require('lodash')

class TessSync{
    constructor(options, evH = new EventHorizon(options)){
        this.evH = evH
    }

    async connect({clusterId, clientName, url, syncSchema} = {}){
        clusterId = clusterId || 'test-cluster'
        url = url || 'nats://nats:4222'
        this.clientName = clientName || 'test'
        this.syncSchema = syncSchema

        return new Promise(resolve => {
            this.stan = connect(clusterId, this.clientName, {url: url})
            this.stan.on('connect',(nc) => {
                this.nc = nc
                if(syncSchema){
                    let subscription = this.syncEvH()
                    subscription.on('ready', ()=>{
                        resolve(nc) 
                    })
                }
                else{
                    resolve(nc)
                }
            })
        })
    }

    close(){this.stan.close()}

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
                if(this.nc && options.clusterSync && !options.disableDefinitionSync){
                    this.nc.publish('EvH.def',JSON.stringify({command: 'add', name: name, options: options}))
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
    
    syncEvH() {
        if(!this.stan)
            return;
            
        let opts = this.stan.subscriptionOptions();
        opts.setDeliverAllAvailable();
        
        let subscription = this.nc.subscribe('EvH.def', opts);
        
        let defs = {}
        let initiateDefs = _.debounce(()=>{
            _.each(defs, (item, attr) => {
                this.createTesseract(attr, _.extend(item, {disableDefinitionSync: true}))
            })
            defs = {}
        }, 50)

        subscription.on('message', (msg) => {
            let tess
            let data = JSON.parse(msg.getData())
            switch(data.command){
                case 'add':
                    defs[data.name] = data.options
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
        let lastAckSeqNr = 0
        let ackRequired = false

        let scheduleAck = _.debounce((msg)=>{
            ackRequired = true
        }, 100)

        if(!this.stan)
            return;

        let subscribeToUpdates = ()=>{
            let opts = this.stan.subscriptionOptions();
            
            if(tesseract.persistent)
                opts.setStartAtSequence(lastSeqNr)
            else
                opts.setDurableName(this.clientName + '.' + updateTopic);
                        
            //opts.setManualAckMode(true);
            let subscription = this.nc.subscribe(updateTopic, opts)
            subscription.on('message', (msg) => {
                let data = JSON.parse(msg.getData())
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
                lastSeqNr = msg.getSequence()

                // if(lastSeqNr%1000 === 0)
                //     console.log('-------------->',lastSeqNr)
                // if(ackRequired){
                //     msg.ack()
                //     ackRequired = false
                // }
                // else{
                //     scheduleAck()
                // }
            })

            tesseract.on('clusterAdd', (data) => {
                this.nc.publish(updateTopic,JSON.stringify({command: 'add', data: data}))
            });
        
            tesseract.on('clusterUpdate', (data) => {
                this.nc.publish(updateTopic,JSON.stringify({command: 'update', data: data}))
            });
        
            tesseract.on('clusterRemove', (data) => {
                this.nc.publish(updateTopic,JSON.stringify({command: 'remove', data: data}))
            });

            return subscription
        }
        
        let subscribeToSnapshots = ()=>{
            let opts = this.stan.subscriptionOptions();
            opts.setStartWithLastReceived()
            
            let subscription = this.nc.subscribe(snapshotTopic, opts);

            tesseract.on('clusterReset', (data) => {
                this.nc.publish(snapshotTopic,JSON.stringify({data: data, lastSeqNr: lastSeqNr }))
            });

            let finish = (resolve) => {
                subscription.close()// unsubscribe from snapshots
                let updatesSubscription = subscribeToUpdates()
                updatesSubscription.on('ready', ()=>{
                    resolve(updatesSubscription)
                })
            }

            return new Promise((resolve)=>{
                subscription.on('message', (msg) => {
                    let data = JSON.parse(msg.getData())
                    lastSeqNr =  data.lastSeqNr// reset lastSeqNr from the snapshot
                    tesseract.reset(data.data, true)
                    clearTimeout(timer)

                    finish(resolve)
                })
    
                let timer = setTimeout(()=>{
                    finish(resolve)
                }, 200)
            })
        }
        if(tesseract.persistent){
            return subscribeToSnapshots()
        }
        else{
            return new Promise((resolve)=>{
                let updatesSubscription = subscribeToUpdates()
                updatesSubscription.on('ready', ()=>{
                    resolve(updatesSubscription)
                })
            })
        }
    }
}

module.exports = TessSync
