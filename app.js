const debug = 4;  // false = disable, true or 1, 2, 3 set log verbosity   
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

// Set debug level 
bose.setDebug(debug);
vmix.setDebug(debug);

// ----------------------------//
// Add midi controls           //
// ----------------------------//

// Aggiungo gli slider definiti nel file di configurazione
Object.keys(config.sliders).forEach(sliderId => {
    const sliderConfig = config.sliders[sliderId];
    const slider = new Slider({
        midiCC: sliderConfig.midiCC,    
    vmixChannel: sliderConfig.vmix?.input,
    boseChannel: sliderConfig.bose?.channel,
    boseModule: sliderConfig.bose?.module
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
            if (control.boseChannel) {
                bose.setGain(control.boseModule, control.boseChannel, boseValue);
            } 
            if (control.vmixChannel) {
                vmix.setVolume(control.vmixChannel, vmixValue);
            }
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

           control.setValue(msg.value); // azione inutile al momento

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
    
    if (debug > 4) {console.log("Vmix ===> :", status)};

        const inputs = status.vmix.inputs.input;
        const busses = status.vmix.audio;

    try {
        midi.controls.forEach(control => {
        // Gestione dello stato "muted" degli ingressi  
            if ((control instanceof Button) && !(control.vmixChannel === undefined)) { 
                const input = inputs.find( input => input.number === String(control.vmixChannel) );
                if (input && control.buttonActions.vmix.includes("MUTE")) { 
                    const muted = input.muted === "True"; 
                    control.setState("vmix", muted);
                }
        // Gestione dello stato "solo" degli ingressi        
                if (input && control.buttonActions.vmix.includes("SOLO")) { 
                    const solo = input.solo === "True"; 
                    control.setState("vmix", solo);
                }
        // Gestione subgruppi ingressi 
                if (input && control.buttonActions.vmix.includes("BUS")) {
                    const audiobus = input.audiobusses.includes(control.buttonActions.vmix.substr(10, 1)); 
                    control.setState("vmix", audiobus);
                }
        // Gestione stati del Master e dei sub gruppi audio A,B,C,D,E,F e G
                Object.entries(busses).forEach(([channel, data]) => {
                    // Sato "muted"
                    const busmuted = data.muted === 'True';
                    if (channel.includes(control.vmixChannel) && control.buttonActions.vmix.includes("MUTE")) {
                        control.setState("vmix", busmuted);
                    } else if (channel === "master" && control.vmixChannel === "M" && control.buttonActions.vmix.includes("MUTE")) {
                        control.setState("vmix", busmuted);
                    }
                    // Stato "sendTo Master"    
                    const sendToMaster = data.sendToMaster === "True";
                    if (channel.includes(control.vmixChannel) && control.buttonActions.vmix.includes("BUSX")) {
                        control.setState("vmix", sendToMaster);
                    }

                });
            }
        });
    } catch(error) {
        console.log(error);     
    }
});



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
    bose.subscribePSTN(); // by default we subscribe to PSTN input just to get incoming call
});   


// ----------------------------//
// Evento msg da Bose          //
// ----------------------------//

bose.on("data", data => {

    if (debug > 3) {console.log("Bose ===> :", data)};

    const messages = data.split(";");
    
    messages.forEach(msg => {
        midi.controls.forEach(control => {
            // Gestione sato "muted"    
            if (control instanceof Button && msg === `GA"GainCH${control.boseChannel}">2=F`) {
                control.setState("bose", false);
            } else if (control instanceof Button && msg === `GA"GainCH${control.boseChannel}">2=O`) {
                control.setState("bose", true);
            }
        });

        if (msg === `GA"PSTN In 1">0>1="INCOMING"`){
            console.log("CHIAMATAAAAAAAAAA");
        }
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
