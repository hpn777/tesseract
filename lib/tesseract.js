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
const {
	Collection,
	Model
} = require('./dataModels/backbone')
const {
	Session
} = require('./session')
const {
	ExpressionEngine,
	Functions
} = require('./expressionEngine')
const expressionEngine = new ExpressionEngine()
const UPDATE_REASON_DATA = 'dataUpdate'
const UPDATE_REASON_DATA_RESET = 'dataReset'

const {
	getSimpleHeader,
	getHeader,
	smartDebounce,
	guid
} = require('./utils')

/**
 * DataCache
 * events: update, dataRemoved, clusterAdd, removed, clusterUpdate
 */
class Tesseract extends Model {

	constructor({
		id,
		idProperty = 'id',
		resolve,
		columns,
		clusterSync,
		persistent,
		defferedDataUpdateTime
	}) {

		super({
			id,
			idProperty
		})

		this.dataMap = {}
		this.dataCache = []

		this.sessions = new Collection()
		this.on('destroy', () => {
			this.sessions.each(x => x.destroy())
		})


		this.id = id
		this.columns = columns
		this.resolve = resolve
		this.persistent = persistent
		this.idProperty = idProperty
		this.clusterSync = clusterSync
		this.defferedDataUpdateTime = defferedDataUpdateTime

		const idColumn = this.columns.find(x => x.primaryKey)

		if (idColumn) {
			this.idProperty = idColumn.name
		}

		this.idIndex = this.columns.findIndex(x => x.name === this.idProperty)

		// generating proxy config
		this.objDef = this.generateObjDef(this.columns)

		// create data index holder
		this.dataIndex = new this.objDef()
		this.secondaryIndexes = []
		this.dataIndex[this.idProperty] = this.dataMap
		this.generateIndex()
		// -----------

		this.refresh = new smartDebounce(() => {
			this.dataCache = _.debounce.generateData(this.dataCache)
			this.generateIndex()
			this.trigger('dataUpdate', this.dataCache)
		}, 100, { maxWait: 100 })

		this.refreshTesseract = new _.debounce(silent => {
			this.dataCache.forEach(row => {
				this.generateRow(row, this.columns, row)
			})
			if (!silent) {
				this.trigger('dataUpdate', this.dataCache)
			}
		}, 100, { maxWait: 100 })

		this.collectGarbage = new _.debounce(() => {
			if (this.hasGarbage) {
				this.dataCache = this.dataCache.filter(x => !x.removed)
				this.hasGarbage = false
			}
		}, 100, { maxWait: 100 })

		this.updatedRows = []
		this.removedRows = []
		if(defferedDataUpdateTime > 0){
			this.defferedDataUpdate = _.debounce((updatedData, disableClusterUpdate, updateReason) =>{
				this.trigger('dataUpdate', updatedData, disableClusterUpdate, updateReason)
				this.updatedRows = []
			}, 10, { maxWait: defferedDataUpdateTime })
			this.defferedDataRemove = _.debounce((removedRows, disableClusterUpdate, updateReason) =>{
				this.trigger('dataRemove', removedRows, disableClusterUpdate, updateReason)
				this.removedRows = []
			}, 10, { maxWait: defferedDataUpdateTime })
		}		
	}

	generateIndex() {
		this.secondaryIndexes = []
		this.columns.forEach(column => {
			if (column.secondaryKey) {
				this.secondaryIndexes.push(column.name)
				this.dataIndex[column.name] = {}
				linq.from(this.dataCache)
					.groupBy(x => x[column.name])
					.forEach((x) => {
						this.dataIndex[x.key()] = x.getSource()
					})
			}
		})
	}

	updateIndex(newData, dataHolder) {
		if (this.secondaryIndexes.length === 0)
			return;

		const idProperty = this.idProperty
		const orgData = this.dataMap[newData[idProperty]]

		this.secondaryIndexes.forEach(indexName => {
			if (!orgData) {
				if (!this.dataIndex[indexName][newData[indexName]])
					this.dataIndex[indexName][newData[indexName]] = []

				this.dataIndex[indexName][newData[indexName]].push(dataHolder)
			} else if (newData[indexName] !== undefined && orgData[indexName] !== newData[indexName]) {
				if (!this.dataIndex[indexName][newData[indexName]])
					this.dataIndex[indexName][newData[indexName]] = []

				this.dataIndex[indexName][newData[indexName]].push(dataHolder)
				const tempValue = orgData[indexName]
				this.dataIndex[indexName][tempValue].splice(this.dataIndex[indexName][tempValue].findIndex(x => x[idProperty] === newData[idProperty]), 1)
			}
		})

		this.dataMap[newData[this.idProperty]] = newData
	}

	removeFromIndex(newData) {
		delete this.dataMap[newData[this.idProperty]]

		if (this.secondaryIndexes.length === 0) {
			return;
		}

		const idProperty = this.idProperty

		this.secondaryIndexes.forEach(indexName => {
			const tempValue = newData[indexName]
			this.dataIndex[indexName][tempValue].splice(this.dataIndex[indexName][tempValue].findIndex(x => x[idProperty] === newData[idProperty]), 1)
		})
	}

	get(stuff) {
		if (this[stuff]) {
			return this[stuff]
		}
	}

	createSession(config) {
		const id = config.id || guid()
		const session = new Session({
			id,
			tesseract: this,
			config,
			getTesseract: config.getTesseract || this.getTesseract
		})
		this.sessions.add(session)
		return session
	}

	getTesseract() {
		return new Promise((resolve) => {
			resolve(this)
		})
	}

	getData() {
		if (this.hasGarbage) {
			this.dataCache = this.dataCache.filter(x => !x.removed)
			this.hasGarbage = false
		}

		return this.dataCache
	}

	getLinq() {
		let tempData = linq.from(this.dataCache)
		if (this.hasGarbage) {
			this.dataCache = tempData.where(x => !x.removed).toArray()
			tempData = linq.from(this.dataCache)
			this.hasGarbage = false
		}

		return tempData
	}

	getCount() {
		if (this.hasGarbage) {
			this.dataCache = this.dataCache.filter(x => !x.removed)
			this.hasGarbage = false
		}

		return this.dataCache.length
	}

	getById(id) {
		return this.dataMap[id]
	}

	async add(data, disableClusterUpdate = false) {

		if (!data) {
			return
		}

		if (!Array.isArray(data)) {
			data = [data]
		}

		var tempRows = []
		if (this.clusterSync && !disableClusterUpdate) {
			await this.clusterAdd(data)
		} else {
			for (var i = 0; i < data.length; i++) {
				var tempRow = this.dataMap[data[i][this.idProperty]]
				if (!tempRow) {
					tempRow = this.generateRow(data[i], this.columns)
					this.dataCache.push(tempRow)
					this.updatedRows.push(tempRow)
					tempRows.push(tempRow)
				}
			}

			if (this.updatedRows.length > 0) {
				if(this.defferedDataUpdateTime > 0){
					if(this.removedRows.length !== 0){
						this.defferedDataRemove.flush()
					}
					this.defferedDataUpdate(this.updatedRows, disableClusterUpdate, UPDATE_REASON_DATA)
				}
				else{
					this.trigger('dataUpdate', this.updatedRows, disableClusterUpdate, UPDATE_REASON_DATA)
					this.updatedRows = []
				}
			}
		}

		return tempRows
	}

	addAsync(data, disableClusterUpdate = false) {
		return new Promise((resolve, reject) => {
			if (!data) {
				reject()
			}

			if (!Array.isArray(data)) {
				data = [data]
			}

			this.on('dataUpdate', x => {
				if (x && x.length && x[0][this.idProperty] === data[0][this.idProperty]) {
					this.off('dataUpdate', null, data)
					resolve(x)
				}
			}, data)

			this.add(data, disableClusterUpdate)
		})
	}

	reset(data, disableClusterUpdate = false, suppressEvents = false) {
		if (this.clusterSync && !disableClusterUpdate) {
			this.trigger('clusterReset', data || this.getData())
		} else if (data) {
			this.dataMap = {}
			this.dataCache = this.generateData(data);
			if (!suppressEvents) {
				if(this.defferedDataUpdateTime > 0){
					this.defferedDataUpdate.flush()
				}
				this.trigger('dataUpdate', this.dataCache, true, UPDATE_REASON_DATA_RESET) //TODO implement data reset properly
			} else {
				this.sessions.each(x => x.clear())
			}
		}

		return this.dataCache
	}

	async update(data, disableClusterUpdate = false) {
		if (data) {
			if (!Array.isArray(data)) {
				data = [data]
			}

			var tempRows = []
			if (this.clusterSync && !disableClusterUpdate) {
				await this.clusterUpdate(data)
			} else {
				for (var i = 0; i < data.length; i++) {
					var tempRow = this.dataMap[data[i][this.idProperty]]
					if (tempRow) {
						this.generateRow(data[i], this.columns, tempRow)
					} else {
						tempRow = this.generateRow(data[i], this.columns)
						this.dataCache.push(tempRow);
					}
					tempRows.push(tempRow)
					this.updatedRows.push(tempRow);
				}
				if (this.updatedRows.length) {
					if(this.defferedDataUpdateTime > 0){
						if(this.removedRows.length !== 0){
							this.defferedDataRemove.flush()
						}
						this.defferedDataUpdate(this.updatedRows, disableClusterUpdate, UPDATE_REASON_DATA)
					}
					else{
						this.trigger('dataUpdate', this.updatedRows, disableClusterUpdate, UPDATE_REASON_DATA)
						this.updatedRows = []
					}
				}
			}
		}

		return tempRows
	}

	updateAsync(data, disableClusterUpdate = false) {
		return new Promise((resolve, reject) => {
			if (!data) {
				reject()
			}

			if (!Array.isArray(data)) {
				data = [data]
			}

			this.on('dataUpdate', x => {
				if (x && x.length && x[0][this.idProperty] === data[0][this.idProperty]) {
					this.off('dataUpdate', null, data)
					resolve(x)
				}
			}, data)

			this.update(data, disableClusterUpdate)
		})
	}

	async remove(data, disableClusterUpdate = false) {
		var tempId

		if (this.clusterSync && !disableClusterUpdate) {
			await this.clusterRemove(data)
		} else {
			this.hasGarbage = true
			for (var i = 0; i < data.length; i++) {
				tempId = data[i]
				if (this.dataMap[tempId]) {
					this.dataMap[tempId].removed = true
					this.removeFromIndex(this.dataMap[tempId])
					this.collectGarbage()
					this.removedRows.push(tempId)
				}
			}
			if(this.defferedDataUpdateTime > 0){
				if(this.updatedRows.length !== 0){
					this.defferedDataUpdate.flush()
				}
				this.defferedDataRemove(this.removedRows, disableClusterUpdate)
			}
			else{
				this.trigger('dataRemove', this.removedRows, disableClusterUpdate)
				this.removedRows = []
			}
		}
	}

	removeAsync(data, disableClusterUpdate = false) {
		return new Promise((resolve, reject) => {
			if (!data) {
				reject()
			}

			if (!Array.isArray(data)) {
				data = [data]
			}

			this.on('dataRemove', x => {
				if (x && x.length && x[0][this.idProperty] === data[0][this.idProperty]) {
					this.off('dataRemove', null, data)
					resolve(x)
				}
			}, data)

			this.remove(data, disableClusterUpdate)
		})
	}

	clear(disableClusterUpdate = false, suppressEvents = false) {
		return new Promise((resolve) => {
			if (this.clusterSync && !disableClusterUpdate) {
				this.clusterRemove(this.dataCache.map(x => x[this.idProperty]))
				this.trigger('clusterReset', [])
				this.once('dataRemove', () => {
					resolve()
				})
			} else {
				if (!suppressEvents) {
					//TODO flush deffered update first
					this.trigger('dataRemove', this.dataCache.map(x => x[this.idProperty]))
				} else {
					this.sessions.each(x => x.clear())
				}
				this.dataCache = []
				this.dataMap = {}
				resolve()
			}
		})

	}

	updateColumns(newColumns, reset) {

		var updatedColumns = [];
		if (reset) {
			updatedColumns = newColumns;
		}

		this.columns = updatedColumns
		this.objDef = this.generateObjDef(this.columns)

		this.refresh()
	}

	generateData(data) {

		if (!data) {
			return []
		}

		return data.map(row => {
			return this.generateRow(row, this.columns)
		})
	}

	generateRow(data, columns, dataHolder = undefined) {
		let copyData = true
		let arrayDataType = false

		if (dataHolder !== undefined) {
			if (dataHolder === data) {
				copyData = false
			}
		} else if (data instanceof this.objDef) {
			dataHolder = data
		} else {
			dataHolder = new this.objDef()
		}

		this.updateIndex(data, dataHolder)

		if (Array.isArray(data)) {
			arrayDataType = true
		}

		for (var i = 0; i < columns.length; i++) {
			const column = columns[i]
			const propertyName = column.name
			const defaultValue = column.defaultValue
			const value = column.value
			var propertyValue = arrayDataType ? data[i] : data[propertyName]

			if (defaultValue !== undefined && dataHolder[propertyName] === undefined) {
				const valueType = typeof (defaultValue)
				if (valueType === 'function') {
					dataHolder[propertyName] = defaultValue(dataHolder, propertyValue, propertyName);
				} else if (valueType == 'string') {
					dataHolder[propertyName] = _.template.call(dataHolder, defaultValue)(dataHolder)
				} else {
					dataHolder[propertyName] = defaultValue
				}
			}

			if (value !== undefined) {
				const valueType = typeof (value)
				if (valueType === 'function') {
					dataHolder[propertyName] = value(dataHolder, propertyValue, dataHolder[propertyName], propertyName);
				} else if (valueType == 'string') {
					dataHolder[propertyName] = _.template.call(dataHolder, value)(dataHolder)
				} else {
					dataHolder[propertyName] = value
				}
			} else if (copyData && propertyValue !== undefined) {
				dataHolder[propertyName] = propertyValue
			}

			if (column.expression !== undefined) {
				if (column.customExpression == undefined) {
					column.customExpression = expressionEngine.generateExpressionTree(column.expression)
				}
				dataHolder[propertyName] = expressionEngine.executeExpressionTree(column.customExpression, dataHolder)
			}

			if (column.resolve !== undefined) {
				dataHolder[propertyName] = this.resolve(column.resolve, dataHolder)
			}
		}

		this.dataMap[dataHolder[this.idProperty]] = dataHolder
		return dataHolder;
	}

	generateObjDef(columns) {
		var classMeat = 'return class {'
		columns.forEach((column, index) => {
			classMeat += `"${column.name}"\n`
		})
		classMeat += '"removed"\n}'

		return (new Function(classMeat))()
	}

	returnTree(rootIdValue, parentIdField, groups) { //TODO need to be fixed
		var root = this.dataMap[rootIdValue]

		if (root) {
			if (!groups) {
				groups = _(this.dataCache)
					.groupBy(x => x[parentIdField])
					.value()
			}

			var newItem = root
			if (groups[newItem[this.idProperty]] && groups[newItem[this.idProperty]].length) {
				newItem.children = []
				groups[newItem[this.idProperty]].forEach(x => {
					if (x[this.idProperty] !== x[parentIdField]) {
						var childrenItem = this.returnTree(x[this.idProperty], parentIdField, groups)
						newItem.children.push(childrenItem)
					}
				})

			}

			newItem.leaf = !newItem.children
			return newItem
		}
	}

	getHeader(excludeHiddenColumns) {
		return getHeader(this.columns, excludeHiddenColumns)
	}

	getSimpleHeader(excludeHiddenColumns) {
		return getSimpleHeader(this.columns, excludeHiddenColumns)
	}
}

module.exports = Tesseract