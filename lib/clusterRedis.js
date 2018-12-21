const EventHorizon = require('./eventHorizon')
const _ = require('lodash')
const RedisMQ = require('./redisMQ')

class TessSync{
    constructor(options, evH = new EventHorizon(options)){
        this.evH = evH
    }

    async connect({redis = {
            host: 'redis',
            port: 6379
        }, syncSchema = false}){

        this.syncSchema = syncSchema

        return new Promise(resolve => {
            this.redisMQ = new RedisMQ(redis)
            if(syncSchema){
                let subscription = this.syncEvH()
                resolve() 
            }
            else{
                resolve()
            }
        })
    }

    close(){

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
                if(this.redisMQ && options.clusterSync && !options.disableDefinitionSync){
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

    createSession(...args){
        return this.evH.createSession(...args)
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
        if(!this.redisMQ)
            return;
        
        let defs = {}
        let initiateDefs = _.debounce(()=>{
            _.each(defs, (item, attr) => {
                this.createTesseract(attr, _.extend(item, {disableDefinitionSync: true}))
            })
            defs = {}
        }, 50)

        let subscription = this.redisMQ.subscribe('EvH.def')
            .subscribe(msg => {
                let tess
                let data = msg.data
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
