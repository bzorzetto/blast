import fs from 'fs';
import MidiManager from './midi/MidiManager.js';
import VmixClient from './vmix/VmixClient.js';
import BoseClient from './bose/BoseClient.js';
import MediaoutClient from './mediaout/MediaoutClient.js';
import Slider from './controls/Slider.js';
import Button from './controls/Button.js';
import ButtonCC from './controls/ButtonCC.js';
import AudioConverter from './utils/AudioConverter.js';
import Blast from './utils/blast.js';
import MediaoutCommand from './mediaout/MediaoutActions.js';
import DicaffeineClient from './dicaffeine/dicaffeine.js';
import KeyboardManager from './kbd/KeyboardManager.js';
import HomeAssistantClient from './ha/ha.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from 'electron';


// ----------------------------//
// Configurazione
// ----------------------------//

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Durante lo sviluppo:
//     blast-devel/config.json
//
// Nell'applicazione pacchettizzata:
//     %APPDATA%\BLAST\config.json

const configFile = app.isPackaged
    ? path.join(app.getPath('userData'), 'config.json')
    : path.join(__dirname, 'config.json');


// Configurazione di default distribuita con BLAST

const defaultConfigFile = path.join(
    __dirname,
    'config.default.json'
);


console.log('BLAST: config file:', configFile);


// ----------------------------//
// Start Midi Engine
// ----------------------------//

const midi = new MidiManager();

const midiInputDevices = midi.getInputs();
const midiOutputDevices = midi.getOutputs();


// ----------------------------//
// 1. Controllo configurazione
// ----------------------------//

if (!fs.existsSync(configFile)) {

    console.log("\nNessun file config.json trovato.");

    console.log("\nIngressi MIDI:");

    midiInputDevices.forEach(device => {
        console.log(
            "MIDI Input Device: ",
            device.name
        );
    });


    console.log("\nUscite MIDI:");

    midiOutputDevices.forEach(device => {
        console.log(
            "MIDI Output Device: ",
            device.name
        );
    });


    // ----------------------------------------
    // Crea configurazione utente
    // ----------------------------------------

    if (!fs.existsSync(defaultConfigFile)) {

        console.error(
            "\nERRORE: config.default.json non trovato."
        );

        console.error(
            "Percorso cercato:",
            defaultConfigFile
        );

        process.exit(1);
    }


    fs.copyFileSync(
        defaultConfigFile,
        configFile
    );


    console.log(
        "\nCreato config.json dalla configurazione predefinita."
    );

    console.log(
        "Percorso:",
        configFile
    );
}


// ----------------------------//
// 2. Carica configurazione
// ----------------------------//

const config = JSON.parse(
    fs.readFileSync(
        configFile,
        'utf8'
    )
);


// ----------------------------//
// 3. Verifica dispositivi
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
// 4. Tutto OK
// ----------------------------//

console.log(
    "\nConfigurazione MIDI OK."
);

console.log(
    `Input  : ${input.name}`
);

console.log(
    `Output : ${output.name}`
);


midi.openInput(
    input.name
);

midi.openOutput(
    output.name
);

// ----------------------------//
// Connect to remote hosts     //
// ----------------------------//
const vmix = new VmixClient(config.hosts.vmix?.host || "127.0.0.1", config.hosts.vmix?.apiPort || 8099, config.hosts.vmix?.webPort || 8088);
const bose = new BoseClient(config.hosts.bose?.host || "127.0.0.1", config.hosts.bose?.port || 10055);
const mediaout = new MediaoutClient(config.hosts.mediaout?.host || "127.0.0.1", config.hosts?.mediaout.portTx || 5400, config.hosts.mediaout?.portRx || 6400);
const blast = new Blast();
const dicaffeine = [];
const keyboard = new KeyboardManager();
const ha = new HomeAssistantClient({
    url:  `http://${config.hosts.ha?.host || "127.0.0.1"}:${config.hosts.ha?.port || 8123}`,
    token: `${config.hosts.ha?.haApiToken}`
})


vmix.connect();
bose.connect();
mediaout.connect();

async function haConnect(){
    await ha.connect();
}

haConnect();


// ----------------------------//
// 4. Set Debug Level          //
// ----------------------------//
const debug = config?.debug.level || false; 
bose.setDebug(debug);
vmix.setDebug(debug);
ha.setDebug(debug);
console.log("Debug level :", debug);


// ----------------------------//
// Add midi controls           //
// ----------------------------//
// Aggiungo gli slider definiti nel file di configurazione
try {
    Object.keys(config.sliders).forEach(sliderId => {
        const sliderConfig = config.sliders[sliderId];
        const slider = new Slider({
            midiCC: sliderConfig.midiCC,    
        vmixChannel: sliderConfig.vmix?.input,
        boseChannel: sliderConfig.bose?.channel,
        boseModule: sliderConfig.bose?.module,
        haType: sliderConfig.ha?.type,
        haEntity: sliderConfig.ha?.entity,
        });
        midi.addControl(slider);
    });
} catch {
    console.log("Nessuo slider midi trovato");
}


// Aggiungo i pulsanti pilotati da note nidi definiti nel file di configurazione
try {
    Object.keys(config.buttonsMidiNote).forEach(buttonId => {

        const buttonConfig = config.buttonsMidiNote[buttonId];
        buildButton(buttonConfig, Button);

    });
} catch {
    console.log("Nessun pulsante Midi trovato");
}

// Aggiungo i pulsanti pilotati da Control Change midi definiti nel file di configurazione
try {
    Object.keys(config.buttonsMidiCC).forEach(buttonId => {

        const buttonConfig = config.buttonsMidiCC[buttonId];
        buildButton(buttonConfig, ButtonCC);
    
    });
} catch {
    console.log("Nessun pulsante Midi CC trovato");
}


// ----------------------------//
// Add Dicaffeine controls     //
// ----------------------------//
try {
    Object.keys(config.hosts.dicaffeine).forEach(entry => {

        const dicaffeineConfig = config.hosts.dicaffeine[entry];
        const dicaff = new DicaffeineClient(dicaffeineConfig.host, dicaffeineConfig.port);
        
        dicaff.on("status", status => {

            if (debug > 2) {console.log(`Dicaffeine [${entry}] ===>`, status);}

        });

        dicaffeine.push(dicaff);  

    });
} catch {
    console.log("Nessun player Dicaffeine trovato");
}


// ----------------------------//
// Add Keyboard controls       //
// ----------------------------//
try {
    Object.keys(config.keyboard).forEach(entry => {

        const buttonConfig = config.keyboard[entry];

        buildButton(buttonConfig, Button);

        keyboard.on(buttonConfig.key, () => {

            if (debug > 2) {console.log("KBD ===> Premuto il tasto:", buttonConfig.key);}
            
            midi.controls.forEach( control => {
                 
                if (((control instanceof Button) || (control instanceof ButtonCC)) && buttonConfig.key === control.key) {
                    operateButtons(control);
                }  
            });
        });
    });
} catch {
    console.log("Nessun hotkey da tastiera trovato");
}

// ----------------------------//
// Start Kbd Engine           //
// ----------------------------//
keyboard.start();



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
            if (control.haType) {
                ha.callService(control.haType, 'turn_on', {entity_id: `${control.haEntity}`, brightness: `${(control.value * 2)}`})
            }
        }

// Gestione ButtonsCC
        if (control instanceof ButtonCC && msg.controller === control.midiCC && msg.value > 0) {

           //control.setValue(msg.value); // azione inutile al momento
           operateButtons(control);

       }
    });
});


// ----------------------------//
// Evento Nota ON MIDI         //
// ----------------------------//
midi.on("noteon", msg => {

    if (debug) {console.log(msg)};

// Gestione Buttons Midi Note
    midi.controls.forEach(control => {
       if (((control instanceof Button) || (control instanceof ButtonCC)) && msg.note === control.midiNote) {
           operateButtons(control);
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

    if (debug > 4) {console.log("Messaggio UDP :", msg)};
    
});


// ----------------------------//
// Evento Status da vMix       //
// ----------------------------//
// Elabora i feedback da vMix ottenuti tramite la funzione 
// vmix.updateStatus() richiamata a tempo (vedi timers)
vmix.on("status", status => {
    
    const audioLevels = vmix.getAudioLevels(status);
    
    process.emit("blast:audioLevels", audioLevels);

    if (debug > 4) {console.log("Vmix ===> :", status)};

        const inputs = status.vmix.inputs.input;
        const busses = status.vmix.audio;

    try {
        midi.controls.forEach(control => {
        // Gestione dello stato "muted" degli ingressi  
            if (((control instanceof Button) || (control instanceof ButtonCC)) && !(control.vmixChannel === undefined)) { 
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
     
            bose.doCommand({module: control.boseModule, type: "SUBSCRIBE_GAIN", input: control.boseChannel});
        }
        if (((control instanceof Button) || (control instanceof ButtonCC)) && control.boseModule && control.boseChannel) {
           
            bose.doCommand({module: control.boseModule, type: "SUBSCRIBE_MUTE", input: control.boseChannel});
        }
    });
    
    bose.doCommand({module: "PSTN In 1", type: "SUBSCRIBE_CALL_STATUS"}); // by default we subscribe to PSTN input just to be informed of incoming call
});   


// ----------------------------//
// Evento msg da Bose          //
// ----------------------------//
bose.on("data", data => {
 
    const messages = data.split(";");  // Split the message into individual messages based on the semicolon delimiter

    if (debug > 4) {console.log("Bose ===> :", messages)};

    messages.forEach(msg => {
        
        // Set the call status based on the message received from Bose
        const pstn = msg.match(/INCOMING|HANGUP|IN CALL/) || false;
        
        if (pstn[0]) { 
            bose.setCallStatus(pstn[0]);
        }
        //------------------------------------------------------------

        midi.controls.forEach(control => {
            // Gestione sato "muted" dei moduli Bose GainCHx   
            if (((control instanceof Button) || (control instanceof ButtonCC)) && msg === `GA"${control.boseModule}${control.boseChannel}">2=F`) {
                control.setState("bose", false);
            } else if (((control instanceof Button) || (control instanceof ButtonCC)) && msg === `GA"${control.boseModule}${control.boseChannel}">2=O`) {
                control.setState("bose", true);
            }
            
            // Gestione sato "muted" dei moduli Bose Inputx
            if (((control instanceof Button) || (control instanceof ButtonCC)) && msg === `GA"${control.boseModule}${control.boseChannel}">4=F`) {
                control.setState("bose", false);
            } else if (((control instanceof Button) || (control instanceof ButtonCC)) && msg === `GA"${control.boseModule}${control.boseChannel}">4=O`) {
                control.setState("bose", true);
            }

            // Gestione PSTN in caso di chiamta fa lampeggiare il led corrispondente
            if (((control instanceof Button) || (control instanceof ButtonCC)) && control.boseModule === "PSTN In 1" && bose.callStatus === "INCOMING") {
                control.setLedBlink("bose", true);
            } else if (((control instanceof Button) || (control instanceof ButtonCC)) && control.boseModule === "PSTN In 1" && bose.callStatus === "IN CALL") {
                control.setLedBlink("bose", false);
                control.setState("bose", true);
            } else if (((control instanceof Button) || (control instanceof ButtonCC)) && control.boseModule === "PSTN In 1" && bose.callStatus === "HANGUP") {
                control.setLedBlink("bose", false);
                control.setState("bose", false);
            }
        });

        if (msg.match(/^GL [1-2]/)) {
        
            const channels = msg.match(/\[([a-f0-9]{1}|[a-f0-9]{2}),([a-f0-9]{1}|[a-f0-9]{2}),([a-f0-9]{1}|[a-f0-9]{2}),([a-f0-9]{1}|[a-f0-9]{2})\]/);
            
            let audioLevels = {};

            if (msg.match(/^GL 1/)) {
                audioLevels = {
                    ch1: channels[1],
                    ch2: channels[2],
                    ch3: channels[3],
                    ch4: channels[4],
                    ch5: null,
                    ch6: null,
                    ch7: null,
                    ch8: null
                };
            } else if (msg.match(/^GL 2/)) {
                audioLevels = {
                    ch1: null,
                    ch2: null,
                    ch3: null,
                    ch4: null,
                    ch5: channels[1],
                    ch6: channels[2],
                    ch7: channels[3],
                    ch8: channels[4]
                };
            }
            process.emit("blast:audioLevels", audioLevels);
        }
        
    });
    
});

blast.on("switch_now", input => {

    if (debug) {console.log("Blast ===> switch_now Input: ", input)};

    midi.controls.forEach(control => {
            // Gestione sato "cam_autoswitch" attivo
            if (((control instanceof Button) || (control instanceof ButtonCC)) && control.vmixChannel === input && control.vmixType === "transition") {
                vmix.doCommand({type: control.getButtonActions().vmix, input: control.vmixChannel, value: control.vmixValue});
            }
        });
});


// ----------------------------//
// Eventi Home Assistant       //
// ----------------------------//
ha.on('connected', () => {

    console.log('Home Assistant connesso');

});


ha.on('disconnected', () => {

    console.log('Home Assistant disconnesso');

});


ha.on('error', error => {

    console.error(
        'errore Home Assistant:',
        error
    );

});

midi.controls.forEach(control => {
            // Attiva le sottoscrizioni al cambio di stato delle entità configurate
            if (control.haEntity){ 
               ha.onStateChanged(control.haEntity, (newState, oldState, event) => {
                    console.log('HA --->', oldState?.state, '->', newState?.state, event);
                });          
            }
        });


// ----------------------------//
// Functions                   //
// ----------------------------//
function buildButton(buttonConfig, buttonType){

    // Prepara le azioni del pulsante
    const buttonActions = {
        vmix: buttonConfig.vmix?.function,
        bose: buttonConfig.bose?.function,
        blast: buttonConfig.blast?.function,
        dicaffeine: buttonConfig.dicaffeine?.function,
        ha: buttonConfig.ha?.function
    };

    if (buttonConfig.mediaout?.function) {
        buttonActions.mediaout =
        MediaoutCommand.fromString(buttonConfig.mediaout.function);
    }

    const button = new buttonType({

        midiNote: buttonConfig.midiNote,
        midiCC: buttonConfig.midiCC,
        vmixType: buttonConfig.vmix?.type,
        vmixChannel: buttonConfig.vmix?.input,
        vmixValue: buttonConfig.vmix?.value,
        boseChannel: buttonConfig.bose?.channel,
        boseModule: buttonConfig.bose?.module,
        blastType: buttonConfig.blast?.type,
        blastParameters: buttonConfig.blast?.parameters,
        haType: buttonConfig.ha?.type,
        haEntity: buttonConfig.ha?.entity,
        dicaffeineId: buttonConfig.dicaffeine?.id,
        ledFeedBack: buttonConfig.ledFeedBack,
        key: buttonConfig.key,
        buttonActions
    });
    midi.addControl(button);
}

function operateButtons(control){
    Object.keys(control.getButtonActions()).forEach(device => {
        if (device === "mediaout") {
            mediaout.send(control.getButtonActions()[device]);
        } else if (device === "vmix" && control.vmixChannel) {
            vmix.doCommand({type: control.getButtonActions()[device], input: control.vmixChannel, value: control.vmixValue});
        } else if (device === "bose" && control.boseChannel) {
            bose.doCommand({module: control.boseModule, type: control.getButtonActions()[device], input: control.boseChannel});
        } else if (device === "blast" && control.blastType) {
            blast.doCommand({function: control.getButtonActions()[device], delay: control.blastParameters.delay, inputs: control.blastParameters.inputs});
            control.setState("blast", !control.getState("blast"));
        } else if (device === "dicaffeine" && control.getButtonActions()[device]) {
            dicaffeine.forEach(dicaff => {
                dicaff.updateStatus(control.getButtonActions()[device]);      
            });            
        } else if (device === "ha" && control.getButtonActions()[device]) {
            ha.callService(control.haType, control.getButtonActions()[device], {entity_id: `${control.haEntity}`})
        }    
    });
}


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
    bose.getAudioLevels("1");
    bose.getAudioLevels("2");
}, 100);


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

        if (control instanceof ButtonCC) {
            muted = control.getState();
            // Stato "muted"
            if (!muted) {
                midi.send(config.midi.output, [0xB0, control.midiCC, 0]);
            } else if (muted) {
                midi.send(config.midi.output, [0xB0, control.midiCC, 127]);
            }
            // Lampeggio led
            if (control.ledBlink) {
                if (on > 1) {
                    midi.send(config.midi.output, [0xB0, control.midiCC, 0]); 
                } else {
                    midi.send(config.midi.output, [0xB0, control.midiCC, 127]);
                }
            }
        }     
           
    });

    if (on > 1 ) {on = 0};

}, 100);


console.log("System started.");
