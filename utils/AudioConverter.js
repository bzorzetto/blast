class AudioConverter {

    static midiToBose(value){
        const boseMinGain = -60;
        const boseMaxGain = 12;
        const midiMinValue = 0;
        const midiMaxValue = 127;
        var gain = (value * ((boseMinGain * -1 + boseMaxGain) / midiMaxValue)) -60;
        return Math.floor(gain);
    }

    static midiToVmix(value){
        const vmixMinVol = 0;
        const vmixMaxVol = 100;
        const midiMinValue = 0;
        const midiMaxValue = 127;
        var vol = (value * (vmixMaxVol / midiMaxValue));
        return Math.floor(vol);
        
    }

    static vmixToMidi(value){

        
    }

    static boseToMidi(value){

        
    }

}

module.exports = AudioConverter;