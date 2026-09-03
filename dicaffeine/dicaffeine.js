const http = require('http');
const EventEmitter = require('events');

class DicaffeineClient extends EventEmitter {

    constructor(host) {

        super();

        this.host = host;
        
        this.connected = false;
        this.debug = false;

    }

    async playerStart() {

            return new Promise((resolve, reject) => {

            http.get(`http://${this.host}/api/simple/player_start`, res => {

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
    
    async updateStatus() {
        try {
            const status = await this.playerStart();
        
            this.emit("status", status);

        } catch (error) {
    
        }
    }
}

module.exports = DicaffeineClient;