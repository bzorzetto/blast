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




// ----------------------------//
// Start Midi Engine           //
// ----------------------------//

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

// ----------------------------//
// 2. Carica configurazione    //
// ----------------------------//

const config = JSON.parse(
    fs.readFileSync(configFile, 'utf8')
);


// ----------------------------//
// 3. Verifica dispositivi     //
// ----------------------------//

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


// ----------------------------//
// 4. Tutto OK                 //
// ----------------------------//

console.log("\nConfigurazione MIDI OK.");

console.log(
    `Input  : ${input.name}`
);

console.log(
    `Output : ${output.name}`
);

midi.openInput(input.name); // ToDo: select midi source from a list of devices
midi.openOutput(output.name);



// ----------------------------//
// Connect to remote hosts     //
// ----------------------------//

const vmix = new VmixClient(config.hosts.vmix.host, config.hosts.vmix.apiPort, config.hosts.vmix.webPort);
const bose = new BoseClient(config.hosts.bose.host, config.hosts.bose.port);
const mediaout = new MediaoutClient(config.hosts.mediaout.host, config.hosts.mediaout.portTx, config.hosts.mediaout.portRx);

vmix.connect();
bose.connect();
mediaout.connect();


// ----------------------------//
// Add midi controls           //
// ----------------------------//

// Aggiungo gli slider definiti nel file di configurazione
Object.keys(config.sliders).forEach(sliderId => {
    const sliderConfig = config.sliders[sliderId];
    const slider = new Slider({
        midiCC: sliderConfig.midiCC,    
    vmixChannel: sliderConfig.vmix?.input,
    boseChannel: sliderConfig.bose?.channel
    });
    midi.addControl(slider);
});

// Aggiungo i pulsanti definiti nel file di configurazione
Object.keys(config.buttons).forEach(buttonId => {

    const buttonConfig = config.buttons[buttonId];
    
    // Prepara le azioni del pulsante
    const buttonActions = {
        vmix: buttonConfig.vmix?.function,
        bose: buttonConfig.bose?.function
    };

    if (buttonConfig.mediaout?.function) {
        buttonActions.mediaout =
        MediaoutCommand.fromString(buttonConfig.mediaout.function);
    }

    const button = new Button({

        midiNote: buttonConfig.midiNote,
        vmixChannel: buttonConfig.vmix?.input,
        boseChannel: buttonConfig.bose?.channel,
        ledFeedBack: buttonConfig.ledFeedBack,
        buttonActions
    });
    midi.addControl(button);
});


// ----------------------------//
// Evento Control Change MIDI  //
// ----------------------------//

midi.on("cc", msg => {

    if (debug) {console.log(msg)};

// Gestione sliders

    midi.controls.forEach(control => {
        if (control instanceof Slider && msg.controller === control.midiCC) {
            control.setValue(msg.value);
            const boseValue = AudioConverter.midiToBose(control.value);
            const vmixValue = AudioConverter.midiToVmix(control.value);
            bose.setGain(control.boseChannel, boseValue);
            vmix.setVolume(control.vmixChannel, vmixValue);
        }
    });

});

// ----------------------------//
// Evento Nota ON MIDI         //
// ----------------------------//
midi.on("noteon", msg => {

    if (debug) {console.log(msg)};

// Gestione Buttons

    midi.controls.forEach(control => {
       if (control instanceof Button && msg.note === control.midiNote) {
           control.setValue(msg.value);
           //control.setState();
           //midi.send(config.midi.output, [0x90, control.midiNote, 127]);
           Object.keys(control.getButtonActions()).forEach(action => {
               if (action === "mediaout") {
                   mediaout.send(control.getButtonActions()[action]);
               } else if (action === "vmix" && control.vmixChannel) {
                   vmix.doCommand({type: control.getButtonActions()[action], input: control.vmixChannel});
               } else if (action === "bose" && control.boseChannel) {
                   bose.doCommand({type: control.getButtonActions()[action], input: control.boseChannel});
               }
           });
       }
    });
});


// ----------------------------//
// Evento Nota OFF MIDI        //
// ----------------------------//

midi.on('noteoff', msg => {

   if (debug) {console.log(msg)};
 
});


// ----------------------------//
// Evento msg da Mediaout      //
// ----------------------------//

mediaout.on("message", msg => {

    if (debug > 2) {console.log("Messaggio UDP :", msg)};
    
});


// ----------------------------//
// Evento Status da vMix       //
// ----------------------------//
// Elabora i feedback da vMix ottenuti tramite la funzione 
// vmix.updateStatus() richiamata a tempo (vedi timers)

vmix.on("status", status => {
 
    // Gestione stato "muted" del Master e dei sub gruppi audio A,B,C,D,E,F e G -------------------------------------//
    // pezzo di codice terribile da sistemare........

        const inputs = status.vmix.inputs.input;
        const busMaster = status.vmix.audio.master;
        const busA = status.vmix.audio.busA;
        const busB = status.vmix.audio.busB;
        const busC = status.vmix.audio.busC;
        const busD = status.vmix.audio.busD;
        const busE = status.vmix.audio.busE;
        const busF = status.vmix.audio.busF;
        const busG = status.vmix.audio.busG;

try {
        midi.controls.forEach(control => { 
            if ((control instanceof Button) && (busMaster?.muted === "True") && (control.vmixChannel === "M")) { 
                control.setState("vmix", true);
            } else if ((control instanceof Button) && (busMaster?.muted === "False") && (control.vmixChannel === "M")) {
                control.setState("vmix", false);
            } else if ((control instanceof Button) && (busA?.muted === "True") && (control.vmixChannel === "A")) {
                control.setState("vmix", true);
            } else if ((control instanceof Button) && (busA?.muted === "False") && (control.vmixChannel === "A")) {
                control.setState("vmix", false);
            } else if ((control instanceof Button) && (busB?.muted === "True") && (control.vmixChannel === "B")) {
                control.setState("vmix", true);
            } else if ((control instanceof Button) && (busB?.muted === "False") && (control.vmixChannel === "B")) {
                control.setState("vmix", false);
            } else if ((control instanceof Button) && (busC?.muted === "True") && (control.vmixChannel === "C")) {
                control.setState("vmix", true);
            } else if ((control instanceof Button) && (busC?.muted === "False") && (control.vmixChannel === "C")) {
                control.setState("vmix", false);
            } else if ((control instanceof Button) && (busD?.muted === "True") && (control.vmixChannel === "D")) {
                control.setState("vmix", true);
            } else if ((control instanceof Button) && (busD?.muted === "False") && (control.vmixChannel === "D")) {
                control.setState("vmix", false);
            } else if ((control instanceof Button) && (busE?.muted === "True") && (control.vmixChannel === "E")) {
                control.setState("vmix", true);
            } else if ((control instanceof Button) && (busE?.muted === "False") && (control.vmixChannel === "E")) {
                control.setState("vmix", false);
            } else if ((control instanceof Button) && (busF?.muted === "True") && (control.vmixChannel === "F")) {
                control.setState("vmix", true);
            } else if ((control instanceof Button) && (busF?.muted === "False") && (control.vmixChannel === "F")) {
                control.setState("vmix", false);
            } else if ((control instanceof Button) && (busG?.muted === "True") && (control.vmixChannel === "G")) {
                control.setState("vmix", true);
            } else if ((control instanceof Button) && (busG?.muted === "False") && (control.vmixChannel === "G")) {
                control.setState("vmix", false);
            }
        }); 
    } catch(error) {
        console.log(error);
    }     
//-------------------------------------------------------------------------------------------------------------------//

// Gestione dello stato "muted" degli ingressi 
        midi.controls.forEach(control => { 
            if ((control instanceof Button) && !(control.vmixChannel === undefined)) { 
                const input = inputs.find( input => input.number === String(control.vmixChannel) );
                if (input) { 
                    const muted = input.muted === "True"; 
                    control.setState("vmix", muted); 
                } 
            } 
        });
});
// ------------------------------------------------------------------------------------------------------------------//


// ----------------------------//
// Evento connessione Bose     //
// ----------------------------//
bose.on("connected", msg => {
    // Do subscriptions to Bose cahannels to get feedback from
    midi.controls.forEach(control => {
        if (control instanceof Slider && control.boseChannel) {
            bose.subscribeGain(control.boseChannel);
        }
        if (control instanceof Button && control.boseChannel) {
            bose.subscribeMute(control.boseChannel);
        }
    });
});   


// ----------------------------//
// Evento msg da Bose          //
// ----------------------------//

bose.on("data", data => {

    if (debug > 2) {console.log("Bose ==> :", data)};

    const messages = data.split(";");
    
    messages.forEach(msg => {
        midi.controls.forEach(control => {    
            if (control instanceof Button && msg === `GA"GainCH${control.boseChannel}">2=F`) {
                control.setState("bose", false);
            } else if (control instanceof Button && msg === `GA"GainCH${control.boseChannel}">2=O`) {
                control.setState("bose", true);
            }
        });
    });
});



// ----------------------------//
// Timers                      //
// ----------------------------//

// Send Alive message every 2Sec to mediaout to keep connetion active
setInterval(() => {
    mediaout.send(MediaoutCommand.ALIVE);
}, 2000);

// vMix status request
setInterval(() => {
    vmix.updateStatus();
}, 200);

// Updae MIDI leds
setInterval(() => {
    var muted = Boolean;
    midi.controls.forEach(control => {
        if (control instanceof Button) {
            muted = control.getState();
            if (!muted) {
                midi.send(config.midi.output, [0x90, control.midiNote, 0]);
            } else if (muted) {
                midi.send(config.midi.output, [0x90, control.midiNote, 127]);
            }
        }    
    });
}, 200);

console.log("System started.");
