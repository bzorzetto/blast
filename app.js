const debug = 4;  // false = disable, true or 1, 2, 3 set log verbosity   
const fs = require('fs');
const MidiManager = require('./midi/MidiManager');
const VmixClient = require('./vmix/VmixClient');
const BoseClient = require('./bose/BoseClient');
const MediaoutClient = require('./mediaout/MediaoutClient');
const Slider = require('./controls/Slider');
const Button = require('./controls/Button');
const AudioConverter = require('./utils/AudioConverter');
const Blast = require('./utils/blast');
const MediaoutCommand = require('./mediaout/MediaoutActions');
const DicaffeineClient = require('./dicaffeine/dicaffeine');



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
const blast = new Blast();
const dicaffeine = new DicaffeineClient("192.168.127.139");

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
        bose: buttonConfig.bose?.function,
        blast: buttonConfig.blast?.function
    };

    if (buttonConfig.mediaout?.function) {
        buttonActions.mediaout =
        MediaoutCommand.fromString(buttonConfig.mediaout.function);
    }

    const button = new Button({

        midiNote: buttonConfig.midiNote,
        vmixType: buttonConfig.vmix?.type,
        vmixChannel: buttonConfig.vmix?.input,
        vmixValue: buttonConfig.vmix?.value,
        boseChannel: buttonConfig.bose?.channel,
        boseModule: buttonConfig.bose?.module,
        blastType: buttonConfig.blast?.type,
        blastParameters: buttonConfig.blast?.parameters,
        ledFeedBack: buttonConfig.ledFeedBack,
        buttonActions
    });
    midi.addControl(button);
});

dicaffeine.on("status", status => {
    if (debug > 2) {console.log("Dicaffeine ===> :", status)}
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
                   vmix.doCommand({type: control.getButtonActions()[action], input: control.vmixChannel, value: control.vmixValue});
               } else if (action === "bose" && control.boseChannel) {
                   bose.doCommand({module: control.boseModule, type: control.getButtonActions()[action], input: control.boseChannel});
               } else if (action === "blast" && control.blastType) {
                   blast.doCommand({function: control.getButtonActions()[action], delay: control.blastParameters.delay, inputs: control.blastParameters.inputs});
                   control.setState("blast", !control.getState("blast"));
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
                //try {
                    const input = inputs.find( input => input.number === String(control.vmixChannel) );
                    if (input && control.buttonActions.vmix.includes("MUTE")) { 
                        const muted = input.muted === "True"; 
                        control.setState("vmix", muted);
                    }
                //} catch {
                //}
        // Gestione dello stato "solo" degli ingressi        
                if (input && control.buttonActions.vmix.includes("SOLO")) { 
                    const solo = input.solo === "True"; 
                    control.setState("vmix", solo);
                }
        
        // Gestione dello stato "Running" "Paused" e "Completed" degli ingressi        
                if (input && control.buttonActions.vmix.includes("PLAY" || "PAUSE" || "RESTART")) { 
                    const running = input.state;
                    if (running === "Running") {
                        control.setState("vmix", true)
                        control.setLedBlink("vmix", false)
                    } else if (running === "Paused") {
                        control.setLedBlink("vmix", true)
                    } else if (running === "Completed") {
                        control.setState("vmix", false)
                        control.setLedBlink("vmix", false)
                    }
                }
        // Gestione subgruppi ingressi 
                if (input && control.buttonActions.vmix.includes("BUS")) {
                    try {
                        const audiobus = input.audiobusses.includes(control.buttonActions.vmix.substr(10, 1)); 
                        control.setState("vmix", audiobus);
                    } catch {
                    }
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
        // Gestione transizioni Wipe e Cut
                const activeInput = status.vmix.active;
                if (activeInput && control.vmixChannel === activeInput && (control.buttonActions.vmix.includes("WIPE") || control.buttonActions.vmix.includes("CUT"))) {
                    control.setState("vmix", true);
                } else if (activeInput && control.vmixChannel !== activeInput && (control.buttonActions.vmix.includes("WIPE") || control.buttonActions.vmix.includes("CUT"))) {
                    control.setState("vmix", false);
                }
                
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
    // Do subscriptions to Bose cahannels Gainx module to get feedback from
    midi.controls.forEach(control => {
        if (control instanceof Slider && control.boseModule && control.boseChannel) {
            //bose.subscribeGainGain(control.boseChannel);
            bose.doCommand({module: control.boseModule, type: "SUBSCRIBE_GAIN", input: control.boseChannel});
        }
        if (control instanceof Button && control.boseModule && control.boseChannel) {
            //bose.subscribeGainMute(control.boseChannel);
            bose.doCommand({module: control.boseModule, type: "SUBSCRIBE_MUTE", input: control.boseChannel});
        }
    });
    //bose.subscribePSTN(); // by default we subscribe to PSTN input just to be informed of incoming call
    bose.doCommand({module: "PSTN In 1", type: "SUBSCRIBE_CALL_STATUS"}); // by default we subscribe to PSTN input just to be informed of incoming call
});   


// ----------------------------//
// Evento msg da Bose          //
// ----------------------------//

bose.on("data", data => {
 
    const messages = data.split(";");  // Split the message into individual messages based on the semicolon delimiter

    if (debug > 3) {console.log("Bose ===> :", messages)};

    messages.forEach(msg => {
        
        // Set the call status based on the message received from Bose
        const pstn = msg.match(/INCOMING|HANGUP|IN CALL/) || false;
        
        if (pstn[0]) { 
            bose.setCallStatus(pstn[0]);
        }
        //------------------------------------------------------------

        midi.controls.forEach(control => {
            // Gestione sato "muted" dei moduli Bose GainCHx   
            if (control instanceof Button && msg === `GA"${control.boseModule}${control.boseChannel}">2=F`) {
                control.setState("bose", false);
            } else if (control instanceof Button && msg === `GA"${control.boseModule}${control.boseChannel}">2=O`) {
                control.setState("bose", true);
            }
            
            // Gestione sato "muted" dei moduli Bose Inputx
            if (control instanceof Button && msg === `GA"${control.boseModule}${control.boseChannel}">4=F`) {
                control.setState("bose", false);
            } else if (control instanceof Button && msg === `GA"${control.boseModule}${control.boseChannel}">4=O`) {
                control.setState("bose", true);
            }

            // Gestione PSTN in caso di chiamta fa lampeggiare il led corrispondente
            if (control instanceof Button && control.boseModule === "PSTN In 1" && bose.callStatus === "INCOMING") {
                control.setLedBlink("bose", true);
            } else if (control instanceof Button && control.boseModule === "PSTN In 1" && bose.callStatus === "IN CALL") {
                control.setLedBlink("bose", false);
                control.setState("bose", true);
            } else if (control instanceof Button && control.boseModule === "PSTN In 1" && bose.callStatus === "HANGUP") {
                control.setLedBlink("bose", false);
                control.setState("bose", false);
            }
        });
       
    });
    
});

blast.on("switch_now", input => {

    if (debug) {console.log("Blast ===> switch_now Input: ", input)};

    midi.controls.forEach(control => {
            // Gestione sato "cam_autoswitch" attivo
            if (control instanceof Button && control.vmixChannel === input && control.vmixType === "transition") {
                vmix.doCommand({type: control.getButtonActions().vmix, input: control.vmixChannel, value: control.vmixValue});
            }
            //if (control.midiNote === 25 && control.getButtonActions().blast === "CAM_AUTOSWITCH") {
            //    control.setState("blast", true);
            //}
        });
});

// ----------------------------//
// Timers                      //
// ----------------------------//

// Send Alive message every 2Sec to mediaout to keep connetion active
setInterval(() => {
    mediaout.send(MediaoutCommand.ALIVE);
    dicaffeine.updateStatus();
}, 2000);

// vMix status request
setInterval(() => {
    vmix.updateStatus();
}, 200);


// Updae MIDI leds
let on = 0;
setInterval(() => {
    var muted = Boolean;
    
    on++;

    midi.controls.forEach(control => {
        if (control instanceof Button) {
            muted = control.getState();
            // Stato "muted"
            if (!muted) {
                midi.send(config.midi.output, [0x90, control.midiNote, 0]);
            } else if (muted) {
                midi.send(config.midi.output, [0x90, control.midiNote, 127]);
            }
            // Lampeggio led
            if (control.ledBlink) {
                if (on > 1) {
                    midi.send(config.midi.output, [0x90, control.midiNote, 0]); 
                } else {
                    midi.send(config.midi.output, [0x90, control.midiNote, 127]);
                }
            }
        }     
           
    });

    if (on > 1 ) {on = 0};

}, 100);


console.log("System started.");
