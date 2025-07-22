/*
 * PWA Controlador del Sensor CTIM3 por BLE de Huella Estructural y Symbiot Technologies
 * Archivo: js/ble-service.js
 * Descripción: Servicio BLE compatible con Firmware CTIM3 v2.3.016
 * Versión: 3.0.0
 * Compatible con: ESP32-S3-DEVKITC-1 (N8R8), ADXL355 Accelerometer
 * Fecha: 2025-07-22
 */

// ============================================================================
// CONFIGURACIÓN BLE - COMPATIBLE CON FIRMWARE v2.3.016
// ============================================================================

const BLE_CONFIG = {
    // UUIDs del servicio principal (compatibles con firmware_ctim3_ble_v3.cpp)
    SERVICE_UUID: '12345678-1234-5678-1234-56789abcdef0',
    
    // Características BLE según firmware v2.3.016
    CHARACTERISTICS: {
        CMD: '12345678-1234-5678-1234-56789abcdef1',      // Write - Comandos
        STATUS: '12345678-1234-5678-1234-56789abcdef2',   // Read/Notify - Estado
        DATA: '12345678-1234-5678-1234-56789abcdef3',     // Notify - Datos streaming
        CONFIG: '12345678-1234-5678-1234-56789abcdef4',   // Read/Write - Configuración
        INFO: '12345678-1234-5678-1234-56789abcdef5',     // Read - Información dispositivo
        PARAMS: '12345678-1234-5678-1234-56789abcdef6',   // Read/Write - Parámetros
        SYNC: '12345678-1234-5678-1234-56789abcdef7'      // Read - Sincronización
    },
    
    // Configuración del dispositivo
    DEVICE_NAME_PREFIX: 'HUELLA_',
    PIN_DEFAULT: '123456',
    MAX_PACKET_SIZE: 512,
    CONNECTION_TIMEOUT: 30000,
    AUTHENTICATION_TIMEOUT: 15000,
    
    // Factores de calibración ADXL355 (según firmware)
    CALIBRATION_FACTORS: {
        X: 3.814697266E-06,
        Y: 3.814697266E-06,
        Z: 3.814697266E-06
    }
};

// ============================================================================
// SERVICIO BLE PRINCIPAL
// ============================================================================

const BLEService = {
    // Estado del servicio
    isInitialized: false,
    isSupported: false,
    isConnected: false,
    isAuthenticated: false,
    isStreaming: false,
    
    // Objetos BLE
    device: null,
    server: null,
    service: null,
    characteristics: {},
    
    // Callbacks
    callbacks: {
        onConnectionChange: null,
        onAuthenticationChange: null,
        onStatusUpdate: null,
        onDataReceived: null,
        onError: null,
        onLog: null
    },
    
    // Datos de streaming
    streamingData: [],
    streamingCallback: null,
    lastDataTimestamp: 0,
    
    // ========================================================================
    // INICIALIZACIÓN
    // ========================================================================
    
    /**
     * Inicializar el servicio BLE
     * @param {Object} options - Opciones de configuración
     * @returns {boolean} True si se inicializó correctamente
     */
    init(options = {}) {
        try {
            this.log('Inicializando BLE Service v3.0...', 'info');
            
            // Configurar callbacks
            this.callbacks = { ...this.callbacks, ...options };
            
            // Verificar soporte Web Bluetooth
            if (!navigator.bluetooth) {
                this.log('Web Bluetooth no está soportado en este navegador', 'error');
                this.isSupported = false;
                return false;
            }
            
            // Verificar contexto seguro (HTTPS)
            if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
                this.log('Web Bluetooth requiere HTTPS o localhost', 'error');
                this.isSupported = false;
                return false;
            }
            
            this.isSupported = true;
            this.isInitialized = true;
            
            this.log('BLE Service inicializado correctamente', 'success');
            return true;
            
        } catch (error) {
            this.log(`Error inicializando BLE Service: ${error.message}`, 'error');
            return false;
        }
    },
    
    // ========================================================================
    // CONEXIÓN Y AUTENTICACIÓN
    // ========================================================================
    
    /**
     * Escanear y conectar a dispositivos HUELLA
     * @returns {Promise<boolean>}
     */
    async scanAndConnect() {
        if (!this.isSupported) {
            this.log('BLE no está soportado', 'error');
            return false;
        }
        
        try {
            this.log('Escaneando dispositivos HUELLA...', 'info');
            this.triggerCallback('onConnectionChange', 'scanning');
            
            // Configurar filtros para dispositivos HUELLA
            const options = {
                filters: [
                    { namePrefix: BLE_CONFIG.DEVICE_NAME_PREFIX },
                    { services: [BLE_CONFIG.SERVICE_UUID] }
                ],
                optionalServices: [BLE_CONFIG.SERVICE_UUID]
            };
            
            // Solicitar dispositivo
            this.device = await navigator.bluetooth.requestDevice(options);
            
            if (!this.device) {
                throw new Error('No se seleccionó ningún dispositivo');
            }
            
            this.log(`Dispositivo encontrado: ${this.device.name}`, 'success');
            
            // Configurar listeners de desconexión
            this.device.addEventListener('gattserverdisconnected', () => {
                this.handleDisconnection();
            });
            
            // Conectar al servidor GATT
            await this.connectToDevice();
            
            return true;
            
        } catch (error) {
            this.log(`Error en escaneo/conexión: ${error.message}`, 'error');
            this.triggerCallback('onError', { type: 'SCAN_ERROR', error });
            this.triggerCallback('onConnectionChange', 'disconnected');
            return false;
        }
    },
    
    /**
     * Conectar al dispositivo GATT
     * @private
     */
    async connectToDevice() {
        try {
            this.log('Conectando al servidor GATT...', 'info');
            this.triggerCallback('onConnectionChange', 'connecting');
            
            // Conectar al servidor GATT
            this.server = await this.device.gatt.connect();
            
            if (!this.server.connected) {
                throw new Error('No se pudo conectar al servidor GATT');
            }
            
            this.log('Conectado al servidor GATT', 'success');
            
            // Obtener servicio principal
            this.service = await this.server.getPrimaryService(BLE_CONFIG.SERVICE_UUID);
            
            if (!this.service) {
                throw new Error('Servicio HUELLA no encontrado');
            }
            
            this.log('Servicio HUELLA encontrado', 'success');
            
            // Obtener características
            await this.setupCharacteristics();
            
            this.isConnected = true;
            this.triggerCallback('onConnectionChange', 'connected');
            
            // Obtener información del dispositivo
            await this.getDeviceInfo();
            
        } catch (error) {
            this.log(`Error conectando al dispositivo: ${error.message}`, 'error');
            throw error;
        }
    },
    
    /**
     * Configurar características BLE
     * @private
     */
    async setupCharacteristics() {
        try {
            this.log('Configurando características BLE...', 'info');
            
            // Obtener todas las características necesarias
            const charPromises = Object.entries(BLE_CONFIG.CHARACTERISTICS).map(async ([name, uuid]) => {
                try {
                    const characteristic = await this.service.getCharacteristic(uuid);
                    this.characteristics[name.toLowerCase()] = characteristic;
                    this.log(`✓ Característica ${name} configurada`, 'info');
                    return { name, characteristic };
                } catch (error) {
                    this.log(`✗ Error obteniendo característica ${name}: ${error.message}`, 'warning');
                    return { name, characteristic: null };
                }
            });
            
            await Promise.all(charPromises);
            
            // Configurar notificaciones para STATUS y DATA
            if (this.characteristics.status) {
                await this.characteristics.status.startNotifications();
                this.characteristics.status.addEventListener('characteristicvaluechanged', (event) => {
                    this.handleStatusNotification(event);
                });
                this.log('✓ Notificaciones STATUS habilitadas', 'info');
            }
            
            if (this.characteristics.data) {
                await this.characteristics.data.startNotifications();
                this.characteristics.data.addEventListener('characteristicvaluechanged', (event) => {
                    this.handleDataNotification(event);
                });
                this.log('✓ Notificaciones DATA habilitadas', 'info');
            }
            
            this.log('Características BLE configuradas correctamente', 'success');
            
        } catch (error) {
            this.log(`Error configurando características: ${error.message}`, 'error');
            throw error;
        }
    },
    
    /**
     * Autenticar con PIN
     * @param {string} pin - PIN de 6 dígitos
     * @returns {Promise<boolean>}
     */
    async authenticate(pin = BLE_CONFIG.PIN_DEFAULT) {
        if (!this.isConnected) {
            this.log('Debe estar conectado para autenticar', 'error');
            return false;
        }
        
        try {
            this.log(`Autenticando con PIN: ${pin}`, 'info');
            this.triggerCallback('onAuthenticationChange', 'authenticating');
            
            const authCommand = {
                cmd: 'AUTH',
                pin: pin
            };
            
            const success = await this.sendCommand(authCommand);
            
            if (success) {
                // Esperar confirmación de autenticación via STATUS
                return await this.waitForAuthentication();
            }
            
            return false;
            
        } catch (error) {
            this.log(`Error en autenticación: ${error.message}`, 'error');
            this.triggerCallback('onError', { type: 'AUTH_ERROR', error });
            this.triggerCallback('onAuthenticationChange', 'failed');
            return false;
        }
    },
    
    /**
     * Esperar confirmación de autenticación
     * @private
     */
    async waitForAuthentication() {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.log('Timeout de autenticación', 'error');
                this.triggerCallback('onAuthenticationChange', 'timeout');
                resolve(false);
            }, BLE_CONFIG.AUTHENTICATION_TIMEOUT);
            
            const originalCallback = this.callbacks.onAuthenticationChange;
            this.callbacks.onAuthenticationChange = (status) => {
                if (status === 'authenticated') {
                    clearTimeout(timeout);
                    this.isAuthenticated = true;
                    this.log('Autenticación exitosa', 'success');
                    resolve(true);
                } else if (status === 'failed') {
                    clearTimeout(timeout);
                    this.log('Autenticación fallida', 'error');
                    resolve(false);
                }
                
                // Restaurar callback original
                if (originalCallback) {
                    originalCallback(status);
                }
            };
        });
    },
    
    // ========================================================================
    // ENVÍO DE COMANDOS
    // ========================================================================
    
    /**
     * Enviar comando al dispositivo
     * @param {Object} command - Comando a enviar
     * @returns {Promise<boolean>}
     */
    async sendCommand(command) {
        if (!this.characteristics.cmd) {
            this.log('Característica CMD no disponible', 'error');
            return false;
        }
        
        try {
            const jsonString = JSON.stringify(command);
            const encoder = new TextEncoder();
            const data = encoder.encode(jsonString);
            
            if (data.length > BLE_CONFIG.MAX_PACKET_SIZE) {
                this.log(`Comando demasiado grande: ${data.length} bytes`, 'error');
                return false;
            }
            
            await this.characteristics.cmd.writeValueWithResponse(data);
            this.log(`Comando enviado: ${jsonString}`, 'info');
            
            return true;
            
        } catch (error) {
            this.log(`Error enviando comando: ${error.message}`, 'error');
            this.triggerCallback('onError', { type: 'COMMAND_ERROR', error });
            return false;
        }
    },
    
    // ========================================================================
    // STREAMING DE DATOS
    // ========================================================================
    
    /**
     * Iniciar streaming de datos
     * @param {number} duration - Duración en segundos
     * @param {Function} callback - Callback para datos recibidos
     * @returns {Promise<boolean>}
     */
    async startStreaming(duration = 30, callback = null) {
        if (!this.isAuthenticated) {
            this.log('Debe estar autenticado para iniciar streaming', 'error');
            return false;
        }
        
        if (this.isStreaming) {
            this.log('Streaming ya está activo', 'warning');
            return false;
        }
        
        try {
            this.log(`Iniciando streaming por ${duration} segundos...`, 'info');
            
            // Configurar callback de datos
            this.streamingCallback = callback;
            this.streamingData = [];
            
            const streamCommand = {
                cmd: 'STREAM_START',
                duration: duration
            };
            
            const success = await this.sendCommand(streamCommand);
            
            if (success) {
                this.isStreaming = true;
                this.log('Streaming iniciado', 'success');
                
                // Auto-detener después de la duración + buffer
                setTimeout(() => {
                    if (this.isStreaming) {
                        this.stopStreaming();
                    }
                }, (duration + 5) * 1000);
                
                return true;
            }
            
            return false;
            
        } catch (error) {
            this.log(`Error iniciando streaming: ${error.message}`, 'error');
            this.triggerCallback('onError', { type: 'STREAMING_ERROR', error });
            return false;
        }
    },
    
    /**
     * Detener streaming de datos
     * @returns {Promise<boolean>}
     */
    async stopStreaming() {
        if (!this.isStreaming) {
            this.log('Streaming no está activo', 'warning');
            return false;
        }
        
        try {
            this.log('Deteniendo streaming...', 'info');
            
            const stopCommand = {
                cmd: 'STREAM_STOP'
            };
            
            const success = await this.sendCommand(stopCommand);
            
            this.isStreaming = false;
            this.streamingCallback = null;
            
            this.log(`Streaming detenido. ${this.streamingData.length} muestras recibidas`, 'success');
            
            return success;
            
        } catch (error) {
            this.log(`Error deteniendo streaming: ${error.message}`, 'error');
            this.triggerCallback('onError', { type: 'STREAMING_ERROR', error });
            return false;
        }
    },
    
    // ========================================================================
    // MANEJO DE DATOS Y NOTIFICACIONES
    // ========================================================================
    
    /**
     * Manejar notificaciones de estado
     * @private
     */
    handleStatusNotification(event) {
        try {
            const value = event.target.value;
            const decoder = new TextDecoder();
            const jsonString = decoder.decode(value);
            
            this.log(`STATUS recibido: ${jsonString}`, 'info');
            
            const statusData = JSON.parse(jsonString);
            
            // Procesar diferentes tipos de estado
            if (statusData.status === 'authenticated') {
                this.triggerCallback('onAuthenticationChange', 'authenticated');
            } else if (statusData.status === 'auth_failed') {
                this.triggerCallback('onAuthenticationChange', 'failed');
            } else if (statusData.status === 'streaming_started') {
                this.isStreaming = true;
            } else if (statusData.status === 'streaming_stopped') {
                this.isStreaming = false;
            }
            
            this.triggerCallback('onStatusUpdate', statusData);
            
        } catch (error) {
            this.log(`Error procesando STATUS: ${error.message}`, 'warning');
        }
    },
    
    /**
     * Manejar notificaciones de datos
     * @private
     */
    handleDataNotification(event) {
        try {
            const value = event.target.value;
            const decoder = new TextDecoder();
            const jsonString = decoder.decode(value);
            
            const rawData = JSON.parse(jsonString);
            
            // Convertir datos crudos a valores calibrados
            const calibratedData = {
                timestamp: Date.now(),
                x: rawData.x * BLE_CONFIG.CALIBRATION_FACTORS.X,
                y: rawData.y * BLE_CONFIG.CALIBRATION_FACTORS.Y,
                z: rawData.z * BLE_CONFIG.CALIBRATION_FACTORS.Z,
                temperature: rawData.temperature || 0,
                battery: rawData.battery || 0,
                raw: rawData
            };
            
            // Agregar a buffer de streaming
            this.streamingData.push(calibratedData);
            this.lastDataTimestamp = calibratedData.timestamp;
            
            // Llamar callback si está configurado
            if (this.streamingCallback) {
                this.streamingCallback(calibratedData);
            }
            
            this.triggerCallback('onDataReceived', calibratedData);
            
        } catch (error) {
            this.log(`Error procesando DATA: ${error.message}`, 'warning');
        }
    },
    
    // ========================================================================
    // INFORMACIÓN Y CONFIGURACIÓN
    // ========================================================================
    
    /**
     * Obtener información del dispositivo
     * @returns {Promise<Object|null>}
     */
    async getDeviceInfo() {
        if (!this.characteristics.info) {
            this.log('Característica INFO no disponible', 'error');
            return null;
        }
        
        try {
            const value = await this.characteristics.info.readValue();
            const decoder = new TextDecoder();
            const jsonString = decoder.decode(value);
            const deviceInfo = JSON.parse(jsonString);
            
            this.log(`Información del dispositivo: ${jsonString}`, 'info');
            
            return deviceInfo;
            
        } catch (error) {
            this.log(`Error obteniendo información: ${error.message}`, 'error');
            return null;
        }
    },
    
    /**
     * Obtener configuración del dispositivo
     * @returns {Promise<Object|null>}
     */
    async getConfiguration() {
        if (!this.characteristics.config) {
            this.log('Característica CONFIG no disponible', 'error');
            return null;
        }
        
        try {
            const value = await this.characteristics.config.readValue();
            const decoder = new TextDecoder();
            const jsonString = decoder.decode(value);
            const config = JSON.parse(jsonString);
            
            this.log(`Configuración del dispositivo: ${jsonString}`, 'info');
            
            return config;
            
        } catch (error) {
            this.log(`Error obteniendo configuración: ${error.message}`, 'error');
            return null;
        }
    },
    
    /**
     * Establecer configuración del dispositivo
     * @param {Object} config - Nueva configuración
     * @returns {Promise<boolean>}
     */
    async setConfiguration(config) {
        if (!this.characteristics.config) {
            this.log('Característica CONFIG no disponible', 'error');
            return false;
        }
        
        try {
            const jsonString = JSON.stringify(config);
            const encoder = new TextEncoder();
            const data = encoder.encode(jsonString);
            
            if (data.length > BLE_CONFIG.MAX_PACKET_SIZE) {
                this.log(`Configuración demasiado grande: ${data.length} bytes`, 'error');
                return false;
            }
            
            await this.characteristics.config.writeValueWithResponse(data);
            this.log(`Configuración establecida: ${jsonString}`, 'success');
            
            return true;
            
        } catch (error) {
            this.log(`Error estableciendo configuración: ${error.message}`, 'error');
            return false;
        }
    },
    
    // ========================================================================
    // DESCONEXIÓN Y LIMPIEZA
    // ========================================================================
    
    /**
     * Desconectar del dispositivo
     * @returns {Promise<boolean>}
     */
    async disconnect() {
        try {
            this.log('Desconectando del dispositivo...', 'info');
            
            // Detener streaming si está activo
            if (this.isStreaming) {
                await this.stopStreaming();
            }
            
            // Desconectar del servidor GATT
            if (this.server && this.server.connected) {
                this.server.disconnect();
            }
            
            this.handleDisconnection();
            
            return true;
            
        } catch (error) {
            this.log(`Error desconectando: ${error.message}`, 'error');
            return false;
        }
    },
    
    /**
     * Manejar desconexión
     * @private
     */
    handleDisconnection() {
        this.log('Dispositivo desconectado', 'warning');
        
        // Resetear estado
        this.isConnected = false;
        this.isAuthenticated = false;
        this.isStreaming = false;
        this.device = null;
        this.server = null;
        this.service = null;
        this.characteristics = {};
        this.streamingCallback = null;
        
        this.triggerCallback('onConnectionChange', 'disconnected');
    },
    
    // ========================================================================
    // UTILIDADES
    // ========================================================================
    
    /**
     * Disparar callback si está definido
     * @private
     */
    triggerCallback(callbackName, data) {
        if (this.callbacks[callbackName] && typeof this.callbacks[callbackName] === 'function') {
            try {
                this.callbacks[callbackName](data);
            } catch (error) {
                console.error(`Error en callback ${callbackName}:`, error);
            }
        }
    },
    
    /**
     * Registrar mensaje de log
     * @private
     */
    log(message, level = 'info') {
        const timestamp = new Date().toISOString().substring(11, 23);
        const logMessage = `[${timestamp}] [BLE] ${message}`;
        
        switch (level) {
            case 'error':
                console.error(logMessage);
                break;
            case 'warning':
                console.warn(logMessage);
                break;
            case 'success':
                console.log(`%c${logMessage}`, 'color: green');
                break;
            default:
                console.log(logMessage);
        }
        
        // Disparar callback de log si está configurado
        this.triggerCallback('onLog', { message, level, timestamp });
    },
    
    /**
     * Obtener estado actual del servicio
     * @returns {Object}
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isSupported: this.isSupported,
            isConnected: this.isConnected,
            isAuthenticated: this.isAuthenticated,
            isStreaming: this.isStreaming,
            deviceName: this.device?.name || null,
            samplesReceived: this.streamingData.length,
            lastDataTimestamp: this.lastDataTimestamp
        };
    },
    
    /**
     * Obtener datos de streaming
     * @returns {Array}
     */
    getStreamingData() {
        return [...this.streamingData];
    },
    
    /**
     * Limpiar datos de streaming
     */
    clearStreamingData() {
        this.streamingData = [];
        this.lastDataTimestamp = 0;
        this.log('Datos de streaming limpiados', 'info');
    }
};

// ============================================================================
// COMANDOS PREDEFINIDOS PARA FIRMWARE v2.3.016
// ============================================================================

const BLE_COMMANDS = {
    // Comandos de control
    START: { cmd: 'START' },
    STOP: { cmd: 'STOP' },
    STANDBY: { cmd: 'STANDBY' },
    RESTART: { cmd: 'RESTART' },
    CONTINUE: { cmd: 'CONTINUE' },
    
    // Comandos de información
    GET_INFO: { cmd: 'GET_INFO' },
    GET_CONFIG: { cmd: 'GET_CONFIG' },
    
    // Función helper para crear comando de autenticación
    auth: (pin) => ({ cmd: 'AUTH', pin }),
    
    // Función helper para crear comando de streaming
    stream: (duration) => ({ cmd: 'STREAM_START', duration }),
    
    // Función helper para crear comando de configuración
    setConfig: (config) => ({ cmd: 'SET_CONFIG', config })
};

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.BLEService = BLEService;
    window.BLE_CONFIG = BLE_CONFIG;
    window.BLE_COMMANDS = BLE_COMMANDS;
}

console.log('BLE Service v3.0 cargado - Compatible con Firmware CTIM3 v2.3.016');
