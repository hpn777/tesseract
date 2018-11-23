const  {connect} = require('node-nats-streaming')
const EventHorizon = require('./eventHorizon')
const _ = require('lodash')

class TessSync extends EventHorizon{
    constructor(options){
        super(arguments)
        
    }

    async connect({clusterId, clientName, url} = {}){
        clusterId = clusterId || 'test-cluster'
        url = url || 'nats://nats:4222'
        this.clientName = clientName || 'test'
        
        return new Promise(resolve => {
            this.stan = connect(clusterId, this.clientName, {url: url})
            this.stan.on('connect',(nc) => {
                this.nc = nc
                let subscription = this.syncEvH()
                subscription.on('ready', ()=>{
                    resolve(nc) 
                })
            })
        })
    }

    close(){this.stan.close()}

    createTesseract(name, options) {
        return new Promise(resolve => {
            let tess = this.get(name)
            if(tess){
                resolve(tess)
            }
            else{
                let tess = super.createTesseract(name, options)
                if(this.nc && options.clusterSync && !options.disableDefinitionSync){
                    this.nc.publish('EvH.def',JSON.stringify({command: 'add', name: name, options: options}))
                }
                if(options.clusterSync){
                    let subscription = this.syncTesseract(tess,options.isDurableStream)
                    subscription.then(()=>{ 
                        resolve(tess)
                    })
                }
                else{
                    resolve(tess)
                }
            }
        })
    }

    syncEvH() {
        if(!this.stan)
            return;
            
        let opts = this.stan.subscriptionOptions();
        
        opts.setDeliverAllAvailable();
        
        let subscription = this.nc.subscribe('EvH.def', opts);
        
        subscription.on('message', (msg) => {
            let tess
            let data = JSON.parse(msg.getData())
            switch(data.command){
                case 'add':
                    this.createTesseract(data.name, _.extend(data.options, {disableDefinitionSync: true}))
                    break;
                case 'remove':
                    tess = super.get(name,data.tesseract)
                    if(tess)
                        tess.remove()
                    break;
            }
        })
        return subscription
    }

    syncTesseract(tesseract, isDurableStream) {
        let table = tesseract.get('id');
        let remote
        let updateTopic = 'tess.update.' + table
        let snapshotTopic = 'tess.snapshot.' + table
        let lastSeqNr = 0

        if(!this.stan)
            return;

        let subscribeToUpdates = ()=>{
            let opts = this.stan.subscriptionOptions();
        
            if(isDurableStream){
                opts.setDurableName(this.clientName + '.' + updateTopic);
            }
            
            opts.setStartAtSequence(lastSeqNr)
            let subscription = this.nc.subscribe(updateTopic, opts);
            
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

        return subscribeToSnapshots()
    }
}

module.exports = TessSync
