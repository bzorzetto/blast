class Button{

    constructor(config){

        this.midiNote=config.midiNote;
        this.vmixChannel=config.vmixChannel;
        this.boseChannel=config.boseChannel;
        this.mediaoutCommand=config.mediaOutCommand;
        this.value = 0;
    }

    setValue(value){

        this.value = value;

        

    }

    
}

module.exports = Button;