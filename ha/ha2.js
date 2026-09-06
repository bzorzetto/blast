const http = require('http');
const https = require('https');
const EventEmitter = require('events');

class HomeAssistantClient extends EventEmitter {

    constructor(host, port = 8123, apiToken, options = {}) {

        super();

        this.host = host;
        this.port = port;
        this.token = apiToken;

        this.protocol = options.protocol || 'http';
        this.debug = options.debug || false;

        this.connected = false;
    }


    /**
     * Esegue una richiesta HTTP/HTTPS verso Home Assistant
     *
     * @param {string} path
     * @param {string} method
     * @param {object|null} body
     * @returns {Promise<object>}
     */
    async request(path, method = 'GET', body = null) {

        return new Promise((resolve, reject) => {

            const data = body ? JSON.stringify(body) : null;

            const options = {
                hostname: this.host,
                port: this.port,
                path: path,
                method: method,

                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            };


            if (data) {
                options.headers['Content-Length'] =
                    Buffer.byteLength(data);
            }


            if (this.debug) {
                console.log(
                    `[HomeAssistant] ${method} ${this.protocol}://${this.host}:${this.port}${path}`
                );
            }


            // Seleziona HTTP oppure HTTPS
            const client = this.protocol === 'https'
                ? https
                : http;


            const req = client.request(options, res => {

                let response = '';


                res.on('data', chunk => {
                    response += chunk;
                });


                res.on('end', () => {

                    if (this.debug) {
                        console.log(
                            `[HomeAssistant] Response ${res.statusCode}:`,
                            response
                        );
                    }


                    // Home Assistant può restituire anche risposte
                    // che non sono JSON
                    let parsedResponse;

                    try {
                        parsedResponse = response
                            ? JSON.parse(response)
                            : null;
                    }
                    catch (error) {
                        parsedResponse = response;
                    }


                    // HTTP error
                    if (res.statusCode < 200 || res.statusCode >= 300) {

                        const error = new Error(
                            `Home Assistant HTTP error ${res.statusCode}`
                        );

                        error.statusCode = res.statusCode;
                        error.response = parsedResponse;

                        reject(error);

                        return;
                    }


                    this.connected = true;

                    resolve(parsedResponse);
                });
            });


            req.on('error', error => {

                this.connected = false;

                if (this.debug) {
                    console.error(
                        '[HomeAssistant] Connection error:',
                        error
                    );
                }

                reject(error);
            });


            // Scrive il body solo se presente
            if (data) {
                req.write(data);
            }


            req.end();
        });
    }


    /**
     * Comando generico verso l'API REST di Home Assistant
     *
     * Esempio:
     *
     * await client.sendCommand('states');
     */
    async sendCommand(command) {

        return await this.request(
            `/api/${command}`,
            'GET'
        );
    }


    /**
     * Verifica la connessione con Home Assistant
     *
     * GET /api/
     */
    async ping() {

        try {

            const response = await this.request(
                '/api/',
                'GET'
            );


            if (!this.connected) {
                this.connected = true;
                this.emit('connected');
            }


            return response;
        }
        catch (error) {

            this.connected = false;

            this.emit('disconnected', error);

            throw error;
        }
    }


    /**
     * Restituisce lo stato di una specifica entità
     *
     * Esempio:
     *
     * await client.getState('light.soggiorno');
     *
     * Restituisce:
     *
     * {
     *     entity_id: 'light.soggiorno',
     *     state: 'on',
     *     attributes: {...},
     *     ...
     * }
     */
    async getState(entityId) {

        if (!entityId) {
            throw new Error(
                'entityId is required'
            );
        }


        return await this.request(
            `/api/states/${encodeURIComponent(entityId)}`,
            'GET'
        );
    }


    /**
     * Restituisce tutti gli stati presenti in Home Assistant
     *
     * GET /api/states
     */
    async getStates() {

        return await this.request(
            '/api/states',
            'GET'
        );
    }


    /**
     * Chiama un servizio di Home Assistant
     *
     * Esempio:
     *
     * await client.callService(
     *     'light',
     *     'turn_on',
     *     {
     *         entity_id: 'light.soggiorno'
     *     }
     * );
     */
    async callService(domain, service, data = {}) {

        if (!domain) {
            throw new Error(
                'domain is required'
            );
        }


        if (!service) {
            throw new Error(
                'service is required'
            );
        }


        return await this.request(
            `/api/services/${domain}/${service}`,
            'POST',
            data
        );
    }


    /**
     * Imposta il debug
     */
    setDebug(enabled) {

        this.debug = Boolean(enabled);

    }


    /**
     * Restituisce lo stato della connessione
     */
    isConnected() {

        return this.connected;

    }
}


module.exports = HomeAssistantClient;

