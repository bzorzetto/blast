const http = require('http');
const EventEmitter = require('events');

class DicaffeineClient extends EventEmitter {

    constructor(host, port, id) {

        super();

        this.host = host;
        this.port = port;
        this.id = id;
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
                default:
                    cmd = "player_stream?name=" + encodeURIComponent(command);
            }
       
        const status = await this.sendCommand(cmd);
        

        } catch (error) {
    
        }
    }
}

module.exports = DicaffeineClient;