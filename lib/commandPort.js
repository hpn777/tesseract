const net = require('net')

class CommandPort {

    constructor(evH, config) {
        this.evH = evH

        net.createServer((connection) => {
            console.info(`Client connected to Command Port: ${connection.remoteAddress}:${connection.remotePort}`);

            const welcomeMessage = `#tesseract@${config.host}:${config.port}> `;
            connection.write(`${welcomeMessage}`)

            connection.on('data', (data) => {
                var message = data.toString();

                this.processRequest(message, function (err, response) {
                    connection.write(`${response}\r\n${welcomeMessage}`)

                });
            });

            connection.on('error', (data) => {
                console.log(`Comand Port error: ${JSON.stringify(data)}`);
            });

        }).listen(config.port, config.host, () => {
            console.log(`Command Port started on: ${config.host}:${config.port}`);
        })
    }

    processRequest(message, callback) {
        var messagesArray

        if (message.indexOf('\r\n') > 0) //windows
            messagesArray = message.split('\r\n')
        else //linux
            messagesArray = message.split('\n')

        var response = ''
        messagesArray.forEach(item => {

            if (item !== '') {
                try {
                    response = JSON.stringify((new Function('evH', `return evH.${item};`))(this.evH), null, 2)
                } catch (ex) {
                    response = ex
                }
                callback(null, response)
            }
        })
        if (messagesArray[0] == '')
            callback(null, '')
    }
}

module.exports = CommandPort