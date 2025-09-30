let EventHorizon = require('./dist/lib/eventHorizon')
let Tesseract = require('./dist/lib/tesseract')
let Cluster = require('./dist/lib/clusterRedis')
let ClusterRedis = require('./dist/lib/clusterRedis')
let backbone = require('./dist/lib/dataModels/backbone')
let lodash = require('lodash')
let linq = require('linq')

module.exports = {Cluster, ClusterRedis, EventHorizon, Tesseract, backbone, lodash, linq}
