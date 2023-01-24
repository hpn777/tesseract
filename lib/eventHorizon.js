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
const linq = require('linq')
const Tesseract = require('./tesseract')
let {
	smartDebounce,
	guid
} = require('../lib/utils')
const {
	Collection
} = require('./dataModels/backbone')
const md5 = require('md5.js')
const UPDATE_REASON_DATA = 'dataUpdate'
const UPDATE_REASON_DATA_RESET = 'dataReset'

/**
 * CacheResolver
 */
class EventHorizon {

	constructor(options = {}) {
		this.namespace = options.namespace
		if (options.commandPort) {
			const CommandPort = require('./commandPort')
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

		let result = null
		let childrenTable = this.tesseracts.get(resolve.childrenTable)

		let underlyingData = childrenTable.getById(data[resolve.underlyingField])
		if (underlyingData) {
			if (underlyingData.removed === true) {
				return result;
			}
			if (resolve.displayTemplate) {
				result = _.template.call(underlyingData, resolve.displayTemplate)(underlyingData)
			} else {
				result = underlyingData[resolve.displayField]
			}
		} else {
			result = data[resolve.underlyingField];
		}
		return result

	}

	get(key) {
		const fullName = this.namespace ? this.namespace + '.' + key : key
		return this.tesseracts.get(fullName)
	}

	getTesseract(tableName) {
		return new Promise((resolve) => {
			let tesseract = this.get(tableName)
			if (tesseract) {
				resolve(tesseract)
			} else {
				this.on('add', (x) => {
					if (x.get('id') === tableName) {
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
		} else if (options) {
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

			if (resolved.length) {
				newTesseract.off('dataUpdate dataRemove', null, newTesseract)
				newTesseract.on('dataUpdate dataRemove', data => {
					tesseract.refreshTesseract()
				}, newTesseract)
			}
		})
	}

	registerSession(newSession) {
		if (!newSession.columns)
			return

		newSession.columns.filter(x => x.resolve).forEach(column => {
			var childrenTable = this.get(column.resolve.childrenTable)
			if (childrenTable) {
				childrenTable.off('dataUpdate dataRemove', null, newSession)
				childrenTable.on('dataRemove', data => {
					const updatedIds = data.reduce((acc, x) => {
						acc[x] = true
						return acc
					}, {})
					newSession.updateData(newSession.tesseract.getLinq().where(x => updatedIds[x[column.resolve.underlyingField]]), false, UPDATE_REASON_DATA)
				}, newSession)
				childrenTable.on('dataUpdate', (data, dissableClusterUpdate, updateReason) => {
					const idProperty = childrenTable.idProperty
					const updatedIds = data.reduce((acc, x) => {
						acc[x[idProperty]] = true
						return acc
					}, {})

					if (updateReason === UPDATE_REASON_DATA_RESET) {
						newSession.updateData(newSession.tesseract.getData(), false, updateReason)
					} else {
						newSession.updateData(newSession.tesseract.getData().filter(x => updatedIds[x[column.resolve.underlyingField]]), false, updateReason)
					}
				}, newSession)

				newSession.on('destroy', () => {
					childrenTable.off(null, null, newSession)
				})
			}
		})
	}

	createUnion(name, options) {
		let newTesseract = this.createTesseract(name, options)
		if (options.subSessions) {
			_.each(options.subSessions, sessionQuery => {
				let session = this.createSession(sessionQuery)
				newTesseract.update(session.getLinq().select(x => x.object).toArray(), true)
				session.on('dataUpdate', (data) => {
					if (data.addedIds.length !== 0)
						newTesseract.add(data.addedData.select(x => x.object).toArray())
					if (data.updatedIds.length !== 0)
						newTesseract.update(data.updatedData.select(x => x.object).toArray())
					if (data.removedIds.length !== 0)
						newTesseract.remove(data.removedIds)
				}, session)
				newTesseract.on('destroy', () => {
					session.destroy()
				})
			})
		}

		return newTesseract
	}

	createTesseractFromSession(name, session) {
		let options = {
			columns: session.getSimpleHeader(),
			clusterSync: false
		}
		let newTesseract
		if (session.config.groupBy && session.config.groupBy.length !== 0) {
			const firstGroupByIndex = session.config.groupBy[0].dataIndex
			//switch primaryKey to GroupBy 
			options.columns.forEach(x => {
				delete x.primaryKey
				if (x.name === firstGroupByIndex) {
					x.primaryKey = true
				}
			})

			let isDirtyCache = false
			let idsCache = {}
			let mapIds = (a, b) => {
				b.reduce((acc, item) => {
					acc[item] = true
					return acc
				}, a)
			}

			let clearQueue = new smartDebounce(() => {
				if (isDirtyCache) {
					session.collectGarbage()
					newTesseract.reset(session.groupData())
					isDirtyCache = false
				} else {
					newTesseract.update(session.groupSelectedData(idsCache))
				}
				idsCache = {}
			}, 100)

			newTesseract = this.createTesseract(name, options)
			newTesseract.update(session.groupData(), true)
			session.on('dataUpdate', (data) => {
				if (data.addedIds.length !== 0)
					mapIds(idsCache, data.addedIds)
				if (data.updatedIds.length !== 0)
					mapIds(idsCache, data.updatedIds)
				isDirtyCache = data.removedIds.length > 0 ? true : false
				clearQueue.run()
			}, session)
		} else {
			newTesseract = this.createTesseract(name, options)
			newTesseract.update(session.getLinq().select(x => x.object).toArray(), true)
			session.on('dataUpdate', (data) => {
				if (data.addedIds.length !== 0)
					newTesseract.add(data.addedData.select(x => x.object).toArray())
				if (data.updatedIds.length !== 0)
					newTesseract.update(data.updatedData.select(x => x.object).toArray())
				if (data.removedIds.length !== 0)
					newTesseract.remove(data.removedIds)
			}, session)
		}

		newTesseract.on('destroy', () => {
			session.off(null, null, session)
		})
		return newTesseract;
	}

	createSession(parameters, reuseSession = false) {
		let sessionName = parameters.id || this.generateHash(parameters)
		const table = parameters.table
		let subSessions = []
		let tempCaches = []
		let tesseract

		var existingSession = this.sessions.get(sessionName)
		if (existingSession) {
			if (!reuseSession)
				throw new Error(`Session "${sessionName}" already exist.`)
			return existingSession
		}

		parameters.getTesseract = this.get.bind(this)

		if (typeof table == 'string') {
			tesseract = this.get(table)
		} else if (typeof table == 'object') {
			let subSession = this.createSession(table, true)
			subSessions.push(subSession)
			let subSessionId = subSession.get('id')
			tesseract = this.createTesseractFromSession(subSessionId, subSession)

			tempCaches.push(tesseract)
		}

		if (parameters.subSessions) {
			_.each(parameters.subSessions, (item, ref) => {
				let subSession = this.createSession(item, true)
				subSessions.push(subSession)
				let subSessionId = subSession.get('id')
				tempCaches.push(this.createTesseractFromSession(subSessionId, subSession))
				parameters.columns.forEach((column) => {
					if (column.resolve && column.resolve.session === ref) {
						column.resolve.childrenTable = subSessionId
					}
				})
			})
		}

		if (parameters.columns) {
			parameters.columns.forEach((item) => {
				if (item.resolve && typeof item.resolve.session === 'object') {
					let subSession = this.createSession(item.resolve.session, true)
					subSessions.push(subSession)
					let subSessionId = subSession.get('id')
					tempCaches.push(this.createTesseractFromSession(subSessionId, subSession))
					item.resolve.childrenTable = subSessionId
				}
			})
		}

		if (tesseract) {
			parameters.id = parameters.id || sessionName
			this.sessions.add(tesseract.createSession(parameters))
			let session = this.sessions.get(parameters.id)

			session.on('destroy', () => {
				tempCaches.forEach(x => {
					if (!x._events.dataUpdate) {
						x.destroy()
					}
				})
				subSessions.forEach(x => {
					if (!x._events.dataUpdate) {
						x.destroy()
					}
				})
				this.sessions.remove(session)
			})
			this.registerSession(session)
			return session
		} else {
			throw new Error(`Requested cache "${table}" doasnt exist.`)
		}
	}

	generateHash(obj) {
		return new md5().update(JSON.stringify(obj)).digest('hex')
	}

	getSession(sessionName) {
		return this.sessions.get(sessionName)
	}
}

module.exports = EventHorizon