const _ = require('lodash')

// Tesseract utils
let generateSummaryRow = (data, columns, groupedColumn, branchValue, branchPath, parent) => {
    var response = {};
    for (var i = 0; i < columns.length; i++) {
        var tempValue = 0;
        let name = columns[i].name
        switch (columns[i].aggregator) {
            case 'none':
                response[name] = undefined;
                break;
            case 'sum':
                for (var k = 0; k < data.length; k++) {
                    if (data[k][name] != null) {
                        var ttValue = data[k][name]
                        tempValue += ttValue ? ttValue : 0;
                    }
                }
                response[name] = tempValue;
                break;
            case 'avg':
                for (var k = 0; k < data.length; k++) {
                    if (data[k][name] != null) {
                        var ttValue = data[k][name]
                        tempValue += ttValue ? ttValue : 0;
                    }
                }
                tempValue = tempValue / data.length;
                response[name] = tempValue;
                break;
            case 'max':
                var max = data[0].raw[i]
                for (var k = 0; k < data.length; k++) {
                    if (data[k][name] != null) {
                        var ttValue = data[k][name]
                        max = ttValue > max ? ttValue : max;
                    }
                }
                response[name] = max
                break;
            case 'min':
                var min = data[0].raw[i]
                for (var k = 0; k < data.length; k++) {
                    if (data[k][name] != null) {
                        var ttValue = data[k][name]
                        min = ttValue < min ? ttValue : min;
                    }
                }
                response[name] = min
                break;
            default:
                if (typeof (columns[i].aggregator) === 'function') {// if custom aggregator exist
                    response[name] = columns[i].aggregator(data, name, groupedColumn, branchPath, parent);
                }
                else if (name === groupedColumn) {// if current summary row refers to particular name
                    response[name] = data[0][name];
                }
                else {// if all child elements are identical
                    var tempStr = data[0].raw[i];
                    var toAdd = true;
                    for (var k = 0; k < data.length; k++) {
                        if (tempStr != (data[k][name])) {
                            toAdd = false;
                            break;
                        }
                    }
                    if (toAdd)
                        response[name] = tempStr;
                }
        }
    }
    return response;
}

let getSimpleHeader = (allColumns, excludeHiddenColumns) => {
    var selectedColumns = [];
    var columns = allColumns.filter((x) => {
        return x.name !== 'removed'
    })
    
    for (var i = 0; i < columns.length; i++) {
        if (excludeHiddenColumns && !columns[i].hidden) {
            selectedColumns.push({
                name: columns[i].name,
                columnTitle: columns[i].columnTitle,
                columnType: columns[i].columnType != 'staticResolve' ? columns[i].columnType : 'object',
                primaryKey: columns[i].primaryKey
            });
        }
        else {
            selectedColumns.push({
                name: columns[i].name,
                columnTitle: columns[i].columnTitle,
                columnType: columns[i].columnType != 'staticResolve' ? columns[i].columnType : 'object',
                primaryKey: columns[i].primaryKey
            });
        }
    }

    return selectedColumns;
}

let getHeader = (allColumns, excludeHiddenColumns) => {
    var selectedColumns = [];

    var columns = allColumns
        .filter((x) => x.name !== 'removed')
        .map(x => {
            if (x.columnType == 'staticResolve' || x.value) {
                return {
                    name: x.name,
                    columnTitle: x.columnTitle,
                    columnType: 'object',
                }
            }
            else
                return x
        })

    if (excludeHiddenColumns) {
        for (var i = 0; i < columns.length; i++) {
            if (!columns[i].hidden)
                selectedColumns.push(columns[i]);
        }
    }
    else
        selectedColumns = columns;

    return selectedColumns;
}

let groupData = (
    columns,
    data,
    groupBy,
    includeLeafs,
    groupIdPrefix,
    branchPath,
    parent,
    idProperty
) => {
    var response = [];
    var currentGroup = groupBy[0];
    if (!currentGroup) {
        if (includeLeafs) {
            return data.map(x=>{ 
                x = x.object
                x.leaf = true
                return x
            })
        }
    }
    else {
        branchPath = branchPath || [];
        var branchPathCopy = branchPath.slice(0, branchPath.length);
        branchPath.push(currentGroup);
        if (currentGroup.dataIndex != 'All') {

            _(data).groupBy(x => x[currentGroup.dataIndex])
                .forEach((childRows, groupKey) => {
                    if (childRows.length >= 1) {
                        var tempAgregatedRow = generateSummaryRow(
                            childRows, 
                            columns, 
                            currentGroup.dataIndex, 
                            groupKey, 
                            branchPathCopy, 
                            parent);
                        tempAgregatedRow[idProperty] = groupIdPrefix + '/' + groupKey;
                        var newgroupBy = groupBy.slice(1, groupBy.length);
                        tempAgregatedRow.children = groupData(
                            columns, 
                            childRows, 
                            newgroupBy, 
                            includeLeafs, 
                            tempAgregatedRow[idProperty], 
                            branchPath.slice(0, branchPath.length), 
                            tempAgregatedRow);
                        response.push(tempAgregatedRow);
                    }
                })
        }
        else {
            var tempAgregatedRow = generateSummaryRow(
                data, 
                columns, 
                currentGroup.dataIndex, 
                currentGroup.dataIndex, 
                'All',
                branchPathCopy, 
                parent);
            tempAgregatedRow[idProperty] = currentGroup.dataIndex;
            var newgroupBy = groupBy.slice(1, groupBy.length);
            tempAgregatedRow.children = groupData(
                columns, 
                data, 
                newgroupBy, 
                includeLeafs, 
                currentGroup.dataIndex, 
                branchPath.slice(0, branchPath.length), 
                tempAgregatedRow, 
                idProperty);
            return [tempAgregatedRow];
        }
        return response;
    }
}

let groupSelectedData = (
    columns,
    data,
    groupBy,
    selectedRowsIds,
    includeLeafs,
    groupIdPrefix,
    branchPath,
    parent,
    idProperty,
    idIndex,
    filters
) => {
    var response = [];
    var processChildren = false;
    var currentGroup = groupBy[0];
    if (!currentGroup) {
        if (includeLeafs) {
            for (var i = 0; i < data.length; i++) {
                if (selectedRowsIds[data[i][idProperty]]) {
                    data[i].leaf = true;
                    response.push(data[i]);
                }
            }
            return response;
        }
    }
    else {
        branchPath = branchPath || [];
        var branchPathCopy = branchPath.slice(0, branchPath.length);
        branchPath.push(currentGroup);
        if (currentGroup.dataIndex != 'All') {
            _(data)
                .groupBy(x => x[currentGroup.dataIndex])
                .forEach((childRows, groupKey) => {
                    processChildren = false;
                    if (childRows.length >= 1) {
                        for (var i = 0; i < childRows.length; i++) {
                            if (selectedRowsIds[childRows[i].raw[idIndex]]) {
                                processChildren = true;
                                break;
                            }
                        }
                        if (processChildren) {
                            let subData = _.filter(childRows, x =>!x.removed && filters.applyFilters(x))
                            if(subData.length){
                                var tempAgregatedRow = generateSummaryRow(
                                    subData, 
                                    columns, 
                                    currentGroup.dataIndex, 
                                    groupKey, 
                                    branchPathCopy, 
                                    parent, 
                                    idProperty);
                                tempAgregatedRow[idProperty] = groupIdPrefix + '/' + groupKey;
                                var newgroupBy = groupBy.slice(1, groupBy.length);
                                tempAgregatedRow.children = groupSelectedData(
                                    columns,
                                    childRows, 
                                    newgroupBy,
                                    selectedRowsIds,
                                    includeLeafs,
                                    tempAgregatedRow[idProperty],
                                    branchPath.slice(0, branchPath.length),
                                    tempAgregatedRow,
                                    idProperty,
                                    idIndex,
                                    filters
                                );
                                response.push(tempAgregatedRow);
                            }
                        }
                    }
                })
        }
        else {
            var tempAgregatedRow = generateSummaryRow(
                data, 
                columns, 
                currentGroup.dataIndex, 
                currentGroup.dataIndex, 
                branchPathCopy, 
                parent, 
                idProperty);
            tempAgregatedRow[idProperty] = currentGroup.dataIndex;
            var newgroupBy = groupBy.slice(1, groupBy.length);
            tempAgregatedRow.children = groupSelectedData(
                columns,
                data,
                newgroupBy,
                selectedRowsIds,
                includeLeafs,
                currentGroup.dataIndex,
                branchPath.slice(0, branchPath.length),
                tempAgregatedRow,
                idProperty,
                idIndex,
                filters
            )
            response.push(tempAgregatedRow);
        }
        return response;
    }
}

let createTesseractProxyConfig = columns => {
    var classMeat = 'return class proxyReader{'
    classMeat += 'constructor(tempArray){this.raw = tempArray || []};'
    classMeat += 'get array(){return this.raw}'
    classMeat += 'get toJSON(){return () => this.raw}'
    columns.forEach((item, index) => {
        classMeat += 'get ' + item.name + '(){return this.raw['+index+']}'
        classMeat += 'set ' + item.name + '(val){this.raw['+index+'] = val}'
    })
    
    classMeat += 'get object(){return {'
    columns.forEach((item, index) => {
        classMeat += item.name+':this.raw['+index+'],'
    })
    classMeat += '}}'
    classMeat += '}'

    return new Function(classMeat)()
}

let createSessionProxyConfig = (getTesseract, allColumns, selectedColumns) => {
    const isCustomSelector = selectedColumns ? true : false
    selectedColumns = selectedColumns || allColumns
    var selectedPropertyMap = {}
    var propertyMap = {}
    allColumns.forEach((item, index) => {
        propertyMap[item.name] = index
        if(selectedColumns.filter(x => x.name === item.name).length === 1)
            selectedPropertyMap[item.name] = index
    })

    var classMeat = 'return class proxyReader{'
    classMeat += 'constructor(tempArray){this.raw = tempArray || []};'
    classMeat += 'get toJSON(){return () => this.array}'

    selectedColumns.forEach((item, index) => {
        //if(selectedColumns.filter(x => x.name === item.name).length === 1){
            if(item.resolve){
                classMeat += 'get ' + item.name + '(){'
                classMeat += 'let childrenTable = getTesseract("'+item.resolve.childrenTable+'");'
                classMeat += 'if(!childrenTable){console.trace("childrenTable is invalid."); return;}'
                classMeat += 'let underlyingData = childrenTable.getById(this.raw['+propertyMap[item.resolve.underlyingName]+']);'
                classMeat += 'if(!underlyingData){'
                //classMeat += 'console.trace("data dont exist in childrenTable.");' //uncomment to enable tracing
                classMeat += 'return;}'
                classMeat += 'return underlyingData.'+item.resolve.displayField+';'
                classMeat += '}'
            }
            else if(typeof item.value === 'function'){
                classMeat += 'get ' + item.name + '(){return ('+item.value.toString()+')(this, "'+item.name+'")}'
            }
            else if( item.value !== undefined){
                classMeat += 'get ' + item.name + '(){return '+item.value+'}'
            }
            else{
                classMeat += 'get ' + item.name + '(){return this.raw['+selectedPropertyMap[item.name]+']}'
            }
      //  }
    })
    classMeat += 'get removed(){return this.raw['+propertyMap.removed+']}'
    classMeat += 'get object(){return (()=>{return {'
    allColumns.forEach((item, index) => {
        if(selectedColumns.filter(x => x.name === item.name).length === 1){
            if(item.resolve || item.value !== undefined){
                classMeat += item.name + ': this.'+item.name+','
            }
            else{
                classMeat += item.name + ': this.raw['+index+'],'
            }
        }
    })
    classMeat += '}})()}'

    classMeat += 'get array(){return (()=>{return ['
    allColumns.forEach((item, index) => {
        if(selectedColumns.filter(x => x.name === item.name).length === 1){
            if(item.resolve){
                classMeat += 'this.'+item.name+','
            }
            else{
                classMeat += 'this.raw['+index+'],'
            }
        }
    })
    classMeat += ']})()}'

    classMeat += '}'
    return new Function('getTesseract',classMeat)(getTesseract)
}

let mergeColumns = (baseColumns, optionalColumns) => {
    if (!optionalColumns) {
        return baseColumns
    }

    var updatedColumns = []
    baseColumns.forEach((item) => {
        let selectedColumns = optionalColumns.filter(c => c.name === item.name)
        if (selectedColumns && selectedColumns.length) {
            selectedColumns.forEach(function (item) {
                updatedColumns.push(item)
            })
        } else {
            updatedColumns.push(item)
        }
    })

    optionalColumns.forEach((item) => {
        if (updatedColumns.filter((c) => c.name === item.name).length === 0) {
            updatedColumns.push(item)
        }
    })
    return updatedColumns
}

function applyOrder(sort, data) {
    if(!sort)
        return data

    let testItem = data[0]
    if(testItem){
        let comparerSource = 'return '

        sort.forEach((item, index) => {

            if(index > 0)
                comparerSource += ' || '

            if(typeof testItem[item.field] === 'string'){
                if(item.direction.toLowerCase() === 'asc')
                    comparerSource += `a.${item.field}.localeCompare(b.${item.field})`
                else
                    comparerSource += `b.${item.field}.localeCompare(a.${item.field})`
            }
            else{
                if(item.direction.toLowerCase() === 'asc')
                    comparerSource += `a.${item.field} - b.${item.field}`
                else
                    comparerSource += `b.${item.field} - a.${item.field}`
            }
        })
        
        var comparer = new Function('a', 'b', comparerSource)
        return data.sort( (a, b) => comparer(a, b))
    }
    else 
        return data
}

function guid () {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

module.exports = {
    generateSummaryRow,
    getSimpleHeader,
    getHeader,
    groupData,
    groupSelectedData,
    applyOrder,
    createTesseractProxyConfig,
    createSessionProxyConfig,
    mergeColumns,
    guid
}