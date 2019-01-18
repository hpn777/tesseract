var suite = new (require('benchmark').Suite);
const createSocket = require('dgram').createSocket
let socket = createSocket({
    type: 'udp4',
    reuseAddr: true
  })
  const { UDP } = require('udp_wrap');
  socket.bind(6666, '127.0.0.1', () => {
    console.log(socket)
  })


// const bufferLength = 100
// var subject = Buffer.alloc(bufferLength)
// var target = Buffer.alloc(bufferLength)
// // tests
// suite.add('Buffer#copy', () => subject.copy(target))
// .add('Buffer[]', () => {
//     let l = bufferLength
//   while (l !== 0) {
//     target[--l] = subject[l]
//   }
// })
// // add listeners
// .on('cycle', function(event) {
//     console.log(String(event.target));
// })
// .on('complete', function() {
//     console.log('Fastest is ' + this.filter('fastest').map('name'))
// })
// // run async
// .run({ 'async': false });

