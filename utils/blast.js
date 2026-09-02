const EventEmitter = require('events');

class Blast extends EventEmitter {

    constructor() {

        super();

        this.debug = false;
        this.autoswitch = false;
        this.timer = null;
        this.inputs = null;
        this.input = 0;
    }

    doCommand(command) {
        switch(command.function) {
            case "CAM_AUTOSWITCH":
                this.autoswitch = !this.autoswitch;
                this.startTimer(command.delay, command.inputs); 
            break;
        }
    }

    sendSwitchNowEvent(inputs) {
        this.inputs = inputs.length;
        this.emit("switch_now", inputs[this.input]);
        this.input++; 
            if (this.input >= this.inputs) {
                this.input = 0;
            }
    }


    startTimer(delay, inputs) {
        if (this.autoswitch) {
            this.timer = setInterval(() => this.sendSwitchNowEvent(inputs), delay);
        } else if (!this.autoswitch) {
            clearInterval(this.timer);
            this.timer = null;
            this.input = 0; 
        }
    }
    
    
}

module.exports = Blast;