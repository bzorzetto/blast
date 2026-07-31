const debug = 3;  // false = disable, true or 1, 2, 3 set log verbosity   
const MidiManager = require('./midi/MidiManager');
const VmixClient = require('./vmix/VmixClient2');
const BoseClient = require('./bose/BoseClient');
const MediaoutClient = require('./mediaout/MediaoutClient');
const Slider = require('./controls/Slider');
const Button = require('./controls/Button');
const AudioConverter = require('./utils/AudioConverter');
const MediaoutCommand = require('./mediaout/MediaoutActions');

const vmix = new VmixClient("127.0.0.1",8099);
const bose = new BoseClient("192.168.127.6",10055);
const mediaout = new MediaoutClient("127.0.0.1", 5400, 6400) 

// ------------------//
// Start Midi Engine //
// ------------------//
const midi = new MidiManager();
console.table(midi.getInputs());
console.table(midi.getOutputs());
midi.openInput("MIDI Mix"); // ToDo: select midi source from a list of devices
midi.openOutput("MIDI Mix");

// ----------------------- //
// Connect to remote hosts //
// ----------------------- //
vmix.connect();
bose.connect();
mediaout.connect();


// ------------------//
// Add midi controls //
// ------------------//
const slider1 = new Slider({
   midiCC:19,
   vmixChannel:12,
   boseChannel:1
});

midi.addControl(slider1);

const button1 = new Button({
   midiNote:3,
   mediaOutCommand:"cue"
});

midi.addControl(button1);

// -----------------//
// Operate controls //
// -----------------//
midi.on("cc", msg => {

    if (debug) {console.log(msg)};

    if (msg.controller === slider1.midiCC) {

        slider1.setValue(msg.value);

        const boseValue = AudioConverter.midiToBose(slider1.value);

        const vmixValue = AudioConverter.midiToVmix(slider1.value);

        bose.setGain(slider1.boseChannel, boseValue);

        vmix.setVolume(slider1.vmixChannel, vmixValue);
    }
});

midi.on("noteon", msg => {

    if (debug) {console.log(msg)};

    if (msg.note === button1.midiNote) {
        button1.setValue(msg.value);
        midi.send("MIDI Mix",[0x90, button1.midiNote, 127]);
        //mediaout.send(MediaoutCommand.CUE);
    }

});

midi.on('noteoff', msg => {

   if (debug) {console.log(msg)};

   if (msg.note === button1.midiNote) {
        button1.setValue(msg.value);
        midi.send("MIDI Mix",[0x90, button1.midiNote, 0]);
    }
});

mediaout.on("message", msg => {

    if (debug > 2) {console.log("Messaggio UDP :", msg)};
    

});

// Send Alive message every 2Sec to mediaout to keep connetion active
setInterval(() => {
    mediaout.send(MediaoutCommand.ALIVE);
}, 2000);

console.log("System started.");
