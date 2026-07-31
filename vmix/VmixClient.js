const http = require('http');
const EventEmitter = require('events');

class VmixClient extends EventEmitter {

    constructor(host,port){

        super();

        this.host=host;
        this.port=port;

    }

    connect(){

        console.log("vMix pronto");

        this.emit("connected");

    }

    sendFunction(command){

        const options={

            hostname:this.host,

            port:this.port,

            path:`/api/?Function=${command}`,

            method:'GET'

        };

        http.request(options).end();

    }

    setVolume(input,value){

        this.sendFunction(`SetVolume&Input=${input}&Value=${value}`);

    }

    mute(input){

        this.sendFunction(`AudioOff&Input=${input}`);

    }

    unmute(input){

        this.sendFunction(`AudioOn&Input=${input}`);

    }

}

module.exports=VmixClient;