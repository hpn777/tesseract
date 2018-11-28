const Model = require('./dataModels/model')
const Filters = require('./filters')
const Filter = require('./filter')
const _ = require('lodash')
const {
    groupData,
    groupSelectedData,
    applyOrder,
    createSessionProxyConfig,
    getSimpleHeader,
    getHeader,
    mergeColumns
} = require('./utils')

/**
 * methods: getData, filterData, sortData, groupData, groupSelectedData
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

		var allColumns = mergeColumns(this.tesseract.columns, this.columns)
		// generating proxy config
		this.defaultObjDef = createSessionProxyConfig(this.getTesseract, allColumns, this.columns)
		//---------------------

		this.requireFiltring = false;
		var idProperty = this.tesseract.idProperty
		let idIndex = this.idIndex = this.tesseract.idIndex
        var config = this.config
		this.permanentFilters = config.permanentFilters

        var query = _(this.tesseract.dataCache)
		
		if (config.filter || config.permanentFilters) {
			var tempFilter = config.filter || []
			var tempPermanentFilter = config.tempPermanentFilter || []
            config.filter = tempPermanentFilter.concat(tempFilter)
            this.filters.reset(config.filter.map(f => new Filter(f)))
            query = query.filter(x => this.filters.applyFilters(x))
			this.requireFiltring = false
		}

		if (config.sort) {			
			query = _(applyOrder(config.sort, query.value()))
			this.requireSorting = false;
		}

		if(this.columns){
			query = query.map(x => new this.defaultObjDef(x.array))
		}

		this.dataCache = query.value()
		this.dataMap = query.reduce((acc, item)=>{
			acc[item.raw[idIndex]] = item
			return acc
		}, {})
		
		this.tesseract.on('dataUpdate', (data, disableClusterUpdate) => {
			this.updateData(data, disableClusterUpdate)
		}, this)

		this.tesseract.on('dataRemove', (data, disableClusterUpdate) => {
			this.removeData(data, disableClusterUpdate)
		}, this)

		this.on('remove', () => {
			this.tesseract.off(null, null, this)
        })
	}

	updateData(data, disableClusterUpdate){
		var filters = this.filters
		var filteredRows = []
		var removedRows = []
		var ids = []
		let idIndex = this.idIndex
		var removedIds = []

		if (filters.length) {
			data.forEach(item => {
				let tempId = item.raw[idIndex]
				let sessionItem = new this.defaultObjDef(item.array)
				if (filters.applyFilters(sessionItem)) {
					if(!this.dataMap[tempId]){
						this.dataCache.push(sessionItem)
						this.dataMap[tempId] = sessionItem
						filteredRows.push(sessionItem)
					}
					else{
						filteredRows.push(this.dataMap[tempId])
					}

					ids.push(tempId)
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

			if (ids.length || removedIds.length ) {
				this.requireSorting = true;
			}
		} else {
			data.forEach((item)=>{
				let sessionItem = new this.defaultObjDef(item.array)
				let tempId = item.raw[idIndex]
				ids.push(tempId)
				filteredRows.push(sessionItem)
				if(!this.dataMap[tempId]){
					this.dataCache.push(sessionItem)
					this.dataMap[tempId] = sessionItem
				}
			})
			this.requireSorting = true
		}

		let result = {
			updatedIds: ids,
			updatedData: filteredRows,
			removedIds: removedIds,
			removedData: removedRows,
			toJSON: () => {
				return {
					updatedIds: ids,
					updatedData: filteredRows.map(x => x.object),
					removedIds: removedIds,
					removedData: removedRows.map(x => x.object)
				}
			}
		}

		if (filteredRows.length || removedRows.length) {
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

		let result = {
			updatedIds: [],
			updatedData: [],
			removedIds: removedIds,
			removedData: removedRows,
			toJSON: () => {
				return {
					updatedIds: [],
					updatedData: [],
					removedIds: removedIds,
					removedData: removedRows.map(x=>x.object)
				}
			}
		}

		if(removedRows.length){
			this.requireFiltring = true
			this.trigger('dataUpdate', result, disableClusterUpdate)
		}

		return result
	}

	getData(request) {
		const config = this.config

        if (this.requireDataReset) {

            this.dataCache = this.tesseract.dataCache
                .map(x => new this.defaultObjDef(x.array))

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
            var query = _(this.dataCache)
			if (this.requireFiltring) {
				query = _((this.tesseract.dataCache))
				
				query = query.map(x => new this.defaultObjDef(x.array))
					.filter(x => this.filters.applyFilters(x))
					
				this.requireFiltring = false
				this.dataCache = query.value()
				this.dataMap = query.reduce( (acc, item)=>{
					acc[item.raw[this.idIndex]] = item
					return acc
				}, {})
				query = _(this.dataCache)
			}

			if (this.requireSorting && config.sort) {
				this.dataCache = applyOrder(config.sort, query.value())
				query = _(this.dataCache)

				this.requireSorting = false
			}

			if (config.start) {
				query = query.drop(config.start)
			}

			if (config.limit) {
				query = query.take(config.limit)
			}

			return query.value()
		} else {
			return this.dataCache
		}
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

        this.dataCache = this.tesseract.dataCache
            .filter(x => this.filters.applyFilters(x))
            .map(x => new this.defaultObjDef(x.array))

		this.requireFiltring = false
	}

	sortData(sorters) {
		const config = this.config

		if (sorters) {
			config.sort = sorters
		}

        this.requireSorting = false
        this.dataCache = _(this.dataCache).applyOrder(config.sort.query).value()
	}

	groupData(groupBy, includeLeafs) {
		const config = this.config

		if (groupBy) {
			config.groupBy = groupBy
		}

		var dataCache = this.getData()

		if (dataCache.length) {

			return groupData(
				this.columns || this.tesseract.columns,
				dataCache,
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
			this.columns || this.tesseract.columns,
			this.getData(),
			config.groupBy,
			selectedRowsIds,
			includeLeafs || config.includeLeafs,
			'',
			'',
			'',
			this.tesseract.idProperty,
			this.tesseract.idIndex,
			this.filters
		)
	}

	getHeader(excludeHiddenColumns) {
		return getHeader(this.columns || this.tesseract, excludeHiddenColumns)
	}

	getSimpleHeader(excludeHiddenColumns) {
		return getSimpleHeader(this.columns|| this.tesseract, excludeHiddenColumns)
	}

	toEnumerable() {
		return Enumerable.from(this.getData())
	}
}

module.exports = Session
