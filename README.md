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
               ----tcp---|BLAST|---udp----
               |         -------         |
               |           |             |
               |          tcp            |
            ------       ------      -----------
            |Bose|       |vMix|      |Mainlevel|
            ------       ------      -----------

BAST comunica tramite API con vMix e tramite il protocollo TCP -> Seriale con Bose mentre per Mainlevel viene utilizzato il protocollo prorietario su base UDP

Configurazione:
Il file config.json è strutturato in due parti fondamentali:

Definizione hosts e porte

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
    }

Definizione sliders e loro funzioni:

    "sliders":{
        "1": {
            "name": "Slider_1",
            "midiCC": 19,
            "vmix": {
                "input": "M",
                "function": "Volume"
            },
            "bose": {
                "channel": 1,
                "function": "Gain"
            }
        }
    }
            
Definizione pulsanti e relative funzioni

    "buttons":{
        "1": {
            "name": "Button_1",
            "midiNote": 1,
            "ledFeedBack": "vmix"
            "vmix": {
                "input": "M",
                "function": "TOGGLE_MUTE_CHANNEL"
            },
            "mediaout": {
                "function": "CUE"
            }
        },
        "2": {
            "name": "Button_2",
            "midiNote": 4,
            "vmix": {
                "input": "A",
                "function": "TOGGLE_MUTE_CHANNEL"
            },
            "bose": {
                "channel": 2,
                "function": "MUTE_CHANNEL"
            }
        }
    }


Funzioni Pulsanti vMix:

Mute:
: MUTE_CHANNEL         // Mute specific channel 
: UNMUTE_CHANNEL       // Unmute specific channel
: TOGGLE_MUTE_CHANNEL  // Toggle mute of specific channel

Bus:
: BUSX_SEND_TO_MASTER  // Send bus A|B|C|D|E|F|G to master output (TOGGLE)
: AUDIO_BUS_A/B/C..etc // Send single audio input to a specific bus (TOGGLE)

Solo:
: SOLO                 // Solo specific audio channel (TOGGLE)

Funzioni Sliders:

: Volume - vMix        // (Unused now, maybe in the future)
: Gain - Bose          // (Unused now, maybe in the future) 


Funzioni Pulsanti Bose:

Mute:
: MUTE_CHANNEL         // Mute specific channel 
: UNMUTE_CHANNEL       // Unmute specific channel
: TOGGLE_MUTE_CHANNEL  // Toggle mute of specific channel
