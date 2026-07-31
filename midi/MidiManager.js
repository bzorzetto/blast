const EventEmitter = require('events');
const JZZ = require('jzz');

class MidiManager extends EventEmitter {

    constructor() {

        super();

        this.inputs = [];
        this.outputs = [];
        this.controls=[];
        this.engine = JZZ();

    }

    getInputs() {
        return this.engine.info().inputs;
    }

    getOutputs() {
        return this.engine.info().outputs;
    }
    
    addControl(control){

        this.controls.push(control);

    }

    openInput(name) {

        const input = JZZ().openMidiIn(name);

        input.connect(msg => {

            this.parseMessage(msg, name);

        });

        this.inputs.push(input);

        console.log("Input MIDI aperto:", name);

    }

    openOutput(name) {

        //const output = JZZ().openMidiOut(name);

        //this.outputs.push(output);
        this.outputs[name]=JZZ().openMidiOut(name);

        console.log("Output MIDI aperto:", name);

        //return output;

    }

    parseMessage(msg, deviceName) {
              
        const status = msg[0];

        const data1 = msg[1];

        const data2 = msg[2];

        const command = status & 0xF0;

        const channel = (status & 0x0F) + 1;

        switch(command){

            case 0x90:

                this.emit("noteon",{

                    devive:deviceName,

                    channel,

                    note:data1,

                    velocity:data2

                });

                break;

            case 0x80:

                this.emit("noteoff",{

                    devive:deviceName,

                    channel,

                    note:data1

                });

                break;

            case 0xB0:

                this.emit("cc",{

                    devive:deviceName,

                    channel,

                    controller:data1,

                    value:data2

                });

                break;

        }

    }

    send(device,data){

       this.outputs[device].send(data);

    }
}


module.exports=MidiManager;