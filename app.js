const debug = 3;  // false = disable, true or 1, 2, 3 set log verbosity   
const MidiManager = require('./midi/MidiManager');
const VmixClient = require('./vmix/VmixClient');
const BoseClient = require('./bose/BoseClient');
const MediaoutClient = require('./mediaout/MediaoutClient');
const Slider = require('./controls/Slider');
const Button = require('./controls/Button');
const AudioConverter = require('./utils/AudioConverter');
const MediaoutCommand = require('./mediaout/MediaoutActions');


const vmix = new VmixClient("127.0.0.1",8099);
const bose = new BoseClient("192.168.127.6",10055);
const mediaout = new MediaoutClient("127.0.0.1", 5400, 6400) 

// ------------------------//
// Start Midi Engine       //
// ------------------------//
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


// ------------------------//
// Add midi controls       //
// ------------------------//

const slider1 = new Slider({
   midiCC:19,
   vmixChannel:1,
   boseChannel:1
});

midi.addControl(slider1);

// MEDIA OUT BUTTONS ///
const button1 = new Button({
   midiNote:1,
   vmixChannel:1,
   boseChannel:1,
   buttonActions: {mediaout: MediaoutCommand.CUE, vmix: "TOGGLE_MUTE_CHANNEL", bose: "TOGGLE_MUTE_CHANNEL"}   
});

midi.addControl(button1);

const button2 = new Button({
   midiNote:4,
   boseChannel:1,
   buttonActions: {mediaout: MediaoutCommand.PLAY, vmix: "UNMUTE_CHANNEL", bose: "UNMUTE_CHANNEL"}
});

midi.addControl(button2);

const button3 = new Button({
   midiNote:7,
   boseChannel:1,
   buttonActions: {mediaout: MediaoutCommand.STOP, vmix: "MUTE_CHANNEL", bose: "MUTE_CHANNEL"}
});

midi.addControl(button3);

midi.controls.forEach(control => {
    console.log("Control added: ", control);
});

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

    midi.controls.forEach(control => {
       if (control instanceof Button && msg.note === control.midiNote) {
           control.setValue(msg.value);
           midi.send("MIDI Mix",[0x90, control.midiNote, 127]);
           Object.keys(control.getButtonActions()).forEach(action => {
               if (action === "mediaout") {
                   mediaout.send(control.getButtonActions()[action]);
               } else if (action === "vmix") {
                   vmix.doCommand({type: control.getButtonActions()[action], input: control.vmixChannel});
               } else if (action === "bose") {
                   bose.doCommand({type: control.getButtonActions()[action], input: control.boseChannel});
               }
           });
       }
    });

    //if (msg.note === button1.midiNote) {
    //    button1.setValue(msg.value);
    //    midi.send("MIDI Mix",[0x90, button1.midiNote, 127]);
    //    //button1.getButtonActions().mediaout ? mediaout.send(button1.getButtonActions().mediaout) : null;
    //    //button1.getButtonActions().vmix ? vmix.doCommand({type: button1.getButtonActions().vmix, input: button1.vmixChannel}) : null;
    //    Object.keys(button1.getButtonActions()).forEach(action => {
    //        if (action === "mediaout") {
    //            mediaout.send(button1.getButtonActions()[action]);
    //        } else if (action === "vmix") {
    //            vmix.doCommand({type: button1.getButtonActions()[action], input: button1.vmixChannel});
    //        } else if (action === "bose") {
    //            bose.doCommand({type: button1.getButtonActions()[action], input: button1.boseChannel});
    //        }
    //    });
    //}
            
    

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
