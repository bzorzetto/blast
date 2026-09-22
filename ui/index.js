    /*
     * =========================================================
     * CONVERSIONE LINEARE -> dB
     * =========================================================
     */

    function linearToDb(value) {

        value = Number(value);

        if (!Number.isFinite(value) || value <= 0) {
            return -Infinity;
        }

        return 20 * Math.log10(value);
    }


    /*
     * =========================================================
     * dB -> PERCENTUALE METER
     *
     * Il meter visualizza:
     *
     * -60 dB = 0%
     *   0 dB = 100%
     * =========================================================
     */

    function dbToPercent(db) {

        if (!Number.isFinite(db)) {
            return 0;
        }

        if (db <= -60) {
            return 0;
        }

        if (db >= 0) {
            return 100;
        }

        return ((db + 60) / 60) * 100;
    }


    /*
     * =========================================================
     * AGGIORNA UN SINGOLO CANALE
     * =========================================================
     */

    function updateChannel(levelElement, valueElement, linearValue) {

        const db = linearToDb(linearValue);
        const percent = dbToPercent(db);


        levelElement.style.height = percent + "%";

        if (!Number.isFinite(db)) {

            valueElement.textContent = "-∞ dB";

        } else {

            valueElement.textContent = db.toFixed(1) + " dB";

        }

    }

    function updateMeter(levelElement, valueElement, value){
        
        if (!value) {return;}
        
        const db = ((parseInt("0x" + value) - 120)/2);
        const percent = dbToPercent(db);

        levelElement.style.height = percent + "%";

        if (!Number.isFinite(db)) {

            valueElement.textContent = "-∞ dB";

        } else {

            valueElement.textContent = db.toFixed(1) + " dB";

        }
    }

    /*
     * =========================================================
     * CONFIGURAZIONE DEI BUS
     * =========================================================
     */

    const buses = [

        "master",
        "busA",
        "busB",
        "busC",
        "busD"

    ];

    const inputChannels = [

        "ch1",
        "ch2",
        "ch3",
        "ch4",
        "ch5",
        "ch6",
        "ch7",
        "ch8"

    ]

    /*
     * =========================================================
     * AGGIORNAMENTO DI UN BUS
     * =========================================================
     */

    function updateBus(busName, data) {

        if (!data) {
            return;
        }

        const leftElement = document.getElementById(busName + "-left");
        const rightElement = document.getElementById(busName + "-right");
        const leftValueElement = document.getElementById(busName + "-left-value");
        const rightValueElement = document.getElementById(busName + "-right-value");


        if (!leftElement || !rightElement || !leftValueElement || !rightValueElement) {
            return;
        }

        updateChannel(leftElement, leftValueElement, data.left);

        updateChannel(rightElement, rightValueElement, data.right);


        /*
         * Gestione MUTE
         */

        const busElement = document.querySelector(`[data-bus="${busName}"]`);

        if (busElement) {

            busElement.classList.toggle("muted", data.muted === true);

        }

    }

    function updateInputChannel(channelName, data){

        const meterElement = document.getElementById(channelName + "-level");
        const meterValueElement = document.getElementById(channelName + "-value");

        if (!meterElement || !meterValueElement) {
            return;
        }
        
        updateMeter(meterElement, meterValueElement, data);

    }

    /*
     * =========================================================
     * RICEZIONE DATI DA ELECTRON
     * =========================================================
     */

    window.blast.onAudioLevels((levels) => {

        if (!levels) {
            return;
        }

        /*
         * Aggiorna tutti i bus
         */

        for (const bus of buses) {
            
            updateBus(bus, levels[bus]);

        }

        for (const input of inputChannels) {
          
            updateInputChannel(input, levels[input]);
        
        }

    });