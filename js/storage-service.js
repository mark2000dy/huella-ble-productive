/*
 * PWA Controlador del Sensor CTIM3 por BLE de Huella Estructural y Symbiot Technologies
 * Archivo: js/storage-service.js
 * Descripción: Servicio de almacenamiento offline con IndexedDB y localStorage
 * Versión: 3.0.0
 * Compatible con: Firmware CTIM3 v2.3.016, Azure Web Apps
 * Fecha: 2025-07-22
 */

// ============================================================================
// SERVICIO DE ALMACENAMIENTO
// ============================================================================

const StorageService = {
    // Configuración de la base de datos
    dbName: 'HuellaBLE_DB',
    dbVersion: 3,
    db: null,
    isInitialized: false,
    
    // Object stores
    stores: {
        devices: 'devices',
        streamingData: 'streaming_data',
        configurations: 'configurations',
        logs: 'logs',
        sessions: 'sessions'
    },
    
    // Configuración de almacenamiento
    config: {
        maxStreamingRecords: 10000,
        maxLogEntries: 5000,
        maxSessions: 100,
        dataRetentionDays: 30,
        compressionEnabled: true
    },
    
    // ========================================================================
    // INICIALIZACIÓN
    // ========================================================================
    
    /**
     * Inicializar el servicio de almacenamiento
     * @returns {Promise<boolean>}
     */
    async init() {
        try {
            console.log('Inicializando Storage Service v3.0...');
            
            if (!this.isIndexedDBSupported()) {
                throw new Error('IndexedDB no está soportado en este navegador');
            }
            
            await this.openDatabase();
            await this.performMaintenance();
            
            this.isInitialized = true;
            console.log('Storage Service inicializado correctamente');
            return true;
            
        } catch (error) {
            console.error('Error inicializando Storage Service:', error);
            return false;
        }
    },
    
    /**
     * Verificar soporte de IndexedDB
     * @private
     */
    isIndexedDBSupported() {
        return 'indexedDB' in window;
    },
    
    /**
     * Abrir base de datos IndexedDB
     * @private
     */
    async openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                reject(new Error('Error abriendo base de datos: ' + request.error));
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('Base de datos abierta correctamente');
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.createObjectStores(db);
            };
        });
    },
    
    /**
     * Crear object stores
     * @private
     */
    createObjectStores(db) {
        console.log('Creando/actualizando object stores...');
        
        // Store para dispositivos recientes
        if (!db.objectStoreNames.contains(this.stores.devices)) {
            const devicesStore = db.createObjectStore(this.stores.devices, {
                keyPath: 'id',
                autoIncrement: false
            });
            devicesStore.createIndex('name', 'name', { unique: false });
            devicesStore.createIndex('lastConnected', 'lastConnected', { unique: false });
            console.log('✓ Object store "devices" creado');
        }
        
        // Store para datos de streaming
        if (!db.objectStoreNames.contains(this.stores.streamingData)) {
            const streamingStore = db.createObjectStore(this.stores.streamingData, {
                keyPath: 'id',
                autoIncrement: true
            });
            streamingStore.createIndex('sessionId', 'sessionId', { unique: false });
            streamingStore.createIndex('timestamp', 'timestamp', { unique: false });
            streamingStore.createIndex('deviceId', 'deviceId', { unique: false });
            console.log('✓ Object store "streaming_data" creado');
        }
        
        // Store para configuraciones
        if (!db.objectStoreNames.contains(this.stores.configurations)) {
            const configStore = db.createObjectStore(this.stores.configurations, {
                keyPath: 'id',
                autoIncrement: false
            });
            configStore.createIndex('deviceId', 'deviceId', { unique: false });
            configStore.createIndex('timestamp', 'timestamp', { unique: false });
            console.log('✓ Object store "configurations" creado');
        }
        
        // Store para logs
        if (!db.objectStoreNames.contains(this.stores.logs)) {
            const logsStore = db.createObjectStore(this.stores.logs, {
                keyPath: 'id',
                autoIncrement: true
            });
            logsStore.createIndex('level', 'level', { unique: false });
            logsStore.createIndex('timestamp', 'timestamp', { unique: false });
            logsStore.createIndex('source', 'source', { unique: false });
            console.log('✓ Object store "logs" creado');
        }
        
        // Store para sesiones
        if (!db.objectStoreNames.contains(this.stores.sessions)) {
            const sessionsStore = db.createObjectStore(this.stores.sessions, {
                keyPath: 'id',
                autoIncrement: false
            });
            sessionsStore.createIndex('deviceId', 'deviceId', { unique: false });
            sessionsStore.createIndex('startTime', 'startTime', { unique: false });
            sessionsStore.createIndex('endTime', 'endTime', { unique: false });
            console.log('✓ Object store "sessions" creado');
        }
    },
    
    // ========================================================================
    // GESTIÓN DE DISPOSITIVOS
    // ========================================================================
    
    /**
     * Guardar información de dispositivo
     * @param {Object} deviceInfo - Información del dispositivo
     * @returns {Promise<boolean>}
     */
    async saveDevice(deviceInfo) {
        if (!this.isInitialized) {
            console.error('Storage Service no está inicializado');
            return false;
        }
        
        try {
            const transaction = this.db.transaction([this.stores.devices], 'readwrite');
            const store = transaction.objectStore(this.stores.devices);
            
            const deviceRecord = {
                id: deviceInfo.id || deviceInfo.name || Date.now().toString(),
                name: deviceInfo.name,
                address: deviceInfo.address,
                firmware: deviceInfo.firmware,
                hardware: deviceInfo.hardware,
                lastConnected: new Date().toISOString(),
                connectionCount: (deviceInfo.connectionCount || 0) + 1,
                ...deviceInfo
            };
            
            await this.promisifyRequest(store.put(deviceRecord));
            console.log(`Dispositivo guardado: ${deviceRecord.name}`);
            return true;
            
        } catch (error) {
            console.error('Error guardando dispositivo:', error);
            return false;
        }
    },
    
    /**
     * Obtener dispositivos recientes
     * @param {number} limit - Límite de dispositivos a obtener
     * @returns {Promise<Array>}
     */
    async getRecentDevices(limit = 10) {
        if (!this.isInitialized) {
            console.error('Storage Service no está inicializado');
            return [];
        }
        
        try {
            const transaction = this.db.transaction([this.stores.devices], 'readonly');
            const store = transaction.objectStore(this.stores.devices);
            const index = store.index('lastConnected');
            
            const devices = [];
            const request = index.openCursor(null, 'prev');
            
            return new Promise((resolve, reject) => {
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor && devices.length < limit) {
                        devices.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(devices);
                    }
                };
                
                request.onerror = () => {
                    reject(new Error('Error obteniendo dispositivos recientes'));
                };
            });
            
        } catch (error) {
            console.error('Error obteniendo dispositivos recientes:', error);
            return [];
        }
    },
    
    /**
     * Eliminar dispositivo
     * @param {string} deviceId - ID del dispositivo
     * @returns {Promise<boolean>}
     */
    async deleteDevice(deviceId) {
        if (!this.isInitialized) {
            console.error('Storage Service no está inicializado');
            return false;
        }
        
        try {
            const transaction = this.db.transaction([this.stores.devices], 'readwrite');
            const store = transaction.objectStore(this.stores.devices);
            
            await this.promisifyRequest(store.delete(deviceId));
            console.log(`Dispositivo eliminado: ${deviceId}`);
            return true;
            
        } catch (error) {
            console.error('Error eliminando dispositivo:', error);
            return false;
        }
    },
    
    // ========================================================================
    // GESTIÓN DE DATOS DE STREAMING
    // ========================================================================
    
    /**
     * Iniciar sesión de streaming
     * @param {string} deviceId - ID del dispositivo
     * @param {Object} metadata - Metadatos de la sesión
     * @returns {Promise<string>} Session ID
     */
    async startStreamingSession(deviceId, metadata = {}) {
        if (!this.isInitialized) {
            console.error('Storage Service no está inicializado');
            return null;
        }
        
        try {
            const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const sessionRecord = {
                id: sessionId,
                deviceId: deviceId,
                startTime: new Date().toISOString(),
                endTime: null,
                status: 'active',
                sampleCount: 0,
                duration: 0,
                metadata: metadata
            };
            
            const transaction = this.db.transaction([this.stores.sessions], 'readwrite');
            const store = transaction.objectStore(this.stores.sessions);
            
            await this.promisifyRequest(store.put(sessionRecord));
            console.log(`Sesión de streaming iniciada: ${sessionId}`);
            return sessionId;
            
        } catch (error) {
            console.error('Error iniciando sesión de streaming:', error);
            return null;
        }
    },
    
    /**
     * Guardar datos de streaming por lotes
     * @param {string} sessionId - ID de la sesión
     * @param {Array} dataPoints - Array de puntos de datos
     * @returns {Promise<boolean>}
     */
    async saveStreamingDataBatch(sessionId, dataPoints) {
        if (!this.isInitialized || !Array.isArray(dataPoints) || dataPoints.length === 0) {
            return false;
        }
        
        try {
            const transaction = this.db.transaction([this.stores.streamingData], 'readwrite');
            const store = transaction.objectStore(this.stores.streamingData);
            
            const promises = dataPoints.map(dataPoint => {
                const record = {
                    sessionId: sessionId,
                    timestamp: dataPoint.timestamp || new Date().toISOString(),
                    x: dataPoint.x,
                    y: dataPoint.y,
                    z: dataPoint.z,
                    temperature: dataPoint.temperature,
                    battery: dataPoint.battery,
                    raw: dataPoint.raw || null
                };
                
                return this.promisifyRequest(store.add(record));
            });
            
            await Promise.all(promises);
            console.log(`Guardados ${dataPoints.length} puntos de datos para sesión ${sessionId}`);
            return true;
            
        } catch (error) {
            console.error('Error guardando datos de streaming:', error);
            return false;
        }
    },
    
    /**
     * Finalizar sesión de streaming
     * @param {string} sessionId - ID de la sesión
     * @param {Object} summary - Resumen de la sesión
     * @returns {Promise<boolean>}
     */
    async endStreamingSession(sessionId, summary = {}) {
        if (!this.isInitialized) {
            console.error('Storage Service no está inicializado');
            return false;
        }
        
        try {
            const transaction = this.db.transaction([this.stores.sessions], 'readwrite');
            const store = transaction.objectStore(this.stores.sessions);
            
            const sessionRecord = await this.promisifyRequest(store.get(sessionId));
            
            if (sessionRecord) {
                sessionRecord.endTime = new Date().toISOString();
                sessionRecord.status = 'completed';
                sessionRecord.duration = summary.duration || 0;
                sessionRecord.sampleCount = summary.sampleCount || 0;
                sessionRecord.summary = summary;
                
                await this.promisifyRequest(store.put(sessionRecord));
                console.log(`Sesión de streaming finalizada: ${sessionId}`);
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('Error finalizando sesión de streaming:', error);
            return false;
        }
    },
    
    /**
     * Obtener sesiones de streaming
     * @param {string} deviceId - ID del dispositivo (opcional)
     * @param {number} limit - Límite de sesiones
     * @returns {Promise<Array>}
     */
    async getStreamingSessions(deviceId = null, limit = 50) {
        if (!this.isInitialized) {
            console.error('Storage Service no está inicializado');
            return [];
        }
        
        try {
            const transaction = this.db.transaction([this.stores.sessions], 'readonly');
            const store = transaction.objectStore(this.stores.sessions);
            
            let request;
            if (deviceId) {
                const index = store.index('deviceId');
                request = index.getAll(deviceId, limit);
            } else {
                request = store.getAll(null, limit);
            }
            
            const sessions = await this.promisifyRequest(request);
            
            // Ordenar por fecha más reciente
            sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
            
            return sessions;
            
        } catch (error) {
            console.error('Error obteniendo sesiones de streaming:', error);
            return [];
        }
    },
    
    /**
     * Obtener datos de una sesión específica
     * @param {string} sessionId - ID de la sesión
     * @returns {Promise<Array>}
     */
    async getSessionData(sessionId) {
        if (!this.isInitialized) {
            console.error('Storage Service no está inicializado');
            return [];
        }
        
        try {
            const transaction = this.db.transaction([this.stores.streamingData], 'readonly');
            const store = transaction.objectStore(this.stores.streamingData);
            const index = store.index('sessionId');
            
            const data = await this.promisifyRequest(index.getAll(sessionId));
            
            // Ordenar por timestamp
            data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            return data;
            
        } catch (error) {
            console.error('Error obteniendo datos de sesión:', error);
            return [];
        }
    },
    
    // ========================================================================
    // GESTIÓN DE CONFIGURACIONES
    // ========================================================================
    
    /**
     * Guardar configuración
     * @param {string} deviceId - ID del dispositivo
     * @param {Object} config - Configuración
     * @param {string} name - Nombre de la configuración
     * @returns {Promise<boolean>}
     */
    async saveConfiguration(deviceId, config, name = 'default') {
        if (!this.isInitialized) {
            console.error('Storage Service no está inicializado');
            return false;
        }
        
        try {
            const transaction = this.db.transaction([this.stores.configurations], 'readwrite');
            const store = transaction.objectStore(this.stores.configurations);
            
            const configRecord = {
                id: `${deviceId}_${name}`,
                deviceId: deviceId,
                name: name,
                config: config,
                timestamp: new Date().toISOString()
            };
            
            await this.promisifyRequest(store.put(configRecord));
            console.log(`Configuración guardada: ${name} para dispositivo ${deviceId}`);
            return true;
            
        } catch (error) {
            console.error('Error guardando configuración:', error);
            return false;
        }
    },
    
    /**
     * Obtener configuración
     * @param {string} deviceId - ID del dispositivo
     * @param {string} name - Nombre de la configuración
     * @returns {Promise<Object|null>}
     */
    async getConfiguration(deviceId, name = 'default') {
        if (!this.isInitialized) {
            console.error('Storage Service no está inicializado');
            return null;
        }
        
        try {
            const transaction = this.db.transaction([this.stores.configurations], 'readonly');
            const store = transaction.objectStore(this.stores.configurations);
            
            const configRecord = await this.promisifyRequest(store.get(`${deviceId}_${name}`));
            
            return configRecord ? configRecord.config : null;
            
        } catch (error) {
            console.error('Error obteniendo configuración:', error);
            return null;
        }
    },
    
    /**
     * Listar configuraciones de un dispositivo
     * @param {string} deviceId - ID del dispositivo
     * @returns {Promise<Array>}
     */
    async listConfigurations(deviceId) {
        if (!this.isInitialized) {
            console.error('Storage Service no está inicializado');
            return [];
        }
        
        try {
            const transaction = this.db.transaction([this.stores.configurations], 'readonly');
            const store = transaction.objectStore(this.stores.configurations);
            const index = store.index('deviceId');
            
            const configs = await this.promisifyRequest(index.getAll(deviceId));
            
            return configs.map(config => ({
                name: config.name,
                timestamp: config.timestamp
            }));
            
        } catch (error) {
            console.error('Error listando configuraciones:', error);
            return [];
        }
    },
    
    // ========================================================================
    // GESTIÓN DE LOGS
    // ========================================================================
    
    /**
     * Guardar log
     * @param {string} message - Mensaje del log
     * @param {string} level - Nivel del log
     * @param {string} source - Fuente del log
     * @returns {Promise<boolean>}
     */
    async saveLog(message, level = 'info', source = 'app') {
        if (!this.isInitialized) {
            return false;
        }
        
        try {
            const transaction = this.db.transaction([this.stores.logs], 'readwrite');
            const store = transaction.objectStore(this.stores.logs);
            
            const logRecord = {
                message: message,
                level: level,
                source: source,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            };
            
            await this.promisifyRequest(store.add(logRecord));
            return true;
            
        } catch (error) {
            console.error('Error guardando log:', error);
            return false;
        }
    },
    
    /**
     * Obtener logs
     * @param {string} level - Filtrar por nivel (opcional)
     * @param {number} limit - Límite de logs
     * @returns {Promise<Array>}
     */
    async getLogs(level = null, limit = 100) {
        if (!this.isInitialized) {
            console.error('Storage Service no está inicializado');
            return [];
        }
        
        try {
            const transaction = this.db.transaction([this.stores.logs], 'readonly');
            const store = transaction.objectStore(this.stores.logs);
            
            let request;
            if (level) {
                const index = store.index('level');
                request = index.getAll(level, limit);
            } else {
                request = store.getAll(null, limit);
            }
            
            const logs = await this.promisifyRequest(request);
            
            // Ordenar por timestamp más reciente
            logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            return logs.slice(0, limit);
            
        } catch (error) {
            console.error('Error obteniendo logs:', error);
            return [];
        }
    },
    
    // ========================================================================
    // LOCALSTORAGE PARA CONFIGURACIONES RÁPIDAS
    // ========================================================================
    
    /**
     * Guardar en localStorage
     * @param {string} key - Clave
     * @param {any} value - Valor
     * @returns {boolean}
     */
    setLocalStorage(key, value) {
        try {
            const serializedValue = JSON.stringify(value);
            localStorage.setItem(`huella_ble_${key}`, serializedValue);
            return true;
        } catch (error) {
            console.error('Error guardando en localStorage:', error);
            return false;
        }
    },
    
    /**
     * Obtener de localStorage
     * @param {string} key - Clave
     * @param {any} defaultValue - Valor por defecto
     * @returns {any}
     */
    getLocalStorage(key, defaultValue = null) {
        try {
            const serializedValue = localStorage.getItem(`huella_ble_${key}`);
            return serializedValue ? JSON.parse(serializedValue) : defaultValue;
        } catch (error) {
            console.error('Error obteniendo de localStorage:', error);
            return defaultValue;
        }
    },
    
    /**
     * Eliminar de localStorage
     * @param {string} key - Clave
     * @returns {boolean}
     */
    removeLocalStorage(key) {
        try {
            localStorage.removeItem(`huella_ble_${key}`);
            return true;
        } catch (error) {
            console.error('Error eliminando de localStorage:', error);
            return false;
        }
    },
    
    // ========================================================================
    // EXPORTACIÓN DE DATOS
    // ========================================================================
    
    /**
     * Exportar datos a JSON
     * @param {string} sessionId - ID de la sesión (opcional)
     * @returns {Promise<Object>}
     */
    async exportToJSON(sessionId = null) {
        try {
            const exportData = {
                metadata: {
                    version: '3.0.0',
                    exportDate: new Date().toISOString(),
                    source: 'HUELLA BLE PWA'
                },
                devices: await this.getRecentDevices(100),
                sessions: sessionId ? 
                    [await this.getStreamingSession(sessionId)] : 
                    await this.getStreamingSessions(null, 100),
                logs: await this.getLogs(null, 1000)
            };
            
            if (sessionId) {
                exportData.data = await this.getSessionData(sessionId);
            }
            
            return exportData;
            
        } catch (error) {
            console.error('Error exportando datos:', error);
            return null;
        }
    },
    
    /**
     * Exportar sesión a CSV
     * @param {string} sessionId - ID de la sesión
     * @returns {Promise<string>}
     */
    async exportSessionToCSV(sessionId) {
        try {
            const sessionData = await this.getSessionData(sessionId);
            
            if (sessionData.length === 0) {
                throw new Error('No hay datos para exportar');
            }
            
            // Crear headers CSV
            const headers = ['Timestamp', 'X (g)', 'Y (g)', 'Z (g)', 'Temperature (°C)', 'Battery (%)'];
            const csvRows = [headers.join(',')];
            
            // Agregar datos
            sessionData.forEach(dataPoint => {
                const row = [
                    dataPoint.timestamp,
                    dataPoint.x.toFixed(6),
                    dataPoint.y.toFixed(6),
                    dataPoint.z.toFixed(6),
                    (dataPoint.temperature || 0).toFixed(2),
                    (dataPoint.battery || 0).toFixed(1)
                ];
                csvRows.push(row.join(','));
            });
            
            return csvRows.join('\n');
            
        } catch (error) {
            console.error('Error exportando a CSV:', error);
            return null;
        }
    },
    
    // ========================================================================
    // MANTENIMIENTO Y LIMPIEZA
    // ========================================================================
    
    /**
     * Realizar mantenimiento de la base de datos
     * @private
     */
    async performMaintenance() {
        try {
            console.log('Realizando mantenimiento de la base de datos...');
            
            await this.cleanOldData();
            await this.compactDatabase();
            await this.validateData();
            
            console.log('Mantenimiento completado');
            
        } catch (error) {
            console.error('Error en mantenimiento:', error);
        }
    },
    
    /**
     * Limpiar datos antiguos
     * @private
     */
    async cleanOldData() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.dataRetentionDays);
        const cutoffISO = cutoffDate.toISOString();
        
        try {
            // Limpiar logs antiguos
            const transaction = this.db.transaction([this.stores.logs], 'readwrite');
            const logsStore = transaction.objectStore(this.stores.logs);
            const timestampIndex = logsStore.index('timestamp');
            
            const oldLogsRequest = timestampIndex.openCursor(IDBKeyRange.upperBound(cutoffISO));
            let deletedLogs = 0;
            
            await new Promise((resolve) => {
                oldLogsRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cursor.delete();
                        deletedLogs++;
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
            });
            
            if (deletedLogs > 0) {
                console.log(`Eliminados ${deletedLogs} logs antiguos`);
            }
            
        } catch (error) {
            console.error('Error limpiando datos antiguos:', error);
        }
    },
    
    /**
     * Compactar base de datos (simulado)
     * @private
     */
    async compactDatabase() {
        try {
            // Obtener estadísticas
            const stats = await this.getDatabaseStats();
            console.log('Estadísticas de la base de datos:', stats);
            
            // Si hay demasiados registros de streaming, mantener solo los más recientes
            if (stats.streamingData > this.config.maxStreamingRecords) {
                await this.trimStreamingData();
            }
            
        } catch (error) {
            console.error('Error compactando base de datos:', error);
        }
    },
    
    /**
     * Validar integridad de datos
     * @private
     */
    async validateData() {
        try {
            // Verificar que todas las sesiones tengan datos consistentes
            const sessions = await this.getStreamingSessions(null, 10);
            
            for (const session of sessions) {
                const sessionData = await this.getSessionData(session.id);
                
                if (session.sampleCount !== sessionData.length) {
                    console.warn(`Inconsistencia en sesión ${session.id}: ${session.sampleCount} esperadas, ${sessionData.length} encontradas`);
                    
                    // Corregir el conteo
                    session.sampleCount = sessionData.length;
                    await this.updateSession(session);
                }
            }
            
        } catch (error) {
            console.error('Error validando datos:', error);
        }
    },
    
    /**
     * Obtener estadísticas de la base de datos
     * @returns {Promise<Object>}
     */
    async getDatabaseStats() {
        try {
            const stats = {};
            
            for (const storeName of Object.values(this.stores)) {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const count = await this.promisifyRequest(store.count());
                stats[storeName.replace('_', '')] = count;
            }
            
            return stats;
            
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            return {};
        }
    },
    
    // ========================================================================
    // UTILIDADES
    // ========================================================================
    
    /**
     * Convertir request de IndexedDB a Promise
     * @private
     */
    promisifyRequest(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    
    /**
     * Obtener información del almacenamiento
     * @returns {Promise<Object>}
     */
    async getStorageInfo() {
        try {
            const info = {
                isInitialized: this.isInitialized,
                dbName: this.dbName,
                dbVersion: this.dbVersion,
                isSupported: this.isIndexedDBSupported(),
                stats: await this.getDatabaseStats()
            };
            
            // Agregar información de localStorage
            if (typeof Storage !== 'undefined') {
                info.localStorage = {
                    available: true,
                    used: JSON.stringify(localStorage).length,
                    keys: Object.keys(localStorage).filter(key => key.startsWith('huella_ble_'))
                };
            }
            
            // Agregar información de quota (si está disponible)
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                info.quota = {
                    usage: estimate.usage,
                    quota: estimate.quota,
                    usagePercentage: ((estimate.usage / estimate.quota) * 100).toFixed(2)
                };
            }
            
            return info;
            
        } catch (error) {
            console.error('Error obteniendo información de almacenamiento:', error);
            return { error: error.message };
        }
    },
    
    /**
     * Limpiar toda la base de datos
     * @returns {Promise<boolean>}
     */
    async clearDatabase() {
        if (!this.isInitialized) {
            console.error('Storage Service no está inicializado');
            return false;
        }
        
        try {
            console.log('Limpiando base de datos...');
            
            const transaction = this.db.transaction(Object.values(this.stores), 'readwrite');
            
            const promises = Object.values(this.stores).map(storeName => {
                const store = transaction.objectStore(storeName);
                return this.promisifyRequest(store.clear());
            });
            
            await Promise.all(promises);
            
            console.log('Base de datos limpiada correctamente');
            return true;
            
        } catch (error) {
            console.error('Error limpiando base de datos:', error);
            return false;
        }
    },
    
    /**
     * Cerrar conexión a la base de datos
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.isInitialized = false;
            console.log('Conexión a base de datos cerrada');
        }
    }
};

// ============================================================================
// FUNCIONES HELPER PARA COMPATIBILIDAD
// ============================================================================

/**
 * Función helper para guardado rápido en localStorage
 */
function saveToLocalStorage(key, value) {
    return StorageService.setLocalStorage(key, value);
}

/**
 * Función helper para carga rápida de localStorage
 */
function loadFromLocalStorage(key, defaultValue = null) {
    return StorageService.getLocalStorage(key, defaultValue);
}

/**
 * Función helper para inicialización automática
 */
async function initStorageService() {
    if (!StorageService.isInitialized) {
        await StorageService.init();
    }
    return StorageService.isInitialized;
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.StorageService = StorageService;
    window.saveToLocalStorage = saveToLocalStorage;
    window.loadFromLocalStorage = loadFromLocalStorage;
    window.initStorageService = initStorageService;
}

console.log('Storage Service v3.0 cargado - Compatible con IndexedDB y localStorage');
