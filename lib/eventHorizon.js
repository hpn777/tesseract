const _ = require('lodash');
const Tesseract = require('./tesseract');
const Collection = require('./dataModels/collection');
const {mergeColumns} = require('./utils')
const crypto = require('crypto');
/**
 * CacheResolver
 */
class EventHorizon{

	constructor(options = {}) {
        this.namespace = options.namespace

		this.tesseracts = new Collection()
		this.sessions = new Collection()

		// is this even used?
		this.dataMap = {}
	}

	// proxies do eventow
	// EventHorizon used to inherit from Collection
	on(...args) {
		return this.tesseracts.on(...args)
	}

	off(...args) {
		return this.tesseracts.off(...args)
	}

	once(...args) {
		return this.tesseracts.once(...args)
	}

	trigger(...args) {
		return this.tesseracts.trigger(...args)
	}

	//resolve({table: 'client', valueField: 'id', value: 1})
	resolve(resolve, data) {

		let childrenTable = this.tesseracts.get(resolve.childrenTable)

		if(!childrenTable){
			console.trace('childrenTable is invalid.', resolve) 
		}

		let underlyingData = childrenTable.getById(data[resolve.underlyingName])
		if(underlyingData){
			// if(resolve.template){

			// }
			// else{
				return underlyingData[resolve.displayField]
			//}
		}
		else {
			return data[resolve.underlyingName];
		}
	}

	get(key) {
		const fullName = this.namespace ? this.namespace + '.' + key : key
		return this.tesseracts.get(fullName)
	}

	getList(table) {
		var tesseract = this.get(table)

		if (tesseract) {
			return tesseract.dataCache
		} else {
			return undefined
		}
	}

	// options: { idProperty: 'row_id', columns: header }
	createTesseract(name, options) {
		const tesseract = this.get(name)
		if (tesseract) {
			return tesseract
		}
		else if (options) {
			var fullName = this.namespace ? this.namespace + '.' + name : name
			options.id = fullName;
            options.resolve = this.resolve.bind(this)
            var newTesseract = new Tesseract(options)
            this.tesseracts.add(newTesseract)
            this.registerTesseract(newTesseract)
			return newTesseract;
		}
    }

    registerTesseract(newTesseract) {

        const resolvedColumns = newTesseract.columns.filter(x => x.resolve)

        resolvedColumns.forEach(column => {
            var childrenTable = this.tesseracts.get(column.resolve.childrenTable)
            if (childrenTable) {
                childrenTable.off('dataUpdate dataRemove', null, newTesseract)
                childrenTable.on('dataUpdate dataRemove', data => {
                    newTesseract.refreshTesseract()
                }, newTesseract)
            }
        })

        this.tesseracts.forEach(tesseract => {

            const resolved = tesseract.columns
                .filter(column => column.resolve)
                .filter(column => column.resolve.childrenTable === newTesseract.id)

            if(resolved.length) {
                newTesseract.off('dataUpdate dataRemove', null, newTesseract)
                newTesseract.on('dataUpdate dataRemove', data => {
                    tesseract.refreshTesseract()
                }, newTesseract)
            }
        })
    }

	registerSession(newSession) {
		if(!newSession.columns)
			return

        newSession.columns.filter(x => x.resolve).forEach(column => {
            var childrenTable = this.tesseracts.get(column.resolve.childrenTable)
            if (childrenTable) {
                childrenTable.off('dataUpdate dataRemove', null,newSession)
                childrenTable.on('dataRemove', data => {
                    newSession.removeData(newSession.getData())
				}, newSession)
				childrenTable.on('dataUpdate', data => {
                    newSession.updateData(newSession.tesseract.getData())
                }, newSession)
            }
        })
    }

	// more here
	// options: { idProperty: 'row_id', columns: header }
	createTesseractFromSession(name, session) {
		let options = {
			columns: session.getSimpleHeader()
		};
		let newTesseract
		if(session.config.groupBy){
			let idsCache = {}
			let mapIds = (a, b) => {
				b.reduce((acc, item)=>{
					acc[item] = true
					return acc
				}, a)
			}
			let clearQueue = () => {
				newTesseract.update(session.groupSelectedData(idsCache))
				idsCache = {}
			}
			let debouncedClearQueue = _.debounce(clearQueue)
			newTesseract = this.createTesseract(name, options)
			newTesseract.update(session.groupData(), true)
			session.on('dataUpdate', (data) => {
				mapIds(idsCache, data.updatedIds)
				debouncedClearQueue()
			})
		}
		else {
			newTesseract = this.createTesseract(name, options);
			newTesseract.update(session.getData(), true);
			session.on('dataUpdate', (data) => {
				newTesseract.update(data.updatedData);
				newTesseract.remove(data.removedIds);
			})
		}
		return newTesseract;
	}

	createSession(parameters) {
		const sessionName = this.generateHash(parameters)
		const table = parameters.table

		parameters.getTesseract = this.get.bind(this)

		var existingSession = this.sessions.get(sessionName)
		if (existingSession) {
			return existingSession
		}
		
		if(parameters.columns){
			parameters.columns.forEach((item)=>{
				if(item.resolve && item.resolve.session){
					let subSession = this.createSession(item.resolve.session)
					let subSessionId = subSession.get('id')
					this.createTesseractFromSession(subSessionId, subSession)
					item.resolve.childrenTable = subSessionId
				}
			})
		}

		var tesseract = this.get(table)
		
		if (tesseract) {
			parameters.id = parameters.id || sessionName
			this.sessions.add(tesseract.createSession(parameters))
			let session = this.sessions.get(parameters.id)
			this.registerSession(session)
			return session
		}
		else{
			throw 'Ouch!!!'
		}
		
		// returns undefined if none of the above match?5
	}

	generateHash(obj){
		return crypto.createHash('md5').update(JSON.stringify(obj)).digest('hex')
	}

	getSession(sessionName) {
		return this.sessions.get(sessionName)
	}
}

module.exports = EventHorizon