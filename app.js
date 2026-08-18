const debug = 3;  // false = disable, true or 1, 2, 3 set log verbosity   
const fs = require('fs');
const MidiManager = require('./midi/MidiManager');
const VmixClient = require('./vmix/VmixClient');
const BoseClient = require('./bose/BoseClient');
const MediaoutClient = require('./mediaout/MediaoutClient');
const Slider = require('./controls/Slider');
const Button = require('./controls/Button');
const AudioConverter = require('./utils/AudioConverter');
const MediaoutCommand = require('./mediaout/MediaoutActions');




// ---------------------------//
// Start Midi Engine          //
// ---------------------------//
const configFile = './config.json';

const midi = new MidiManager();

const midiInputDevices = midi.getInputs();
const midiOutputDevices = midi.getOutputs();

// ----------------------------//
// 1. Controllo configurazione //
// ----------------------------//

if (!fs.existsSync(configFile)) {

    console.log("Nessun file config.json trovato.");

    console.log("\nIngressi MIDI:");
    midiInputDevices.forEach(device => {
       console.log("MIDI Input Device: ", device.name);
   });
   console.log("\nUscite MIDI:");
   midiOutputDevices.forEach(device => {
       console.log("MIDI Output Device: ", device.name);
   }); 

   console.log("\nConfigura i dispositivi nel file config.json.");

   process.exit(0);
}

// -------------------------//
// 2. Carica configurazione //
// -------------------------//

const config = JSON.parse(
    fs.readFileSync(configFile, 'utf8')
);

// -------------------------//
// 3. Verifica dispositivi  //
// -------------------------//

const input = midi.findInput(
    config.midi.input
);

const output = midi.findOutput(
    config.midi.output
);

if (!input) {
    console.error(
        `\nERRORE: Input MIDI "${config.midi.input}" non trovato.`
    );
    process.exit(1);
}

if (!output) {
    console.error(
        `\nERRORE: Output MIDI "${config.midi.output}" non trovato.`
    );
    process.exit(1);
}


// ------------------------//
// 4. Tutto OK             //
// ------------------------//

console.log("\nConfigurazione MIDI OK.");

console.log(
    `Input  : ${input.name}`
);

console.log(
    `Output : ${output.name}`
);

midi.openInput(input.name); // ToDo: select midi source from a list of devices
midi.openOutput(output.name);



// ------------------------//
// Connect to remote hosts //
// ------------------------//

const vmix = new VmixClient(config.hosts.vmix.host, config.hosts.vmix.port);
const bose = new BoseClient(config.hosts.bose.host, config.hosts.bose.port);
const mediaout = new MediaoutClient(config.hosts.mediaout.host, config.hosts.mediaout.portTx, config.hosts.mediaout.portRx);

vmix.connect();
bose.connect();
mediaout.connect();

// ------------------------//
// Add midi controls       //
// ------------------------//
Object.keys(config.sliders).forEach(sliderId => {
    const sliderConfig = config.sliders[sliderId];
    //console.log(config.sliders[sliderId]);
    const slider = new Slider({
        midiCC: sliderConfig.midiCC,    
    vmixChannel: sliderConfig.vmix.input,
    boseChannel: sliderConfig.bose.channel
    });
    midi.addControl(slider);
});

Object.keys(config.buttons).forEach(buttonId => {
    const buttonConfig = config.buttons[buttonId];
    //console.log(config.buttons[buttonId]);
    const button = new Button({
        midiNote: buttonConfig.midiNote,
        vmixChannel: buttonConfig.vmix.input,
        boseChannel: buttonConfig.bose.channel,
        buttonActions: {
            mediaout: MediaoutCommand.fromString(buttonConfig.mediaout.function),
            vmix: buttonConfig.vmix.function,
            bose: buttonConfig.bose.function
        }
    });
    midi.addControl(button);
});

//const slider1 = new Slider({
//   midiCC:19,
//   vmixChannel:1,
//   boseChannel:1
//});

//midi.addControl(slider1);

// MEDIA OUT BUTTONS ///
//const button1 = new Button({
//   midiNote:1,
//   vmixChannel:1,
//   boseChannel:1,
//   buttonActions: {mediaout: MediaoutCommand.CUE, vmix: "TOGGLE_MUTE_CHANNEL", bose: "TOGGLE_MUTE_CHANNEL"}   
//});

//midi.addControl(button1);

//const button2 = new Button({
//   midiNote:4,
//   boseChannel:1,
//   buttonActions: {mediaout: MediaoutCommand.PLAY, vmix: "UNMUTE_CHANNEL", bose: "UNMUTE_CHANNEL"}
//});

//midi.addControl(button2);

//const button3 = new Button({
//   midiNote:7,
//   boseChannel:1,
//   buttonActions: {mediaout: MediaoutCommand.STOP, vmix: "MUTE_CHANNEL", bose: "MUTE_CHANNEL"}
//});

//midi.addControl(button3);

//midi.controls.forEach(control => {
//    console.log("Control added: ", control);
//});

// -----------------//
// Operate controls //
// -----------------//
midi.on("cc", msg => {

    if (debug) {console.log(msg)};

    midi.controls.forEach(control => {
        if (control instanceof Slider && msg.controller === control.midiCC) {
            control.setValue(msg.value);
            const boseValue = AudioConverter.midiToBose(control.value);
            const vmixValue = AudioConverter.midiToVmix(control.value);
            bose.setGain(control.boseChannel, boseValue);
            vmix.setVolume(control.vmixChannel, vmixValue);
        }
    });

    //if (msg.controller === slider1.midiCC) {
    //    slider1.setValue(msg.value);
    //    const boseValue = AudioConverter.midiToBose(slider1.value);
    //    const vmixValue = AudioConverter.midiToVmix(slider1.value);
    //    bose.setGain(slider1.boseChannel, boseValue);
    //    vmix.setVolume(slider1.vmixChannel, vmixValue);
    //}
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
   midi.controls.forEach(control => {
       if (control instanceof Button && msg.note === control.midiNote) {
           control.setValue(msg.value);
           midi.send("MIDI Mix",[0x90, control.midiNote, 0]);
       }
    });
   //if (msg.note === button1.midiNote) {
   //     button1.setValue(msg.value);
   //     midi.send("MIDI Mix",[0x90, button1.midiNote, 0]);
   // }
});

mediaout.on("message", msg => {

    if (debug > 2) {console.log("Messaggio UDP :", msg)};
    

});

// Send Alive message every 2Sec to mediaout to keep connetion active
setInterval(() => {
    mediaout.send(MediaoutCommand.ALIVE);
}, 2000);

console.log("System started.");
