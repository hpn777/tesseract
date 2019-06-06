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

const { Model } = require('./dataModels/backbone')
const Filters = require('./filters')
const Filter = require('./filter')
const _ = require('lodash')
const linq = require('linq')
const {
    groupData,
    groupSelectedData,
    applyOrder,
    createSessionProxyConfig,
    getSimpleHeader,
    getHeader,
    mergeColumns
} = require('./utils')

const UPDATE_REASON_DATA = 'dataUpdate'
const UPDATE_REASON_COLUMNS_CHANGED = 'columnsChanged'

/**
 * methods: getData, filterData, groupData, groupSelectedData
 * events: update, dataRemove
 */
class Session extends Model {

	constructor(model, options) {
        super(model, options)

        this.filters = new Filters()
        this.isLive = true
		
		// TODO: move this to constructor arguments
		this.tesseract = this.get('tesseract')
		this.getTesseract = this.get('getTesseract')
		this.config = this.get('config')
		this.columns = this.config.columns || this.tesseract.getSimpleHeader()

		// generating proxy config
		var allColumns = mergeColumns(this.tesseract.columns, this.columns)
		this.defaultObjDef = createSessionProxyConfig(this.getTesseract, allColumns, this.columns)
		this.dataWrapper = new this.defaultObjDef()
		//---------------------

		this.requireFiltring = false;
		this.hasGarbage = true

		//session primary key
		this.idProperty = this.tesseract.idProperty
		this.idIndex = this.tesseract.idIndex
		//-------------------

		this.permanentFilters = this.config.permanentFilters

        this.refresh()
		
		this.tesseract.on('dataUpdate', (data, disableClusterUpdate) => {
			this.updateData(data, disableClusterUpdate, UPDATE_REASON_DATA)
		}, this)

		this.tesseract.on('dataRemove', (data, disableClusterUpdate) => {
			this.removeData(data, disableClusterUpdate)
		}, this)

		this.on('destroy', () => {
			this.tesseract.off(null, null, this)
        })
	}

	refresh(){
		var query = linq.from(this.tesseract.dataCache)
		let idProperty = this.idProperty
		
		if(this.columns){
			query = query.select(x => this.dataWrapper.setData(x))
		}

		if (this.hasGarbage || this.config.filter || this.config.permanentFilters) {
			var tempFilter = this.config.filter || []
			var tempPermanentFilter = this.config.permanentFilters || []
			this.config.filter = tempPermanentFilter.concat(tempFilter)
			this.filters.reset(this.config.filter.map(f => new Filter(f)))
			query = query.where(x => !x.removed && this.filters.applyFilters(x))
				.select(x=>x.raw)
			this.requireFiltring = false
			this.hasGarbage = false
		}

		if (this.config.sort) {			
			query = linq.from(applyOrder(this.config.sort, query.toArray(), this.defaultObjDef))
			this.requireSorting = false;
		}

		this.dataCache = query.toArray()
		this.dataMap = query.aggregate({}, (acc, item)=>{
			acc[item[idProperty]] = item
			return acc
		})
	}

	updateData(data, disableClusterUpdate, updateReason){
		var filters = this.filters
		var addedRows = []
		var updatedRows = []
		var removedRows = []
		var addedIds = []
		var updatedIds = []
		var removedIds = []
		var idProperty = this.idProperty

		if (filters.length) {
			data.forEach(item => {
				let tempId = item[idProperty]
				let sessionItem = this.dataWrapper.setData(item)
				if (filters.applyFilters(sessionItem)) {
					if(this.dataMap[tempId]){
						updatedRows.push(this.dataMap[tempId])
						updatedIds.push(tempId)
					}
					else{
						this.dataCache.push(item)
						this.dataMap[tempId] = item
						addedRows.push(item)
						addedIds.push(tempId)
					}
				}
				else {
					if (this.dataMap[tempId]) {
						removedIds.push(tempId)
						removedRows.push(this.dataMap[tempId])

						delete this.dataMap[tempId]
						this.requireFiltring = true
					}
				}
			})

			if (addedIds.length || updatedIds.length || removedIds.length ) {
				this.requireSorting = true;
			}
		} else {
			data.forEach((item)=>{
				let tempId = item[idProperty]
				
				if(this.dataMap[tempId]){
					updatedRows.push(item)
					updatedIds.push(tempId)
				}
				else{
					this.dataCache.push(item)
					this.dataMap[tempId] = item
					addedRows.push(item)
					addedIds.push(tempId)
				}
			})
			this.requireSorting = true
		}

		const addedData = linq.from(addedRows).select(x => this.dataWrapper.setData(x))
		const updatedData = linq.from(updatedRows).select(x => this.dataWrapper.setData(x))
		const removedData = linq.from(removedRows).select(x => this.dataWrapper.setData(x))

		let result = {
			addedIds: addedIds,
			addedData: addedData,
			updatedIds: updatedIds,
			updatedData: updatedData,
			updateReason: updateReason,
			removedIds: removedIds,
			removedData: removedData,
			toJSON: () => {
				return {
					addedIds: addedIds,
					addedData: addedData.select(x => x.object).toArray(),
					updatedIds: updatedIds,
					updatedData: updatedData.select(x => x.object).toArray(),
					updateReason: updateReason,
					removedIds: removedIds,
					removedData: removedData.select(x => x.object).toArray(),
				}
			}
		}

		if (addedIds.length || updatedRows.length || removedRows.length) {
			this.trigger('dataUpdate', result, disableClusterUpdate)
		}

		return result
	}

	removeData(data, disableClusterUpdate){
		let removedIds = []
		let removedRows = []
		data.forEach(item => {
			if (this.dataMap[item]) {
				removedIds.push(item)
				removedRows.push(this.dataMap[item])
				delete this.dataMap[item]
			}
		})

		const removedData = linq.from(removedRows).select(x => this.dataWrapper.setData(x))

		let result = {
			addedIds: [],
			addedData: [],
			updatedIds: [],
			updatedData: [],
			removedIds: removedIds,
			removedData: removedData,
			toJSON: () => {
				return {
					addedIds: [],
					addedData: [],
					updatedIds: [],
					updatedData: [],
					removedIds: removedIds,
					removedData: removedData.select(x => x.object).toArray()
				}
			}
		}

		if(removedRows.length){
			this.requireFiltring = true
			this.trigger('dataUpdate', result, disableClusterUpdate)
		}

		return result
	}

	_getData(request) {
		const config = this.config

        if (this.requireDataReset) {
            this.dataCache = this.tesseract.dataCache
			this.requireDataReset = false
		}

		if (request) {
			config.requestId = request.requestId
			config.page = request.page
			if (request.sort && JSON.stringify(config.sort) != JSON.stringify(request.sort)) {
				config.sort = request.sort
				this.requireSorting = true
			}
			
			if (request.filter) {

				if (this.permanentFilters) {
					request.filter = this.permanentFilters.concat(filtersAttr)
				}

				if (JSON.stringify(config.filter) != JSON.stringify(request.filter)) {
                    config.filter = request.filter
					this.filters.reset(request.filter.map(f => new Filter(f)))
					this.requireFiltring = true
					this.requireSorting = true
				}
			}

			config.start = request.start
			config.limit = request.limit
		}

		if (this.requireFiltring || this.requireSorting || config.start || config.limit) {
            var query = linq.from(this.dataCache)
			if (this.requireFiltring) {
				query = this.collectGarbage()
			}

			if (this.requireSorting && config.sort) {
				this.dataCache = applyOrder(config.sort, query.toArray(), this.defaultObjDef)
				query = linq.from(this.dataCache)

				this.requireSorting = false
			}

			if (config.start) {
				query = query.skip(config.start)
			}

			if (config.limit) {
				query = query.take(config.limit)
			}

			return query
		} else {
			return linq.from(this.dataCache)
		}
	}

	getData(request) {
		return this._getData(request).toArray()
	}

	getLinq(request){
		return this._getData(request).select(x => this.dataWrapper.setData(x))
	}

	getCount(){
		if (this.requireFiltring) {
			this.collectGarbage()
		}
		
		return this.dataCache.length
	}

	collectGarbage() {
		var query = linq.from(this.tesseract.dataCache)
			.where(x => !x.removed)
			.select(x => this.dataWrapper.setData(x))
			.where(x => this.filters.applyFilters(x))
			.select(x => x.raw)
			
		this.requireFiltring = false
		this.hasGarbage = false
		this.dataCache = query.toArray()
		this.dataMap = query.aggregate({}, (acc, item)=>{
			acc[item[this.idProperty]] = item
			return acc
		})

		return query
	}

	filterData(filtersAttr) {
		const config = this.config

		if (filtersAttr) {
			if (this.permanentFilters) {
				config.filter = this.permanentFilters.concat(filtersAttr)
			} else {
				config.filter = filtersAttr
			}
			this.filters.reset(config.filter.map(f = new Filter(f)))
		}

        this.dataCache = this.collectGarbage().toArray()
	}

	groupData(groupBy, includeLeafs) {
		const config = this.config

		if (groupBy) {
			config.groupBy = groupBy
		}

		var dataCache = this.getData()

		if (dataCache.length) {

			return groupData(
				this.columns,
				dataCache,
				this.dataWrapper,
				config.groupBy,
				includeLeafs || config.includeLeafs,
				'',
				'',
				'',
				this.tesseract.idProperty
			)
		}
	}

	groupSelectedData(selectedRowsIds, groupBy, includeLeafs) {
        const config = this.config
        if (groupBy) {
			config.groupBy = groupBy
		}
        groupSelectedData.bind(this)
		return groupSelectedData(
			this.columns,
			this.getData(),
			this.dataWrapper,
			config.groupBy,
			selectedRowsIds,
			includeLeafs || config.includeLeafs,
			'',
			'',
			'',
			this.tesseract.idProperty,
			this.filters
		)
	}

	returnTree(rootIdValue, parentIdField, groups) {
		var root = this.dataMap[rootIdValue]

		if (root) {
			if (!groups) {
				groups = linq.from(this.dataCache)
					.groupBy(x => this.dataWrapper.setData(x)[parentIdField])
			}

			var newItem = this.dataWrapper.setData(root).object
			let subGroup = groups.firstOrDefault(x => x.key() === rootIdValue, 0)
			if(subGroup){
				newItem.children = []
				subGroup
					.select(x => this.dataWrapper.setData(x))
					.forEach(x => {
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

	updateColumns(updatedColumns) {
		
		if (updatedColumns.findIndex((x) => x.name === 'removed')) {
			updatedColumns.push({ name: 'removed', columnType: 'bool' })
        }

		this.columns = updatedColumns
		var allColumns = mergeColumns(this.tesseract.columns, this.columns)
		this.defaultObjDef = createSessionProxyConfig(this.getTesseract, allColumns, this.columns)
		this.dataWrapper = new this.defaultObjDef()

		this.updateData(linq.from(this.tesseract.dataCache), false, UPDATE_REASON_COLUMNS_CHANGED)
		this.collectGarbage()
    }

	getHeader(excludeHiddenColumns) {
		return getHeader(this.columns || this.tesseract, excludeHiddenColumns)
	}

	getSimpleHeader(excludeHiddenColumns) {
		return getSimpleHeader(this.columns|| this.tesseract, excludeHiddenColumns)
	}
}

module.exports = {
	Session,
	UPDATE_REASON_DATA,
	UPDATE_REASON_COLUMNS_CHANGED,
}