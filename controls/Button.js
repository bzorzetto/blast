class Button{

    constructor(config){

        this.midiNote = config.midiNote;
        this.vmixType = config.vmixType;
        this.vmixChannel = config.vmixChannel;
        this.vmixValue = config.vmixValue;
        this.boseChannel = config.boseChannel;
        this.boseModule = config.boseModule;
        this.mediaoutCommand = config.mediaOutCommand;
        this.buttonActions = config.buttonActions || {};
        this.ledFeedBack = config.ledFeedBack; 
        this.blastType = config.blastType;
        this.blastParameters = config.blastParameters;
        this.ledBlink = false;
        this.value = 0;
        this.state = false;

        

    }

    setValue(value){

        this.value = value;

    }

    setState(origin, state) {

        if (this.ledFeedBack === origin){this.state = state};

    }

    setLedBlink(origin, value) {

        if (this.ledFeedBack === origin){this.ledBlink = value};
    
    }

    getValue(){

        return this.value;

    }

    getState(){

        return this.state;

    }
    
    getMediaoutCommand(){

        return this.mediaoutCommand;

    }

    getButtonActions(){

        return this.buttonActions;

    }
    
}

module.exports = Button;