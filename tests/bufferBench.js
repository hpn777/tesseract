var suite = new (require('benchmark').Suite)

const bufferLength = 300
var subject = Buffer.alloc(bufferLength)
var target = Buffer.alloc(bufferLength)
// tests
suite.add('Buffer#copy', () => subject.copy(target))
.add('Buffer[]', () => {
    let l = bufferLength
  while (l !== 0) {
    target[--l] = subject[l]
  }
})
// add listeners
.on('cycle', function(event) {
    console.log(String(event.target));
})
.on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'))
})
// run async
.run({ 'async': false });

