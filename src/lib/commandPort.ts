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

import * as net from 'net';

export interface CommandPortConfig {
  host: string;
  port: number;
}

export interface ProcessRequestCallback {
  (err: Error | null, response: string): void;
}

export class CommandPort {
  private evH: any;

  constructor(evH: any, config: CommandPortConfig) {
    this.evH = evH;

    const server = net.createServer((connection) => {
      console.info(`Client connected to Command Port: ${connection.remoteAddress}:${connection.remotePort}`);

      const welcomeMessage = `#tesseract@${config.host}:${config.port}> `;
      connection.write(`${welcomeMessage}`);

      connection.on('data', (data) => {
        const message = data.toString();

        this.processRequest(message, (_err, response) => {
          connection.write(`${response}\r\n${welcomeMessage}`);
        });
      });

      connection.on('error', (data) => {
        console.log(`Command Port error: ${JSON.stringify(data)}`);
      });
    });

    server.listen(config.port, config.host, () => {
      console.log(`Command Port started on: ${config.host}:${config.port}`);
    });
  }

  processRequest(message: string, callback: ProcessRequestCallback): void {
    let messagesArray: string[];

    if (message.indexOf('\r\n') > 0) { // windows
      messagesArray = message.split('\r\n');
    } else { // linux
      messagesArray = message.split('\n');
    }

    let response = '';
    messagesArray.forEach(item => {
      if (item !== '') {
        try {
          response = JSON.stringify((new Function('evH', `return evH.${item};`))(this.evH), null, 2);
        } catch (ex) {
          response = String(ex);
        }
        callback(null, response);
      }
    });

    if (messagesArray[0] === '') {
      callback(null, '');
    }
  }
}
