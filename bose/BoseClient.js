const net = require('net');
const EventEmitter = require('events');

class BoseClient extends EventEmitter {

    constructor(host, port) {

        super();

        this.host = host;
        this.port = port;

        this.socket = null;
        this.connected = false;
        this.debug = false;
    }

    connect() {

        this.socket = new net.Socket();

        this.socket.connect(this.port, this.host);

        this.socket.on('connect', () => {

            this.connected = true;

            console.log("BOSE connesso");

            this.emit("connected");

        });

        this.socket.on('data', (data) => {

            this.emit("data", data.toString());

        });

        this.socket.on('close', () => {

            this.connected = false;

            console.log("BOSE disconnesso");

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

            case "MUTE_CHANNEL":
                this.mute(command.input);
                break;

            case "UNMUTE_CHANNEL":
                this.unmute(command.input);
                break;

            case "TOGGLE_MUTE_CHANNEL":
                this.toggleMute(command.input);
                break;

            default:
                console.log("Bose Client: Unknown command type: " + command.type);
                break;
        }
    }

    setDebug(level){
        this.debug = level;
    }

    send(command){
        if(!this.connected)
            return;

        this.socket.write(command+"\r");
        if (this.debug > 3) {console.log("Bose <===", command);}
    }

    setGain(module, channel, value){
        switch (module) {
            case "INPUT":
                this.send(`SA "Input ${channel}">3=${value}`);
                break;
            case "GainCH":
                this.send(`SA "${module}${channel}">1=${value}`);
                break;
        }
    }

    mute(channel) {
        this.send(`SA "GainCH${channel}">2=O`);
    }

    unmute(channel) {
        this.send(`SA "GainCH${channel}">2=F`);
    }

    toggleMute(channel) {
        this.send(`SA "GainCH${channel}">2=T`);
    }

    subscribeMute(channel) {
        this.send(`SUB "GA "GainCH${channel}">2"`)
    }

    subscribeGain(channel) {
        this.send(`SUB "GA "GainCH${channel}">1"`)
    }

    subscribePSTN() {
        this.send(`SUB "GA "PSTN In 1">0>1"`);
    }
}

module.exports=BoseClient;