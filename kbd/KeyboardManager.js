
const { uIOhook, UiohookKey } = require("uiohook-napi");


class KeyboardManager {

    constructor() {

        // Mappa:
        // "F1"       -> [callback, callback, ...]
        // "CTRL+F1"  -> [callback, callback, ...]
        this.callbacks = new Map();

        // Conversione keycode -> nome del tasto
        this.keyNames = {};

        Object.keys(UiohookKey).forEach(key => {

            const keyCode = UiohookKey[key];

            if (typeof keyCode === "number") {
                this.keyNames[keyCode] = key;
            }

        });

        this.started = false;
    }


    /**
     * Registra un callback per un hotkey.
     *
     * Esempi:
     *
     * keyboard.on("F1", callback);
     * keyboard.on("CTRL+F1", callback);
     * keyboard.on("SHIFT+F2", callback);
     * keyboard.on("CTRL+ALT+F1", callback);
     */
    on(hotkey, callback) {

        hotkey = this.normalizeHotkey(hotkey);

        if (typeof callback !== "function") {
            throw new TypeError("KeyboardManager: callback deve essere una funzione.");
        }

        if (!this.callbacks.has(hotkey)) {
            this.callbacks.set(hotkey, []);
        }

        this.callbacks.get(hotkey).push(callback);
    }


    /**
     * Rimuove tutti i callback associati a un hotkey.
     */
    off(hotkey) {

        hotkey = this.normalizeHotkey(hotkey);

        this.callbacks.delete(hotkey);
    }


    /**
     * Avvia il global keyboard hook.
     */
    start() {

        if (this.started) {
            return;
        }

        uIOhook.on("keydown", event => {

            const key = this.getKeyName(event);

            if (!key) {
                return;
            }

            const hotkey = this.getHotkey(event, key);

            const callbacks = this.callbacks.get(hotkey);

            if (!callbacks) {
                return;
            }

            callbacks.forEach(callback => {

                try {
                    callback(event);

                } catch (error) {

                    console.error(
                        `KeyboardManager: errore nel callback "${hotkey}":`,
                        error
                    );

                }

            });

        });


        uIOhook.start();

        this.started = true;

        console.log("Keyboard Manager started.");
    }


    /**
     * Arresta il global keyboard hook.
     */
    stop() {

        if (!this.started) {
            return;
        }

        uIOhook.stop();

        this.started = false;

        console.log("Keyboard Manager stopped.");
    }


    /**
     * Restituisce il nome del tasto partendo dal keycode.
     */
    getKeyName(event) {

        return this.keyNames[event.keycode] || null;
    }


    /**
     * Costruisce il nome dell'hotkey.
     *
     * Esempi:
     *
     * F1
     * CTRL+F1
     * SHIFT+F2
     * CTRL+ALT+F3
     */
    getHotkey(event, key) {

        const modifiers = [];

        if (event.ctrlKey) {
            modifiers.push("CTRL");
        }

        if (event.altKey) {
            modifiers.push("ALT");
        }

        if (event.shiftKey) {
            modifiers.push("SHIFT");
        }

        if (event.metaKey) {
            modifiers.push("META");
        }

        modifiers.push(key);

        return modifiers.join("+");
    }


    /**
     * Normalizza il nome di un hotkey.
     *
     * CTRL + F1
     * ctrl+f1
     * Ctrl+F1
     *
     * diventano:
     *
     * CTRL+F1
     */
    normalizeHotkey(hotkey) {

        if (typeof hotkey !== "string") {
            throw new TypeError("KeyboardManager: hotkey deve essere una stringa.");
        }

        return hotkey
            .toUpperCase()
            .replace(/\s+/g, "");
    }

}


module.exports = KeyboardManager;
