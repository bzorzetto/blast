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
        try {
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

        } catch (error) {
    
        }
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

    send(command) {

        if(!this.connected)
            return;

        this.socket.write(command+"\r\n");

    }

    setVolume(input,value) {
        
        switch(input) {
            case "M":  // Set master volume
                this.send(`FUNCTION SetMasterVolume Value=${value}`);
                break;
            case "A":  // Set bus volume
            case "B":
            case "C":
            case "D":
            case "E":
            case "F":
            case "G":
                this.send(`FUNCTION SetBus${input}Volume Value=${value}`);
                break;
            default: // Set input volume
                this.send(`FUNCTION SetVolume Input=${input}&Value=${value}`);
        }
    }

    muteChannel(input) {
        switch (input) {
            case "M": // Mute master
                this.send(`FUNCTION MasterAudioOff`);
                break;
            case "A":  // Mute bus
            case "B":
            case "C":
            case "D":
            case "E":
            case "F":
            case "G":
                this.send(`FUNCTION BusXAudioOff Value=${input}`);
                break;    
            default: // Mute input
                this.send(`FUNCTION AudioOff Input=${input}`);
        }
    }

    unmuteChannel(input){
        switch(input) {
            case "M": // Unmute master
                this.send(`FUNCTION MasterAudioOn`);
                break;
            case "A":  // Unmute bus
            case "B":
            case "C":
            case "D":
            case "E":
            case "F":
            case "G":
                this.send(`FUNCTION BusXAudioOn Value=${input}`);
                break;       
            default: // Unmute input
                this.send(`FUNCTION AudioOn Input=${input}`);
        }
    }

    toggleMuteChannel(input){
        switch (input) {
            case "M": // Toggle master mute
                this.send(`FUNCTION MasterAudio`);
                break;
            case "A":  // Toggle bus mute
            case "B":
            case "C":
            case "D":
            case "E":
            case "F":
            case "G":
                this.send(`FUNCTION BusXAudio Value=${input}`);
                break;
            default: // Toggle input mute 
                this.send(`FUNCTION Audio Input=${input}`);
        }
    }
}

module.exports=VmixClient;