const http = require('http');
const https = requre('https');
const EventEmitter = require('events');

class HomeAssistantClient extends EventEmitter {

    constructor(host, port, apiToken) {

        super();

        this.host = host;
        this.port = port;
        this.token = apiToken;
        
        this.connected = false;
        this.debug = false;

    }

    async sendCommand(command) {

            return new Promise((resolve, reject) => {


            const options = {
            host: this.host,
            port: this.port,
            path: `/api/${command}`,
            method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                }
            };

            http.get(options, res => {

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
    
    async getStatus(command) {

        //let cmd;
        try {
        //    switch (command) {
        //        case "PLAY":
        //            cmd = "player_start";
        //            break;
        //        case "STOP":
        //            cmd = "player_stop";
        //            break;
        //    }

       
        const status = await this.sendCommand(command);
        

        } catch (error) {
    
        }
    }
}

module.exports = HomeAssistantClient;