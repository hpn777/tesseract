let {smartDebounce} = require('../lib/utils')

this.sum = 0
let ddd = new smartDebounce((a)=>{
    console.log(a, this.sum)
}, 1000, true)

setInterval(() => {
    ddd.run(this.sum++)
}, 100)