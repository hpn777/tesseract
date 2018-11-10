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
                this.syncEvH()
                resolve(nc) 
            })
        });
    }

    close(){this.stan.close()}

    createTesseract(name, options) {
        let tess = this.get(name)
        if(tess){
            return tess
        }
        else{
            let tess = super.createTesseract(name, options)
            if(this.nc && options.clusterSync && !options.disableDefinitionSync){
                this.nc.publish('EvH.def',JSON.stringify({command: 'add', name: name, options: options}))
            }
            if(options.clusterSync){
                this.syncTesseract(tess,options.isDurableStream)
            }
            return tess
        }
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
    }

    syncTesseract(tesseract, isDurableStream) {
        let table = tesseract.get('id');
        let topic = 'tess.' + table

        if(!this.stan)
            return;

        let opts = this.stan.subscriptionOptions();
        
        if(isDurableStream){
            opts.setDurableName(this.clientName + '.' + topic);
        }
        
        let subscription = this.nc.subscribe(topic, opts);
        
        subscription.on('message', (msg) => {
            let data = JSON.parse(msg.getData())
            switch(data.command){
                case 'add':
                    tesseract.add(data.data, true)
                    break;
                case 'update':
                    tesseract.update(data.data, false, true)
                    break;
                case 'remove':
                    tesseract.remove(data.data, true)
                    break;
            }
        })

        tesseract.on('clusterAdd', (data) => {
            this.nc.publish(topic,JSON.stringify({command: 'add', data: data}))
        });
    
        tesseract.on('clusterUpdate', (data) => {
            this.nc.publish(topic,JSON.stringify({command: 'update', data: data}))
        });
    
        tesseract.on('clusterRemove', (data) => {
            this.nc.publish(topic,JSON.stringify({command: 'remove', data: data}))
        });
    }
}

module.exports = TessSync