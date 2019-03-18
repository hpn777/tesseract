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

const _ = require('lodash')
const Tesseract = require('./tesseract')
const CommandPort = require('./commandPort')
const { Collection } = require('./dataModels/backbone')
const crypto = require('crypto')
/**
 * CacheResolver
 */
class EventHorizon{

	constructor(options = {}) {
        this.namespace = options.namespace
		if(options.commandPort){
			const commandPort = new CommandPort(this, options.commandPort)
		}
		this.tesseracts = new Collection()
		this.sessions = new Collection()
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

		let underlyingData = childrenTable.getById(data[resolve.underlyingField])
		if(underlyingData){
			// if(resolve.template){

			// }
			// else{
				return underlyingData[resolve.displayField]
			//}
		}
		else {
			return data[resolve.underlyingField];
		}
	}

	get(key) {
		const fullName = this.namespace ? this.namespace + '.' + key : key
		return this.tesseracts.get(fullName)
	}

	getTesseract(tableName) {
		return new Promise((resolve)=>{
			let tesseract = this.get(tableName)
			if(tesseract){
				resolve(tesseract)
			}
			else{
				this.on('add', (x)=>{
					if(x.get('id') === tableName){
						resolve(x)
					}
				})
			}
		})
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
			
			if(options.session){
				let subSession = this.createSession(options.session)
				return this.createTesseractFromSession(name, subSession)
			}
			else{
				var newTesseract = new Tesseract(options)
				this.tesseracts.add(newTesseract)
				this.registerTesseract(newTesseract)
				return newTesseract;
			}
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

				newSession.on('destroy', () => {
					childrenTable.off(null, null, newSession)
				})
            }
        })
    }

	// more here
	// options: { idProperty: 'row_id', columns: header }
	createTesseractFromSession(name, session) {
		let options = {
			columns: session.getSimpleHeader()
		}
		let newTesseract
		if(session.config.groupBy){
			let isDirtyCache = false
			let idsCache = {}
			let mapIds = (a, b) => {
				b.reduce((acc, item)=>{
					acc[item] = true
					return acc
				}, a)
			}

			var maxWait = 100
			let clearQueue = () => {
				const startTime = (new Date()).getTime()
				if(isDirtyCache){
					session.collectGarbage()
					newTesseract.reset(session.groupData())
					isDirtyCache = false
				}else{
					newTesseract.update(session.groupSelectedData(idsCache))
				}
				idsCache = {}

				maxWait = ((new Date()).getTime() - startTime)
				flashDebounced = _.debounce(() => { debouncedClearQueue.flush()}, maxWait, {maxWait: maxWait, trailing: true})
			}
			let debouncedClearQueue = _.debounce(clearQueue, maxWait)
			let flashDebounced = _.debounce(() => { debouncedClearQueue.flush()}, maxWait, {maxWait: maxWait, trailing: true})

			newTesseract = this.createTesseract(name, options)
			newTesseract.update(session.groupData(), true)
			session.on('dataUpdate', (data) => {
				mapIds(idsCache, data.addedIds)
				mapIds(idsCache, data.updatedIds)
				isDirtyCache = data.removedIds.length > 0 ? true : false
				debouncedClearQueue()
				flashDebounced()
			}, session)
		}
		else {
			newTesseract = this.createTesseract(name, options);
			newTesseract.update(session.getData(), true);
			session.on('dataUpdate', (data) => {
				newTesseract.update(data.addedData);
				newTesseract.update(data.updatedData);
				newTesseract.remove(data.removedIds);
			}, session)
		}

		newTesseract.on('destroy', () => {
			session.off(null, null, session)
		})

		return newTesseract;
	}

	createSession(parameters) {
		const sessionName = parameters.id || this.generateHash(parameters)
		const table = parameters.table
		let subSessions = []
		let tempCaches = []
		
		var existingSession = this.sessions.get(sessionName)
		if (existingSession) {
			return existingSession
		}
		
		parameters.getTesseract = this.get.bind(this)

		if(parameters.subSessions){
			_.each(parameters.subSessions, (item, ref)=>{
				let subSession = this.createSession(item)
				subSessions.push(subSession)
				let subSessionId = subSession.get('id')
				tempCaches.push(this.createTesseractFromSession(subSessionId, subSession))
				parameters.columns.forEach((column)=>{
					if(column.resolve && column.resolve.session === ref){
						column.resolve.childrenTable = subSessionId
					}
				})
			})
		}

		if(parameters.columns){
			parameters.columns.forEach((item)=>{
				if(item.resolve && typeof item.resolve.session === 'object'){
					let subSession = this.createSession(item.resolve.session)
					subSessions.push(subSession)
					let subSessionId = subSession.get('id')
					tempCaches.push(this.createTesseractFromSession(subSessionId, subSession))
					item.resolve.childrenTable = subSessionId
				}
			})
		}

		var tesseract = this.get(table)
		
		if (tesseract) {
			parameters.id = parameters.id || sessionName
			this.sessions.add(tesseract.createSession(parameters))
			let session = this.sessions.get(parameters.id)
			
			session.on('destroy', () => {
				tempCaches.forEach(x => {
					if(!x._events.dataUpdate){
						x.destroy()
					}
				})
				subSessions.forEach(x => {
					if(!x._events.dataUpdate){
						x.destroy()
					}
				})
				this.sessions.remove(session)
			})
			this.registerSession(session)
			return session
		}
		else{
			throw new Error(`Requested cache "${table}" doasnt exist.`)
		}
	}

	generateHash(obj){
		return crypto.createHash('md5').update(JSON.stringify(obj)).digest('hex')
	}

	getSession(sessionName) {
		return this.sessions.get(sessionName)
	}
}

module.exports = EventHorizon
