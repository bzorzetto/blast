const net = require('net');
const http = require('http');
const EventEmitter = require('events');
const { XMLParser } = require('fast-xml-parser');
const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ""
});
class VmixClient extends EventEmitter {

    constructor(host, apiPort, webPort) {

        super();

        this.host = host;
        this.apiPort = apiPort;
        this.webPort = webPort; 

        this.socket = null;
        this.connected = false;

    }

    async getStatus() {

            return new Promise((resolve, reject) => {

            http.get(`http://${this.host}:${this.webPort}/api/`, res => {

                let xml = "";

                res.on("data", chunk => {
                    xml += chunk;
                });
                res.on("end", () => {
                    try {
                        const data = xmlParser.parse(xml);
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

        const status = await this.getStatus();
        
        let inputs;

        if (Array.isArray(status.vmix.inputs)) {

            inputs = Object.fromEntries(
                status.vmix.inputs.map(input => [
                    input.number,
                    input
                ])
            );

        } else {

            inputs = status.vmix.inputs;

        }

        this.emit("status", status);

    }

    connect() {

        this.socket = new net.Socket();

        this.socket.connect(this.apiPort, this.host);

        this.socket.on('connect', () => {

            this.connected = true;

            console.log("vMix connesso");

            this.emit("connected");

        });

        this.socket.on('data', (data) => {

            this.emit("data", data.toString());

        });

        this.socket.on('close', () => {

            this.connected = false;

            console.log("vMix disconnesso");

            this.emit("disconnected");

            setTimeout(() => this.connect(), 5000);

        });

        this.socket.on('error', err => {

            console.log(err.message);

        });

    }

    doCommand(command) {

        if(!this.connected)
            return;
        switch(command.type) {
            case "SET_VOLUME":
                this.setVolume(command.input, command.value);
                break;
            case "MUTE_CHANNEL":
                this.muteChannel(command.input);
                break;
            case "UNMUTE_CHANNEL":
                this.unmuteChannel(command.input);
                break;
            case "TOGGLE_MUTE_CHANNEL":
                this.toggleMuteChannel(command.input);
                break;
            default:
                console.log("Vmix Client: Unknown command type: " + command.type);
            }
    }

    send(command){

        if(!this.connected)
            return;

        this.socket.write(command+"\r\n");

    }

    setVolume(input,value){

        this.send(`FUNCTION SetVolume Input=${input}&Value=${value}`);

    }

    muteChannel(input){

        this.send(`FUNCTION AudioOff Input=${input}`);

    }

    unmuteChannel(input){

        this.send(`FUNCTION AudioOn Input=${input}`);

    }

    toggleMuteChannel(input){

        this.send(`FUNCTION Audio Input=${input}`);

    }
}

module.exports=VmixClient;