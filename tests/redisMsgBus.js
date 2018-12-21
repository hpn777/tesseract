var RedisMQ = require('../lib/redisMQ');


var k = 0
const myMQ = new RedisMQ({
	host: 'redis',
	port: 6379
})
//myMQ.remove('news')
const dupa = myMQ.subscribe('news').subscribe((x)=>{
    console.log(x)
})

setTimeout(() => {
	console.log('sending message .....')
	myMQ.send('news', {dupa: 'dupa'})
}, 1000)
