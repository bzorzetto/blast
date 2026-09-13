//const http = require('http');
import http from 'http';

//const EventEmitter = require('events');
import {EventEmitter} from 'events';

//class DicaffeineClient extends EventEmitter {
export default class DicaffeineClient extends EventEmitter {

    constructor(host, port) {

        super();

        this.host = host;
        this.port = port;
        
        this.connected = false;
        this.debug = false;

    }

    async sendCommand(command) {

            return new Promise((resolve, reject) => {

            http.get(`http://${this.host}/api/simple/${command}`, res => {

                let json = "";

                res.on("data", chunk => {
                    json += chunk;
                });
                res.on("end", () => {
                    try {
                        const data = JSON.parse(json);
                        resolve(data);
                    }
                    catch(err) {
                        reject(err);
                    }
                });
            }).on("error", reject);
        });
    }
    
    async updateStatus(command) {

        let cmd;
        try {
            switch (command) {
                case "PLAY":
                    cmd = "player_start";
                    break;
                case "STOP":
                    cmd = "player_stop";
                    break;
            }
       
        const status = await this.sendCommand(cmd);
        

        } catch (error) {
    
        }
    }
}

//module.exports = DicaffeineClient;