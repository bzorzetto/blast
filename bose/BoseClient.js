//const net = require('net');
import net from 'net';

//const EventEmitter = require('events');
import {EventEmitter} from 'events';

//class BoseClient extends EventEmitter {
export default class BoseClient extends EventEmitter {

    constructor(host, port) {

        super();

        this.host = host;
        this.port = port;

        this.socket = null;
        this.connected = false;
        this.callStatus = "HANGUP"
        this.debug = false;
    }

    connect() {

        this.socket = new net.Socket();

        this.socket.connect(this.port, this.host);

        this.socket.on('connect', () => {

            this.connected = true;

            if (this.debug > 3) {console.log("BOSE connesso");}

            this.emit("connected");

        });

        this.socket.on('data', (data) => {

            this.emit("data", data.toString());

        });

        this.socket.on('close', () => {

            this.connected = false;

            if (this.debug > 3) {console.log("BOSE disconnesso");}

            this.emit("disconnected");

            setTimeout(() => this.connect(), 5000);

        });

        this.socket.on('error', err => {

            if (this.debug > 3) {console.log(err.message);}

        });

    }

    doCommand(command) {

        if(!this.connected)
            return;
        switch(command.module) {
            case "GainCH":
                switch(command.type) {
                    case "MUTE_CHANNEL":
                        this.send(`SA "${command.module}${command.input}">2=O`);
                        break;

                    case "UNMUTE_CHANNEL":
                        this.send(`SA "${command.module}${command.input}">2=F`);
                        break;

                    case "TOGGLE_MUTE_CHANNEL":
                        this.send(`SA "${command.module}${command.input}">2=T`);
                        break;
                    case "SUBSCRIBE_GAIN":
                        //this.subscribeGainGain(command.input);
                        this.send(`SUB "GA "${command.module}${command.input}">1"`)
                        break;
                    case "SUBSCRIBE_MUTE":
                        //this.subscribeGainMute(command.input);
                        this.send(`SUB "GA "${command.module}${command.input}">2"`)
                        break;
                    default:
                        console.log("Bose Client: Unknown command type: " + command.module + " " + command.type);
                        break;
                    }
                break;
            case "Input ":
                switch(command.type) {
                    case "MUTE_CHANNEL":
                        this.send(`SA "${command.module}${command.input}">4=O`);
                        break;
                    case "UNMUTE_CHANNEL":
                        this.send(`SA "${command.module}${command.input}">4=F`);
                        break;
                    case "TOGGLE_MUTE_CHANNEL":
                        this.send(`SA "${command.module}${command.input}">4=T`);
                        break;
                    case "SUBSCRIBE_GAIN":
                        this.send(`SUB "GA "${command.module}${command.input}">3"`)
                        break;
                    case "SUBSCRIBE_MUTE":    
                        this.send(`SUB "GA "${command.module}${command.input}">4"`)
                    default:
                        console.log("Bose Client: Unknown command type: " + command.module + " " + command.type);
                        break;
                }
                break;
            case "PSTN In 1":
                switch(command.type) {
                    case "ANSWER_END_CALL":
                        //this.pstnAnswerEndCall();
                        if (this.callStatus === "INCOMING") {
                            this.send(`MA "PSTN In 1">4`);
                            //this.pstnAnswerCall();
                        } else if (this.callStatus === "IN CALL") {
                            this.send(`MA "PSTN In 1">3`);
                            //this.pstnEndCall();
                        }      
                        break;
                    case "SUBSCRIBE_CALL_STATUS":
                        this.send(`SUB "GA "PSTN In 1">0>1"`);
                        //this.subscribePSTN();
                        break;
                    case "ANSWER_CALL":
                        this.send(`MA "PSTN In 1">4`);
                        break;
                    case "END_CALL":
                        this.send(`MA "PSTN In 1">3`);
                        break;
                    default:
                        console.log("Bose Client: Unknown command type: " + command.module + " " + command.type);
                        break;
            }
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
            case "Input ":
                this.send(`SA "${module}${channel}">3=${value}`);
                break;
            case "GainCH":
                this.send(`SA "${module}${channel}">1=${value}`);
                break;
        }
    }

    getAudioLevels(module){
        this.send(`GL ${module}`);
    }
    
    setCallStatus(status) {
        this.callStatus = status;
    }
}

//module.exports=BoseClient;