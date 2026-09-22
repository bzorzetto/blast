
import { EventEmitter } from "node:events";


class Monitor extends EventEmitter {

    constructor() {
        super();

        /*
         * Struttura interna:
         *
         * {
         *     bose: {
         *         input1: {
         *             name: "Bose Input 1",
         *             value: -18.4,
         *             unit: "dB",
         *             min: -60,
         *             max: 0
         *         }
         *     },
         *
         *     vmix: {
         *         input1: {
         *             name: "vMix Input 1",
         *             value: -12.7,
         *             unit: "dB",
         *             min: -60,
         *             max: 0
         *         }
         *     }
         * }
         */

        this.sources = {};
    }


    /**
     * Registra una grandezza monitorata.
     *
     * @param {string} source
     * @param {string|number} id
     * @param {object} config
     *
     * config:
     * {
     *     name: "Bose Input 1",
     *     unit: "dB",
     *     min: -60,
     *     max: 0
     * }
     */
    register(source, id, config = {}) {

        if (!source) {
            throw new Error("Monitor.register(): source non specificato");
        }

        if (id === undefined || id === null) {
            throw new Error("Monitor.register(): id non specificato");
        }

        id = String(id);

        if (!this.sources[source]) {
            this.sources[source] = {};
        }

        const existing = this.sources[source][id];

        this.sources[source][id] = {
            name: config.name ?? id,
            value: existing?.value ?? null,
            unit: config.unit ?? "",
            min: config.min ?? null,
            max: config.max ?? null
        };

        this.emit("register", {
            source,
            id,
            ...this.sources[source][id]
        });
    }


    /**
     * Aggiorna il valore di una grandezza.
     *
     * @param {string} source
     * @param {string|number} id
     * @param {number} value
     */
    update(source, id, value) {

        if (!source) {
            throw new Error("Monitor.update(): source non specificato");
        }

        if (id === undefined || id === null) {
            throw new Error("Monitor.update(): id non specificato");
        }

        if (typeof value !== "number" || Number.isNaN(value)) {
            throw new Error("Monitor.update(): value non valido");
        }

        id = String(id);

        if (!this.sources[source] || !this.sources[source][id]) {
            throw new Error(
                `Monitor.update(): grandezza non registrata: ${source}/${id}`
            );
        }

        const measurement = this.sources[source][id];

        if (measurement.value === value) {
            return;
        }

        measurement.value = value;

        this.emit("update", {
            source,
            id,
            ...measurement
        });
    }


    /**
     * Restituisce una grandezza.
     */
    get(source, id) {

        id = String(id);

        if (!this.sources[source]) {
            return null;
        }

        return this.sources[source][id] || null;
    }


    /**
     * Restituisce tutte le grandezze di una sorgente.
     */
    getSource(source) {

        return this.sources[source] || {};
    }


    /**
     * Restituisce tutto lo stato del monitor.
     */
    getAll() {

        return this.sources;
    }


    /**
     * Rimuove una grandezza.
     */
    unregister(source, id) {

        id = String(id);

        if (
            this.sources[source] &&
            this.sources[source][id]
        ) {
            delete this.sources[source][id];

            this.emit("unregister", {
                source,
                id
            });
        }
    }


    /**
     * Rimuove una sorgente completa.
     */
    removeSource(source) {

        if (this.sources[source]) {
            delete this.sources[source];

            this.emit("sourceRemoved", source);
        }
    }


    /**
     * Cancella tutto il monitor.
     */
    clear() {

        this.sources = {};

        this.emit("clear");
    }
}


export default Monitor;
