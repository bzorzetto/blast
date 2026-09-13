
import WebSocket from 'ws';

export default class HomeAssistantClient {

    constructor(options = {}) {

        this.url = options.url;
        this.token = options.token;

        if (!this.url) {
            throw new Error('Home Assistant URL non specificato');
        }

        if (!this.token) {
            throw new Error('Home Assistant token non specificato');
        }

        // Converte http:// in ws:// e https:// in wss://
        this.wsUrl = this.url
            .replace(/^http:/, 'ws:')
            .replace(/^https:/, 'wss:')
            .replace(/\/$/, '') + '/api/websocket';

        this.ws = null;

        this.messageId = 1;

        this.connected = false;
        this.authenticated = false;
        this.eventSubscriptionId = null;

        this.reconnectDelay = options.reconnectDelay ?? 3000;
        this.maxReconnectDelay = options.maxReconnectDelay ?? 30000;

        this.currentReconnectDelay = this.reconnectDelay;

        this.reconnectTimer = null;
        this.manualDisconnect = false;

        // Callback generici
        this.callbacks = {
            connected: [],
            disconnected: [],
            error: [],
            event: []
        };

        this.authResolve = null;
        this.authReject = null;
        
        // Callback per entity_id
        this.entityCallbacks = new Map();

        // Promise in attesa di risposta da Home Assistant
        this.pendingCommands = new Map();
    }


    // ============================================================
    // CONNECT
    // ============================================================

    connect() {

        return new Promise((resolve, reject) => {

            if (this.ws &&
                (this.ws.readyState === WebSocket.OPEN ||
                 this.ws.readyState === WebSocket.CONNECTING)) {

                resolve();
                return;
            }

            this.manualDisconnect = false;

            console.log(`Connessione a Home Assistant: ${this.wsUrl}`);

            this.ws = new WebSocket(this.wsUrl);


            this.ws.on('open', () => {

                console.log('WebSocket Home Assistant connesso');

                this.connected = true;

                this.currentReconnectDelay = this.reconnectDelay;

                this.emit('connected');

                resolve();
            });


            this.ws.on('message', (data) => {

                try {

                    const message = JSON.parse(data.toString());

                    this.handleMessage(message);

                } catch (error) {

                    console.error(
                        'Errore parsing messaggio Home Assistant:',
                        error
                    );

                    this.emit('error', error);
                }
            });


            this.ws.on('close', () => {

                const wasConnected = this.connected;

                this.connected = false;
                this.authenticated = false;
                this.eventSubscriptionId = null;

                console.log('WebSocket Home Assistant disconnesso');

                if (wasConnected) {
                    this.emit('disconnected');
                }

                if (!this.manualDisconnect) {
                    this.scheduleReconnect();
                }
            });


            this.ws.on('error', (error) => {

                console.error(
                    'Errore WebSocket Home Assistant:',
                    error.message
                );

                this.emit('error', error);

                /*
                 * L'evento close verrà normalmente generato
                 * subito dopo l'error e sarà lui a gestire
                 * la riconnessione.
                 */
            });

        });
    }


    // ============================================================
    // DISCONNECT
    // ============================================================

    disconnect() {

        this.manualDisconnect = true;

        if (this.reconnectTimer) {

            clearTimeout(this.reconnectTimer);

            this.reconnectTimer = null;
        }

        if (this.ws) {

            this.ws.close();

            this.ws = null;
        }

        this.connected = false;
        this.authenticated = false;
    }


    // ============================================================
    // AUTHENTICATION
    // ============================================================

    //async authenticate() {

    //    const response = await this.sendCommand({

    //        type: 'auth',
    //        access_token: this.token

    //    }, false);

    //    if (!response) {
    //        throw new Error('Autenticazione Home Assistant fallita');
    //    }

    //    this.authenticated = true;

    //    console.log('Autenticazione Home Assistant OK');
    //}

    async authenticate() {

        if (!this.ws ||
            this.ws.readyState !== WebSocket.OPEN) {

            throw new Error(
                'WebSocket Home Assistant non connesso'
            );
        }

        return new Promise((resolve, reject) => {

            this.authResolve = resolve;
            this.authReject = reject;

            const message = {
                type: 'auth',
                access_token: this.token
            };

            console.log('Autenticazione Home Assistant...');

            this.ws.send(
                JSON.stringify(message)
            );
        });
    }
    // ============================================================
    // SUBSCRIBE EVENTS
    // ============================================================

    async subscribeEvents(eventType = 'state_changed') {

        if (!this.authenticated) {
            throw new Error(
                'Devi autenticarti prima di sottoscrivere gli eventi'
            );
        }

        const id = this.getNextId();

        this.eventSubscriptionId = id;

        return this.sendCommand({

            id,
            type: 'subscribe_events',
            event_type: eventType

        }, true, id);
    }


    // ============================================================
    // HANDLE MESSAGE
    // ============================================================

    handleMessage(message) {

        /*
         * Primo messaggio inviato da HA:
         *
         * {
         *   "type": "auth_required",
         *   ...
         * }
         */

        if (message.type === 'auth_required') {

            this.authenticate()
                .then(() => this.subscribeEvents())
                .catch(error => {

                    console.error(
                        'Errore autenticazione:',
                        error
                    );

                    this.emit('error', error);
                });

            return;
        }


        // --------------------------------------------------------
        // Auth OK
        // --------------------------------------------------------

        //if (message.type === 'auth_ok') {

        //    this.authenticated = true;

        //    console.log('Home Assistant: auth_ok');

        //    return;
        //}

        if (message.type === 'auth_ok') {

            this.authenticated = true;

            console.log('Home Assistant: auth_ok');

            if (this.authResolve) {
                this.authResolve();
                this.authResolve = null;
                this.authReject = null;
            }

            return;
        }

        // --------------------------------------------------------
        // Auth invalid
        // --------------------------------------------------------

        //if (message.type === 'auth_invalid') {

        //    const error = new Error(
        //        `Autenticazione HA fallita: ${message.message}`
        //    );

        //    this.emit('error', error);

        //    return;
        //}

        if (message.type === 'auth_invalid') {

            const error = new Error(
                `Autenticazione HA fallita: ${message.message}`
            );

            if (this.authReject) {
                this.authReject(error);
                this.authResolve = null;
                this.authReject = null;
            }

            this.emit('error', error);

            return;
        }

        // --------------------------------------------------------
        // Eventi
        // --------------------------------------------------------

        if (message.type === 'event') {

            this.handleEvent(message);

            return;
        }


        // --------------------------------------------------------
        // Risposte ai comandi
        // --------------------------------------------------------

        if (message.type === 'result') {

            this.handleResult(message);

            return;
        }
    }


    // ============================================================
    // HANDLE EVENT
    // ============================================================

    handleEvent(message) {

        const event = message.event;

        if (!event) {
            return;
        }

        /*
         * Callback generico
         */
        this.emit('event', event);


        /*
         * Callback specifico per state_changed
         */
        if (event.event_type === 'state_changed') {

            const entityId =
                event.data?.entity_id;

            if (!entityId) {
                return;
            }

            const callbacks =
                this.entityCallbacks.get(entityId);

            if (!callbacks) {
                return;
            }

            for (const callback of callbacks) {

                try {

                    callback(
                        event.data.new_state,
                        event.data.old_state,
                        event
                    );

                } catch (error) {

                    console.error(
                        `Errore callback ${entityId}:`,
                        error
                    );
                }
            }
        }
    }


    // ============================================================
    // HANDLE RESULT
    // ============================================================

    handleResult(message) {

        const pending =
            this.pendingCommands.get(message.id);

        if (!pending) {
            return;
        }

        this.pendingCommands.delete(message.id);

        clearTimeout(pending.timeout);

        if (message.success) {

            pending.resolve(message.result);

        } else {

            pending.reject(
                new Error(
                    message.error?.message ||
                    'Errore Home Assistant'
                )
            );
        }
    }


    // ============================================================
    // SEND COMMAND
    // ============================================================

    sendCommand(command, waitForResult = true, forcedId = null) {

        return new Promise((resolve, reject) => {

            if (!this.ws ||
                this.ws.readyState !== WebSocket.OPEN) {

                reject(
                    new Error(
                        'WebSocket Home Assistant non connesso'
                    )
                );

                return;
            }


            const id =
                forcedId ?? this.getNextId();

            command.id = id;


            if (!waitForResult) {

                this.ws.send(
                    JSON.stringify(command)
                );

                resolve();

                return;
            }


            const timeout = setTimeout(() => {

                this.pendingCommands.delete(id);

                reject(
                    new Error(
                        `Timeout comando Home Assistant (${id})`
                    )
                );

            }, 10000);


            this.pendingCommands.set(id, {
                resolve,
                reject,
                timeout
            });


            this.ws.send(
                JSON.stringify(command)
            );
        });
    }


    // ============================================================
    // GET STATE
    // ============================================================

    async getState(entityId) {

        return this.sendCommand({

            type: 'get_states'

        }).then(states => {

            if (!entityId) {
                return states;
            }

            return states.find(
                state => state.entity_id === entityId
            );
        });
    }


    // ============================================================
    // CALL SERVICE
    // ============================================================

    async callService(
        domain,
        service,
        serviceData = {}
    ) {

        return this.sendCommand({

            type: 'call_service',

            domain,
            service,

            service_data: serviceData

        });
    }


    // ============================================================
    // CALLBACK ENTITY
    // ============================================================

    onStateChanged(entityId, callback) {

        if (!this.entityCallbacks.has(entityId)) {

            this.entityCallbacks.set(
                entityId,
                new Set()
            );
        }

        this.entityCallbacks
            .get(entityId)
            .add(callback);


        /*
         * Restituiamo una funzione per
         * rimuovere facilmente il callback.
         */

        return () => {

            const callbacks =
                this.entityCallbacks.get(entityId);

            if (!callbacks) {
                return;
            }

            callbacks.delete(callback);

            if (callbacks.size === 0) {

                this.entityCallbacks.delete(entityId);
            }
        };
    }


    // ============================================================
    // GENERIC CALLBACKS
    // ============================================================

    on(type, callback) {

        if (!this.callbacks[type]) {

            throw new Error(
                `Evento non supportato: ${type}`
            );
        }

        this.callbacks[type].push(callback);


        return () => {

            this.off(type, callback);

        };
    }


    off(type, callback) {

        if (!this.callbacks[type]) {
            return;
        }

        this.callbacks[type] =
            this.callbacks[type]
                .filter(cb => cb !== callback);
    }


    emit(type, ...args) {

        if (!this.callbacks[type]) {
            return;
        }

        for (const callback of this.callbacks[type]) {

            try {

                callback(...args);

            } catch (error) {

                console.error(
                    `Errore callback ${type}:`,
                    error
                );
            }
        }
    }


    // ============================================================
    // RECONNECT
    // ============================================================

    scheduleReconnect() {

        if (this.manualDisconnect) {
            return;
        }

        if (this.reconnectTimer) {
            return;
        }

        console.log(
            `Nuovo tentativo tra ` +
            `${this.currentReconnectDelay / 1000}s`
        );


        this.reconnectTimer = setTimeout(
            async () => {

                this.reconnectTimer = null;

                try {

                    await this.connect();

                } catch (error) {

                    console.error(
                        'Riconnessione fallita:',
                        error.message
                    );

                    this.scheduleReconnect();
                }

            },
            this.currentReconnectDelay
        );


        /*
         * Exponential backoff:
         *
         * 3s
         * 6s
         * 12s
         * 24s
         * 30s
         */

        this.currentReconnectDelay =
            Math.min(
                this.currentReconnectDelay * 2,
                this.maxReconnectDelay
            );
    }


    // ============================================================
    // ID
    // ============================================================

    getNextId() {

        return this.messageId++;
    }
}

