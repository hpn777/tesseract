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
const {ExpressionEngine, Functions} = require('./expressionEngine')
const expressionEngine = new ExpressionEngine()

// Tesseract utils
let generateSummaryRow = (data, objWrapper, columns, groupedColumn, branchValue, branchPath, parent) => {
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
                    let ttValue = objWrapper.setData(data[k])[name]
                    if (ttValue != null) {
                        tempValue += ttValue ? ttValue : 0;
                    }
                }
                response[name] = tempValue;
                break;
            case 'avg':
                for (var k = 0; k < data.length; k++) {
                    let ttValue = objWrapper.setData(data[k])[name]
                    if (ttValue != null) {
                        tempValue += ttValue ? ttValue : 0;
                    }
                }
                tempValue = tempValue / data.length;
                response[name] = tempValue;
                break;
            case 'max':
                var max = data[0][i]
                for (var k = 0; k < data.length; k++) {
                    let ttValue = objWrapper.setData(data[k])[name]
                    if (ttValue != null) {
                        max = ttValue > max ? ttValue : max;
                    }
                }
                response[name] = max
                break;
            case 'min':
                var min = data[0][i]
                for (var k = 0; k < data.length; k++) {
                    let ttValue = objWrapper.setData(data[k])[name]
                    if (ttValue != null) {
                        min = ttValue < min ? ttValue : min;
                    }
                }
                response[name] = min
                break;
            default:
                if (typeof (columns[i].aggregator) === 'function') {// if custom aggregator exist
                    response[name] = columns[i].aggregator(data, objWrapper, name, groupedColumn, branchPath, parent);
                }
                else if (name === groupedColumn) {// if current summary row refers to particular name
                    response[name] = data[0][i]
                }
                else {// if all child elements are identical
                    var tempStr = data[0][i];
                    var toAdd = true;
                    for (var k = 0; k < data.length; k++) {
                        if (tempStr != (objWrapper.setData(data[k])[name])) {
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
        if (!excludeHiddenColumns || (excludeHiddenColumns && !columns[i].hidden)) {
            selectedColumns.push({
                name: columns[i].name,
                title: columns[i].title,
                type: columns[i].type,
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
            if (x.resolve  || x.value) {
                return {
                    name: x.name,
                    title: x.title,
                    type: x.type
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
    objWrapper,
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
                x = objWrapper.setData(x).object
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
            linq.from(data)
            .groupBy(x => objWrapper.setData(x)[currentGroup.dataIndex])
            .forEach((item) => {
                let childRows = item.getSource()
                let groupKey = item.key()
                var tempAgregatedRow = generateSummaryRow(
                    childRows,//.map(x=>x.raw), 
                    objWrapper,
                    columns, 
                    currentGroup.dataIndex, 
                    groupKey, 
                    branchPathCopy, 
                    parent);
                tempAgregatedRow[idProperty] = groupIdPrefix + '/' + groupKey;
                var newgroupBy = groupBy.slice(1, groupBy.length);
                tempAgregatedRow.children = groupData(
                    columns, 
                    childRows,//.map(x=>x.raw), 
                    objWrapper,
                    newgroupBy, 
                    includeLeafs, 
                    tempAgregatedRow[idProperty], 
                    branchPath.slice(0, branchPath.length), 
                    tempAgregatedRow);
                response.push(tempAgregatedRow);
                })
        }
        else {
            var tempAgregatedRow = generateSummaryRow(
                data, 
                objWrapper,
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
                objWrapper,
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
    objWrapper,
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
                if (selectedRowsIds[data[i][idIndex]]) {
                    let tempObj = objWrapper.setData(data[i]).object
                    tempObj.leaf = true;
                    response.push(tempObj);
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
            linq.from(data)
                .groupBy(x => objWrapper.setData(x)[currentGroup.dataIndex])
                .forEach((item) => {
                    let childRows = item.getSource()
                    let groupKey = item.key()
                    processChildren = false;
                    if (childRows.length >= 1) {
                        for (var i = 0; i < childRows.length; i++) {
                            if (selectedRowsIds[childRows[i][idIndex]]) {
                                processChildren = true;
                                break;
                            }
                        }
                        if (processChildren) {
                            let subData = linq.from(childRows)
                                .select(x=>objWrapper.setData(x))
                                .where(x =>!x.removed && filters.applyFilters(x))
                                .select(x=>x.raw)
                                .toArray()
                            if(subData.length){
                                var tempAgregatedRow = generateSummaryRow(
                                    subData, 
                                    objWrapper,
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
                                    subData,
                                    objWrapper,
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
                objWrapper,
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
                objWrapper,
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
        classMeat += `get ${item.name}(){return this.raw[${index}]}`
        classMeat += `set ${item.name}(val){this.raw[${index}] = val}`
    })
    classMeat += 'get setData(){return (raw)=>{this.raw = raw;return this;}}'
    classMeat += 'get object(){return {'
    columns.forEach((item, index) => {
        classMeat += `${item.name}:this.raw[${index}],`
    })
    classMeat += '}}'
    classMeat += '}'

    return new Function(classMeat)()
}

let createSessionProxyConfig = (getTesseract, allColumns, selectedColumns) => {
    selectedColumns = selectedColumns || allColumns
    var selectedPropertyMap = {}
    var propertyMap = {}
    allColumns.forEach((item, index) => {
        propertyMap[item.name] = index
        if(selectedColumns.filter(x => x.name === item.name).length === 1)
            selectedPropertyMap[item.name] = index
    })

    let childrenTablesMap = {}

    var classMeat = 'return class proxyReader{'
    classMeat += 'constructor(tempArray){this.raw = tempArray || []};'
    classMeat += 'get toJSON(){return () => this.array}'

    selectedColumns.forEach((item, index) => {
            if(item.resolve  !== undefined){
                let childrenTable = getTesseract(item.resolve.childrenTable)
                 
                if(!childrenTable){
                    console.trace("childrenTable is invalid.")
                }
                else if(!childrenTablesMap[item.resolve.childrenTable]) {
                    childrenTablesMap[item.resolve.childrenTable] = {}
                    childrenTablesMap[item.resolve.childrenTable][item.resolve.displayField] = childrenTable.columns.findIndex(x=>x.name === item.resolve.displayField)
                }
                classMeat += `get ${item.name}(){`
                classMeat += `let childrenTable = getTesseract("${item.resolve.childrenTable}");`
                classMeat += 'if(!childrenTable){console.trace("childrenTable is invalid."); return;}'
                classMeat += `let underlyingData = childrenTable.getById(this.raw[${propertyMap[item.resolve.underlyingField]}]);`
                classMeat += 'if(!underlyingData){'
                //classMeat += 'console.trace("data dont exist in childrenTable.");' //uncomment to enable tracing
                classMeat += 'return;}'
                classMeat += `return underlyingData[${childrenTablesMap[item.resolve.childrenTable][item.resolve.displayField]}];`
                classMeat += '}'
            }
            else if(typeof item.value === 'function'){
                classMeat += `get ${item.name}(){return (${item.value.toString()})(this, '${item.name}', ${selectedPropertyMap[item.name]})}`
            }
            else if (typeof item.value == 'string'){
                classMeat += `get ${item.name}(){return _.template.call(this,'${item.value}')(this)}`
            }
            else if( item.value !== undefined){
                classMeat += `get ${item.name}(){return ${item.value};}`
            }
            else if(item.expression !== undefined){
                const customExpression = expressionEngine.generateExpressionTree(item.expression) 
                classMeat += `get ${item.name}(){return expressionEngine.executeExpressionTree(${JSON.stringify(customExpression)}, this)}`
			}
            else{
                classMeat += `get ${item.name}(){return this.raw[${selectedPropertyMap[item.name]}]}`
            }
    })
    classMeat += `get removed(){return this.raw[${propertyMap.removed}]}`
    classMeat += 'get setData(){return (raw)=>{this.raw = raw;return this;}}'
    classMeat += 'get object(){return (()=>{return {'
    allColumns.forEach((item, index) => {
        if(selectedColumns.filter(x => x.name === item.name).length === 1){
            if(item.resolve !== undefined || item.value !== undefined || item.expression !== undefined){
                classMeat += `${item.name} : this.${item.name},`
            }
            else{
                classMeat += `${item.name} : this.raw[${index}],`
            }
        }
    })
    classMeat += '}})()}'

    classMeat += 'get array(){return (()=>{return ['
    allColumns.forEach((item, index) => {
        if(selectedColumns.filter(x => x.name === item.name).length === 1){
            if(item.resolve){
                classMeat += `this.${item.name},`
            }
            else{
                classMeat += `this.raw[${index}],`
            }
        }
    })
    classMeat += ']})()}'
    classMeat += '}'
    return new Function('getTesseract', '_', 'expressionEngine',classMeat)(getTesseract, _, expressionEngine)
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

function applyOrder(sort, data, defaultObjDef) {
    if(!sort)
        return data

    if(data[0]){
        let dataWrapperA = new defaultObjDef(data[0])
        let dataWrapperB = new defaultObjDef()
        let comparerSource = 'return '

        sort.forEach((item, index) => {

            if(index > 0)
                comparerSource += ' || '

            if(typeof dataWrapperA[item.field] === 'string'){
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
        return data.sort( (a, b) => comparer(dataWrapperA.setData(a), dataWrapperB.setData(b)))
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