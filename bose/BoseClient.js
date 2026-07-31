const net = require('net');
const EventEmitter = require('events');

class BoseClient extends EventEmitter {

    constructor(host, port) {

        super();

        this.host = host;
        this.port = port;

        this.socket = null;
        this.connected = false;

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

    send(command){

        if(!this.connected)
            return;

        this.socket.write(command+"\r");

    }

    setGain(channel,value){

        this.send(`SA "GainCH${channel}">1=${value}`);
        //console.log(`SA "GainCH${channel}">1=${value}`);

    }

    mute(channel){

        this.send(`SA "GainCH${channel}">2=O`);

    }

    unmute(channel){

        this.send(`SA "GainCH${channel}">2=R`);

    }

}

module.exports=BoseClient;