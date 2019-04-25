const Redis = require('ioredis')

const redisInstance = new Redis({
    host: 'redis',
    port: 6379
})


redisInstance.keys('tess.*').then(x => {
    x.forEach(item => redisInstance.del(item))
})
redisInstance.del('EvH.def')

setTimeout(() => {
    console.log('done')
    process.exit(0)
}, 10)


