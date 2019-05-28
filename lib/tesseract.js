﻿/*
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
const { Collection, Model } = require('./dataModels/backbone')
const { Session } = require('./session')
const {ExpressionEngine, Functions} = require('./expressionEngine')
const expressionEngine = new ExpressionEngine()

const {
	generateSummaryRow,
	getSimpleHeader,
	getHeader,
	createTesseractProxyConfig,
	guid
} = require('./utils')

/**
 * DataCache
 * events: update, dataRemoved, clusterAdd, removed, clusterUpdate
 */
class Tesseract extends Model {

	constructor({id, idProperty = 'id', resolve, columns, clusterSync, persistent}) {

		super({id, idProperty})
		
        this.dataMap = {}
		this.dataCache = []

		this.sessions = new Collection()
		this.on('destroy', ()=>{
			this.sessions.each(x=>x.destroy())
		})


        this.id = id
        this.columns = columns
		this.resolve = resolve
		this.persistent = persistent
        this.idProperty = idProperty
        this.clusterSync = clusterSync

		const idColumn = this.columns.find(x => x.primaryKey)
		
		if (idColumn) {
            this.idProperty = idColumn.name
        }

		this.idIndex = this.columns.findIndex(x => x.name === this.idProperty)

        // name 'removed'?
		if (this.columns.findIndex(x => x.name === 'removed' )) {
			this.columns.push({ name: 'removed'})
		}
		
		// generating proxy config
		this.defaultObjDef = createTesseractProxyConfig(this.columns)

		this.refresh = _.throttle(() => {
			this.dataCache = this.generateData(this.dataCache)
			this.trigger('dataUpdate', this.dataCache)
		}, 100)

		this.refreshTesseract = _.throttle(silent => {
            this.dataCache.forEach(row => {
                this.generateRow(row, this.columns, row)
            })
			if (!silent) {
				this.trigger('dataUpdate', this.dataCache)
			}
		}, 100)

		this.collectGarbage = _.debounce(() => {
			if(this.hasGarbage){
				this.dataCache = this.dataCache.filter(x => !x.removed)
				this.hasGarbage = false
			}
		}, 100)
	}

    get(stuff) {
        if(this[stuff]) {
            return this[stuff]
        }
    }

	createSession(config) {
        const id = config.id || guid()
        const session = new Session({
            id,
            tesseract: this,
			config,
			getTesseract: config.getTesseract
        })
		this.sessions.add(session)
		return session
	}

	getData() {
		if(this.hasGarbage){
			this.dataCache = this.dataCache.filter(x => !x.removed)
			this.hasGarbage = false
		}
		
		return this.dataCache
	}

	getCount(){
		if(this.hasGarbage){
			this.dataCache = this.dataCache.filter(x => !x.removed)
			this.hasGarbage = false
		}
		
		return this.dataCache.length
	}

	getById(id) {
		return this.dataMap[id]
	}

	add(data, disableClusterUpdate) {

        if (!data) {
            return
        }

        if (this.clusterSync && !disableClusterUpdate) {
            this.trigger('clusterAdd', data)
		}
		else{
			if (!Array.isArray(data)) {
				data = [data]
			}
			var addedRows = [];

			const idProperty = Array.isArray(data[0]) ? this.idIndex : this.idProperty
			for (var i = 0; i < data.length; i++) {
				var tempRow = this.dataMap[data[i][idProperty]]
				if (!tempRow) {
					tempRow = this.generateRow(data[i], this.columns)
					this.dataCache.push(tempRow)
					addedRows.push(tempRow)
				}
			}

			if (addedRows.length) {
				this.trigger('dataUpdate', addedRows, disableClusterUpdate)
			}
		}
	}

	reset(data, disableClusterUpdate) {
		var updatedRows = []
		if (this.clusterSync && !disableClusterUpdate) {
			this.trigger('clusterReset', data || this.getData().map(x=>x.raw))
		}
		else if(data){
			this.dataMap = {}
			updatedRows = this.dataCache = this.generateData(data);
			this.trigger('dataUpdate', updatedRows, true)
		}

		return updatedRows
	}

	update(data, disableClusterUpdate) {
		if (data) {
			var updatedRows = []

			if (this.clusterSync && !disableClusterUpdate) {
                this.trigger('clusterUpdate', data)
			}
			else{
				if (!Array.isArray(data))
					data = [data];

				var idProperty = Array.isArray(data[0]) ? this.idIndex : this.idProperty

				for (var i = 0; i < data.length; i++) {
					var tempRow = this.dataMap[data[i][idProperty]];
					if (tempRow) {
						this.generateRow(data[i], this.columns, tempRow);
					}
					else {
						tempRow = this.generateRow(data[i], this.columns);
						this.dataCache.push(tempRow);
					}
					updatedRows.push(tempRow);
				}
				if (updatedRows.length) {
					this.trigger('dataUpdate', updatedRows, disableClusterUpdate)
				}
			}
		}

		return updatedRows
	}

	remove(data, disableClusterUpdate) {
		var tempId

		if (this.clusterSync && !disableClusterUpdate)
			this.trigger('clusterRemove', data)
		else{
			this.hasGarbage = true
			for (var i = 0; i < data.length; i++) {
				tempId = data[i]
				if (this.dataMap[tempId]) {
					this.dataMap[tempId].removed = true
					delete this.dataMap[tempId];
					this.collectGarbage()
				}
			}
			this.trigger('dataRemove', data)
		}
	}

	clear(disableClusterUpdate) {
		return new Promise((resolve) => {
			if (this.clusterSync && !disableClusterUpdate) {
				this.trigger('clusterRemove', this.dataCache.map(x=>x.raw[this.idIndex]))
				this.trigger('clusterReset', [])
				this.once('dataRemove', () => { resolve() })
			}
			else{
				this.trigger('dataRemove', this.dataCache.map(x=>x.raw[this.idIndex]))
				this.dataCache = []
				this.dataMap = {}
				resolve()
			}
		})
		
	}

	updateColumns(newColumns) {

		var updatedColumns = [];
		if (reset) {
			updatedColumns = newColumns;
		}

		if (updatedColumns.findIndex((x) => x.name === 'removed')) {
			updatedColumns.push({ name: 'removed', columnType: 'bool' })
        }

		this.columns = updatedColumns
		this.defaultObjDef = createTesseractProxyConfig(this.columns)

		this.refresh()
    }

	generateData(data) {

		if (!data) {
            return []
        }

        return data.map(row => {
            return this.generateRow( row, this.columns)
        })
	}

	generateRow(data, columns, dataHolder = new this.defaultObjDef([])) {
		if(data === dataHolder){}
		else if (Array.isArray(data)) {
			dataHolder.raw = data
		}
		else {
			for(let i = 0; i < columns.length; i++) {
				var propertyValue = data[columns[i].name]
                if (propertyValue !== undefined)
					dataHolder.raw[i] = propertyValue
			}
		}

		for (var i = 0; i < columns.length; i++) {
			const column = columns[i]
			const propertyName = column.name
			const defaultValue = column.defaultValue
			const value = column.value
			if(defaultValue !== undefined && dataHolder.raw[i] === undefined){
				const valueType = typeof (defaultValue)
				if (valueType === 'function') {
					dataHolder.raw[i] = defaultValue(dataHolder, dataHolder.raw[i], propertyName);
				}
				else if (valueType == 'string'){
					dataHolder.raw[i] = _.template.call(dataHolder, defaultValue)(dataHolder)
				}
				else{
					dataHolder.raw[i] = defaultValue
				}
			}

			if(value !== undefined){
				const valueType = typeof (value)
				if (valueType === 'function') {
					dataHolder.raw[i] = value(dataHolder, dataHolder.raw[i], propertyName);
				}
				else if (valueType == 'string'){
					dataHolder.raw[i] = _.template.call(dataHolder, value)(dataHolder)
				}
				else{
					dataHolder.raw[i] = value
				}
			}
			
			if(column.expression !== undefined){
				if (column.customExpression == undefined){
					column.customExpression = expressionEngine.generateExpressionTree(column.expression) 
				}
				dataHolder.raw[i] =  expressionEngine.executeExpressionTree(column.customExpression, dataHolder)
			}
			
			if (column.resolve !== undefined) {
				dataHolder.raw[i] = this.resolve(column.resolve, dataHolder)
			}
		}

		this.dataMap[dataHolder.raw[this.idIndex]] = dataHolder

		return dataHolder;
	}

	renderRow(data, columns) {

		for (var i = 0; i < columns.length; i++) {
			var propertyName = columns[i].name;
			if (typeof (columns[i].value) === 'function') {
				data[propertyName] = columns[i].value(data, propertyName);
			}
			if (columns[i].resolve !== undefined) {
				data[propertyName] = this.resolve(columns[i].resolve, data)
			}
		}

		return data;
	}

	returnTree(rootIdValue, parentIdField, groups) {
		var root = this.dataMap[rootIdValue]

		if (root) {
			if (!groups) {
				groups = _(this.dataCache)
					.groupBy(x => x[parentIdField])
					.value()
			}

			var newItem = root.object
			if(groups[newItem[this.idProperty]] && groups[newItem[this.idProperty]].length){
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
