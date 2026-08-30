class Slider{

    constructor(config){

        this.midiCC=config.midiCC;
        this.vmixChannel=config.vmixChannel;
        this.boseChannel=config.boseChannel;
        this.boseModule=config.boseModule;
        this.value = 0;
    }

    setValue(value){

        this.value = value;  
    }

    getValue(){

        return this.value;
        
    }
}

module.exports=Slider;