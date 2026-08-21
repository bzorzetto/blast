class Button{

    constructor(config){

        this.midiNote=config.midiNote;
        this.vmixChannel=config.vmixChannel;
        this.boseChannel=config.boseChannel;
        this.mediaoutCommand=config.mediaOutCommand;
        this.buttonActions=config.buttonActions || {};
        this.value = 0;
        this.state = "";
    }

    setValue(value){

        this.value = value;
    }

    setState(state) {

        this.state = state;

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