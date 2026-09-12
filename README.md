B.L.A.S.T. - Bruno Live Automation SofTware

Il progetto nasce per soddisfare un'esigenza, nata in azienda, quando si è deciso di produrre un programma musiacle live.
La produzione riteneva necessario che il prodotto finale assomigliasse il più possibile ad uno show di stile radiofonico anni 70,
dove, il DJ, agiva anche come regista di se stesso. A tale scopop si è pensato di dotare il conduttore di una console che fosse in grado di 
interagire con i più moderni sistemi di produzione come, vMix e Mediaout per la parte video con i più moderni processori audio come il Bose EX12880.
Data l'eterogeneicità del sistema seviva quindi un software di gestione in grado di interagire con i vari dispositivi presenti, ed ecco perchè nasce BLAST.
BLAST si avvale di un qualsiasi terminale MIDI ,come AKAI MidiMix o il Novation Launch Control, per tradurre i vari comandi MIDI in azioni utili per 
essere inviate alle periferiche secondo una configurazione decisa dall'utente.
 
                              ------
                              |MIDI|
                              ------
                                |  
                               usb
                                |
                              ------- 
                    ----udp---|BLAST|---tcp----
                    |         -------         |        
                    |           |             |
                    |          tcp            |
      -----    -----------    ------        ------    -----
      |etc|    |Mainlevel|    |vMix|        |Bose|    |etc|
      -----    -----------    ------        ------    -----

BAST comunica tramite API con vMix e tramite il protocollo TCP -> Seriale con Bose mentre per Mainlevel viene utilizzato il protocollo prorietario su base UDP

Configurazione:
Il file config.json è strutturato in due parti fondamentali:

Definizione hosts e porte:

    "hosts": {
            "vmix": {
                "host": "127.0.0.1",
                "apiPort": 8099,
                "webPort": 8088
            },
            "bose": {
                "host": "192.168.127.6",
                "port": 10055
            },
            "mediaout": {
                "host": "127.0.0.1",
                "portTx": 5400,
                "portRx": 6400
            }
        },
        "midi": {
            "input": "MIDI Mix",
            "output": "MIDI Mix"
        },
        "dicaffeine": {
                "1": {
                    "host": "192.168.127.106",
                    "port": 80
                },   
                "2": {
                    "host": "192.168.127.107",
                    "port": 80
                },   
                "3": {
                    "host": "192.168.127.108",
                    "port": 80
                }   
            }
    


Definizione sliders e loro funzioni:

    "sliders":{
        "1": {
            "name": "Master",
            "midiCC": 62,
            "vmix": {
                "type": "audio",
                "input": "M",
                "function": "VOLUME"
            },
            "bose": {
                "module": "Input ",
                "channel": 1,
                "function": "LEVEL"   
            }
        }
    }
            
Definizione pulsanti e relative funzioni:

-------------------------MUTE--------------------------

    "buttons":{
        "1": {
            "name": "Button_1",
            "midiNote": 1,
            "ledFeedBack": "bose",
            "bose": {
                "module": "Input ",
                "channel": 1,
                "function": "TOGGLE_MUTE_CHANNEL"
            },
            "vmix": {
                "type": "audio",
                "input": 1,
                "function": "TOGGLE_MUTE_CHANNEL"
            }
        }
    }

----------------------TRANSITION-----------------------

        "2": {
            "name": "Button_9",
            "midiNote": 3,
            "ledFeedBack": "vmix",
            "vmix": {
                "type": "transition",
                "input": 1,
                "function": "WIPE",
                "value": "1000"
            }
        }

-------------------------PSTN-------------------------

        "3": {
            "name": "PSTN",
            "midiNote": 26,
            "ledFeedBack": "bose",
            "bose": {
                "module": "PSTN In 1",
                "channel": 1,
                "function": "ANSWER_END_CALL"
            }
        }

--------------------CAM AUTOSWITCH---------------------

        "4": {
            "name": "Autoswitch",
            "midiNote": 25,
            "ledFeedBack": "blast",
            "blast": {
                "type": "command",
                "function": "CAM_AUTOSWITCH",
                "parameters": {
                    "delay": 3000,
                    "inputs": [1, 2, 3]
                }
            }
        }

------------------------OUTPUT------------------------

        "5": {
            "name": "Button_15",
            "midiNote": 15,
            "ledFeedBack": "vmix",
            "vmix": {
                "type": "video",
                "input": 12,
                "function": "SET_OUTPUT2",
                "value": "1"
            }
        }


----------------------DICAFFEINE------------------------

         "6": {
            "name": "Button_17",
            "midiNote": 21,
            "ledFeedBack": "blast",
            "dicaffeine": {
                "type": "video",
                "function": "PLAY"
            }
        }


Sliders functions:
: Volume - vMix        // (Unused now, maybe in the future)
: Gain - Bose          // (Unused now, maybe in the future) 


vMix button functions:

Audio:

: MUTE_CHANNEL         // Mute specific channel 
: UNMUTE_CHANNEL       // Unmute specific channel
: TOGGLE_MUTE_CHANNEL  // Toggle mute of specific channel
: PALY                 // Play track
: PAUSE                // Pause track
: RESTART              // Restart track
: SOLO                 // Solo specific audio channel (TOGGLE)

Audio Bus:

: BUSX_SEND_TO_MASTER  // Send bus A|B|C|D|E|F|G to master output (TOGGLE)
: AUDIO_BUS_A/B/C..etc // Send single audio input to a specific bus (TOGGLE)

Transitions:

: WIPE                 // vMix transition
: CUT                  // vMix transition

Output:

: SET_OUTPUT2          // vMix output 2 routing

Bose command definitions:

MODULE = "Input X":    // Analog input were X = 1 | 2 | 3 etc

: MUTE_CHANNEL         // Mute specific channel 
: UNMUTE_CHANNEL       // Unmute specific channel
: TOGGLE_MUTE_CHANNEL  // Toggle mute of specific channel
: SUBSCRIBE_MUTE       // Subscribe to module to get unsolicited update data change
: SUBSCRIBE_GAIN       // Subscribe to module to get unsolicited update data change


MODULE = "GainCHX":             // Gain module were X = 1 | 2 | 3 etc

: MUTE_CHANNEL         // Mute specific channel 
: UNMUTE_CHANNEL       // Unmute specific channel
: TOGGLE_MUTE_CHANNEL  // Toggle mute of specific channel
: SUBSCRIBE_MUTE       // Subscribe to module to get unsolicited update data change
: SUBSCRIBE_GAIN       // Subscribe to module to get unsolicited update data change


MODULE = "PSTN In 1":

: ANSWER_END_CALL       // Toggle call state
: END_CALL              // End active call
: ANSWER_CALL           // Answer incoming call
: SUBSCRIBE_CALL_STATUS // Subscribe to module to get unsolicited update data change 


Mainlevel:

: PLAY                  // Play event
: STOP                  // Stop event
: CUE                   // Cue next event


Dicaffeine:

PLAY:                   // Start Player
STOP:                   // Stop Player


Blast:

: CAM_AUTOSWITCH        // Start autoswitch between specified inputs
