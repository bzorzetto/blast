//const dgram = require('dgram');
import dgram from 'dgram';

//const EventEmitter = require('events');
import EventEmitter from 'events';

//class MediaoutClient extends EventEmitter {
export default class MediaoutClient extends EventEmitter{

    constructor(host, localPort, remotePort) {

        super();

        this.host = host;
        this.localPort = localPort;
        this.remotePort = remotePort;

        this.socket = null;
        this.connected = false;

    }

    connect() {

        this.socket = new dgram.createSocket('udp4');
        this.socket.bind(this.localPort);

        this.socket.on('listening', () => {
           const address = this.socket.address();
           console.log(`UDP listening on ${address.address}:${address.port}`);
           this.connected = true;
        });

        this.socket.on('message', msg => {

           this.emit("message", msg);

        });

        this.socket.on('close', () => {

            this.connected = false;

            console.log("MEDIAOUT disconnesso");

            this.emit("disconnected");

            setTimeout(() => this.connect(), 5000);

        });

        this.socket.on('error', err => {

           console.error('UDP socket error:', err.message);

        });
    }

    send(command){

        if(!this.connected)
           return;

        const buffer = Buffer.from(command, 'hex');
        
        this.socket.send(
            buffer,
            this.remotePort,
            this.host,
            err => {
               if (err) {
                  console.error('UDP send error:', err.message);
            }
        });
    }
    
}
//module.exports=MediaoutClient;