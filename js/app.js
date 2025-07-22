/*
 * PWA Controlador del Sensor CTIM3 por BLE de Huella Estructural y Symbiot Technologies
 * Archivo: js/app.js
 * Descripción: Lógica principal de la aplicación PWA
 * Versión: 3.0.0
 * Compatible con: Firmware CTIM3 v2.3.016, Azure Web Apps
 * Fecha: 2025-07-22
 */

// ============================================================================
// APLICACIÓN PRINCIPAL
// ============================================================================

class HuellaApp {
    constructor() {
        this.version = '3.0.0';
        this.firmwareVersion = '2.3.016';
        
        // Estado de la aplicación
        this.currentTab = 'dashboard';
        this.currentTheme = 'night';
        this.isInitialized = false;
        
        // Referencias a elementos DOM
        this.elements = {};
        
        // Estado de conexión y datos
        this.deviceInfo = null;
        this.streamingActive = false;
        this.streamingData = [];
        this.streamingStartTime = null;
        
        // Configuración
        this.config = {
            autoReconnect: true,
            autoScroll: true,
            defaultStreamDuration: 30,
            maxLogEntries: 1000
        };
        
        // Logs internos
        this.logs = [];
    }
    
    // ========================================================================
    // INICIALIZACIÓN
    // ========================================================================
    
    /**
     * Inicializar la aplicación
     */
    async init() {
        try {
            this.log('Inicializando HUELLA BLE PWA v3.0...', 'info');
            
            // Verificar dependencias
            await this.checkDependencies();
            
            // Inicializar elementos DOM
            this.initializeElements();
            
            // Configurar tema
            this.initializeTheme();
            
            // Inicializar servicios
            await this.initializeServices();
            
            // Configurar event listeners
            this.setupEventListeners();
            
            // Configurar tabs
            this.initializeTabs();
            
            // Verificar soporte BLE
            this.checkBLESupport();
            
            // Mostrar tab inicial
            this.switchTab('dashboard');
            
            // Registro completado
            this.isInitialized = true;
            this.log('Aplicación inicializada correctamente', 'success');
            
            // Ocultar loading overlay si está visible
            this.hideLoadingOverlay();
            
        } catch (error) {
            this.log(`Error inicializando aplicación: ${error.message}`, 'error');
            this.showError('Error de inicialización', error.message);
        }
    }
    
    /**
     * Verificar dependencias necesarias
     */
    async checkDependencies() {
        const dependencies = [
            { name: 'jQuery', check: () => typeof $ !== 'undefined' },
            { name: 'Bootstrap', check: () => typeof bootstrap !== 'undefined' },
            { name: 'Chart.js', check: () => typeof Chart !== 'undefined' },
            { name: 'BLEService', check: () => typeof BLEService !== 'undefined' },
            { name: 'StorageService', check: () => typeof StorageService !== 'undefined' },
            { name: 'ChartService', check: () => typeof ChartService !== 'undefined' }
        ];
        
        const missing = dependencies.filter(dep => !dep.check());
        
        if (missing.length > 0) {
            throw new Error(`Dependencias faltantes: ${missing.map(d => d.name).join(', ')}`);
        }
        
        this.log('Todas las dependencias están disponibles', 'success');
    }
    
    /**
     * Inicializar referencias a elementos DOM
     */
    initializeElements() {
        this.elements = {
            // Header y controles principales
            connectionIndicator: document.getElementById('connectionIndicator'),
            themeToggle: document.getElementById('themeToggle'),
            disconnectButton: document.getElementById('disconnectButton'),
            
            // Botones principales
            scanButton: document.getElementById('scanButton'),
            connectButton: document.getElementById('connectButton'),
            startButton: document.getElementById('startButton'),
            stopButton: document.getElementById('stopButton'),
            
            // Dashboard
            deviceInfo: document.getElementById('deviceInfo'),
            bluetoothStatus: document.getElementById('bluetoothStatus'),
            firmwareStatus: document.getElementById('firmwareStatus'),
            batteryStatus: document.getElementById('batteryStatus'),
            temperatureStatus: document.getElementById('temperatureStatus'),
            
            // Streaming
            streamDuration: document.getElementById('streamDuration'),
            startStreamBtn: document.getElementById('startStreamBtn'),
            stopStreamBtn: document.getElementById('stopStreamBtn'),
            exportBtn: document.getElementById('exportBtn'),
            dataChart: document.getElementById('dataChart'),
            sampleCount: document.getElementById('sampleCount'),
            sampleRate: document.getElementById('sampleRate'),
            lastX: document.getElementById('lastX'),
            lastY: document.getElementById('lastY'),
            
            // Configuración
            sensorFreq: document.getElementById('sensorFreq'),
            sensorRange: document.getElementById('sensorRange'),
            wifiSSID: document.getElementById('wifiSSID'),
            wifiPassword: document.getElementById('wifiPassword'),
            calX: document.getElementById('calX'),
            calY: document.getElementById('calY'),
            calZ: document.getElementById('calZ'),
            deviceDetails: document.getElementById('deviceDetails'),
            saveConfigButton: document.getElementById('saveConfigButton'),
            loadConfigButton: document.getElementById('loadConfigButton'),
            
            // Logs
            logOutput: document.getElementById('logOutput'),
            
            // Modal
            pinInput: document.getElementById('pinInput'),
            pinError: document.getElementById('pinError'),
            
            // Loading overlay
            loadingOverlay: document.getElementById('loadingOverlay')
        };
        
        this.log('Elementos DOM inicializados', 'info');
    }
    
    /**
     * Inicializar tema
     */
    initializeTheme() {
        // Cargar tema guardado
        const savedTheme = localStorage.getItem('huella-ble-theme') || 'night';
        this.setTheme(savedTheme);
        this.log(`Tema cargado: ${savedTheme}`, 'info');
    }
    
    /**
     * Inicializar servicios
     */
    async initializeServices() {
        try {
            // Inicializar Storage Service
            const storageInit = await StorageService.init();
            if (!storageInit) {
                throw new Error('No se pudo inicializar Storage Service');
            }
            this.log('Storage Service inicializado', 'success');
            
            // Inicializar BLE Service
            const bleInit = BLEService.init({
                onConnectionChange: (status) => this.handleBLEConnectionChange(status),
                onAuthenticationChange: (status) => this.handleBLEAuthenticationChange(status),
                onStatusUpdate: (data) => this.handleBLEStatusUpdate(data),
                onDataReceived: (data) => this.handleBLEDataReceived(data),
                onError: (error) => this.handleBLEError(error),
                onLog: (logData) => this.handleBLELog(logData)
            });
            
            if (!bleInit) {
                throw new Error('No se pudo inicializar BLE Service');
            }
            this.log('BLE Service inicializado', 'success');
            
            // Inicializar Chart Service
            ChartService.init('dataChart');
            this.log('Chart Service inicializado', 'success');
            
        } catch (error) {
            this.log(`Error inicializando servicios: ${error.message}`, 'error');
            throw error;
        }
    }
    
    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================
    
    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Botones principales
        this.elements.scanButton?.addEventListener('click', () => this.scanForDevices());
        this.elements.connectButton?.addEventListener('click', () => this.connectToDevice());
        this.elements.startButton?.addEventListener('click', () => this.startSensor());
        this.elements.stopButton?.addEventListener('click', () => this.stopSensor());
        this.elements.disconnectButton?.addEventListener('click', () => this.disconnectDevice());
        
        // Toggle de tema
        this.elements.themeToggle?.addEventListener('click', () => this.toggleTheme());
        
        // Streaming
        this.elements.startStreamBtn?.addEventListener('click', () => this.startStreaming());
        this.elements.stopStreamBtn?.addEventListener('click', () => this.stopStreaming());
        this.elements.exportBtn?.addEventListener('click', () => this.exportStreamingData());
        
        // Configuración
        this.elements.saveConfigButton?.addEventListener('click', () => this.saveConfiguration());
        this.elements.loadConfigButton?.addEventListener('click', () => this.loadConfiguration());
        
        // Modal PIN
        this.elements.pinInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.submitPin();
            }
        });
        
        // Input de PIN - solo números
        this.elements.pinInput?.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').substring(0, 6);
            if (this.elements.pinError) {
                this.elements.pinError.style.display = 'none';
            }
        });
        
        // Navegación de tabs
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = e.target.closest('.nav-link').getAttribute('onclick')?.match(/switchTab\('([^']+)'\)/)?.[1];
                if (tabName) {
                    this.switchTab(tabName);
                }
            });
        });
        
        // FAB (Floating Action Button)
        document.querySelector('.fab')?.addEventListener('click', () => this.scanForDevices());
        
        // Window events
        window.addEventListener('beforeunload', (e) => {
            if (this.streamingActive || BLEService.isConnected) {
                e.preventDefault();
                e.returnValue = '¿Estás seguro de que quieres salir? Hay una conexión activa.';
            }
        });
        
        // Service Worker updates
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'SW_ACTIVATED') {
                    this.log(`Service Worker actualizado a versión ${event.data.version}`, 'info');
                }
            });
        }
        
        this.log('Event listeners configurados', 'info');
    }
    
    // ========================================================================
    // MANEJO DE TABS
    // ========================================================================
    
    /**
     * Inicializar sistema de tabs
     */
    initializeTabs() {
        // Ocultar todos los contenidos de tabs excepto el activo
        document.querySelectorAll('.tab-content').forEach(tab => {
            if (!tab.classList.contains('active')) {
                tab.style.display = 'none';
            }
        });
    }
    
    /**
     * Cambiar de tab
     * @param {string} tabName - Nombre del tab
     */
    switchTab(tabName) {
        // Remover clases activas de todos los tabs
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });
        
        // Activar tab seleccionado
        const selectedTab = document.getElementById(tabName);
        const selectedNavLink = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
        
        if (selectedTab) {
            selectedTab.classList.add('active');
            selectedTab.style.display = 'block';
            this.currentTab = tabName;
        }
        
        if (selectedNavLink) {
            selectedNavLink.classList.add('active');
        }
        
        // Acciones específicas por tab
        switch (tabName) {
            case 'streaming':
                // Redimensionar gráfico si es necesario
                setTimeout(() => {
                    if (typeof ChartService !== 'undefined') {
                        ChartService.resize();
                    }
                }, 100);
                break;
                
            case 'logs':
                // Auto-scroll a la parte inferior de logs
                if (this.config.autoScroll && this.elements.logOutput) {
                    this.elements.logOutput.scrollTop = this.elements.logOutput.scrollHeight;
                }
                break;
        }
        
        this.log(`Cambiado a tab: ${tabName}`, 'info');
    }
    
    // ========================================================================
    // MANEJO BLE
    // ========================================================================
    
    /**
     * Verificar soporte BLE
     */
    checkBLESupport() {
        if (BLEService.isSupported) {
            this.updateBluetoothStatus('Soportado');
            this.log('Web Bluetooth soportado', 'success');
        } else {
            this.updateBluetoothStatus('No soportado');
            this.log('Web Bluetooth no soportado', 'error');
            this.showError(
                'Bluetooth no soportado',
                'Este navegador no soporta Web Bluetooth. Use Chrome o Edge en Android/Windows.'
            );
        }
    }
    
    /**
     * Escanear dispositivos
     */
    async scanForDevices() {
        if (!BLEService.isSupported) {
            this.showError('BLE no soportado', 'Web Bluetooth no está disponible en este navegador');
            return;
        }
        
        try {
            this.log('Iniciando escaneo de dispositivos...', 'info');
            this.showLoadingOverlay('Escaneando dispositivos...');
            
            const success = await BLEService.scanAndConnect();
            
            if (success) {
                this.log('Dispositivo encontrado y conectado', 'success');
                // El modal de PIN se mostrará automáticamente si es necesario
            } else {
                this.log('No se pudo conectar al dispositivo', 'error');
            }
            
        } catch (error) {
            this.log(`Error en escaneo: ${error.message}`, 'error');
            this.showError('Error de escaneo', error.message);
        } finally {
            this.hideLoadingOverlay();
        }
    }
    
    /**
     * Conectar a dispositivo (después de selección)
     */
    async connectToDevice() {
        // Esta función se llama automáticamente después del escaneo exitoso
        this.showPinModal();
    }
    
    /**
     * Mostrar modal de PIN
     */
    showPinModal() {
        const pinModal = new bootstrap.Modal(document.getElementById('pinModal'));
        pinModal.show();
        
        // Focus en input de PIN
        setTimeout(() => {
            if (this.elements.pinInput) {
                this.elements.pinInput.focus();
                this.elements.pinInput.value = BLE_CONFIG.PIN_DEFAULT;
            }
        }, 500);
    }
    
    /**
     * Enviar PIN para autenticación
     */
    async submitPin() {
        const pin = this.elements.pinInput?.value || BLE_CONFIG.PIN_DEFAULT;
        
        if (pin.length !== 6) {
            this.showPinError('PIN debe tener 6 dígitos');
            return;
        }
        
        try {
            this.showLoadingOverlay('Autenticando...');
            
            const success = await BLEService.authenticate(pin);
            
            if (success) {
                // Cerrar modal
                const pinModal = bootstrap.Modal.getInstance(document.getElementById('pinModal'));
                pinModal?.hide();
                
                this.log('Autenticación exitosa', 'success');
            } else {
                this.showPinError('PIN incorrecto. Intente nuevamente.');
                this.elements.pinInput.value = '';
                this.elements.pinInput.focus();
            }
            
        } catch (error) {
            this.log(`Error en autenticación: ${error.message}`, 'error');
            this.showPinError('Error de autenticación');
        } finally {
            this.hideLoadingOverlay();
        }
    }
    
    /**
     * Mostrar error en modal de PIN
     */
    showPinError(message) {
        if (this.elements.pinError) {
            this.elements.pinError.textContent = message;
            this.elements.pinError.style.display = 'block';
        }
    }
    
    /**
     * Desconectar dispositivo
     */
    async disconnectDevice() {
        try {
            this.log('Desconectando dispositivo...', 'info');
            await BLEService.disconnect();
        } catch (error) {
            this.log(`Error desconectando: ${error.message}`, 'error');
        }
    }
    
    // ========================================================================
    // CALLBACKS BLE
    // ========================================================================
    
    /**
     * Manejar cambio de conexión
     */
    handleBLEConnectionChange(status) {
        this.log(`Estado de conexión: ${status}`, 'info');
        
        switch (status) {
            case 'scanning':
                this.updateConnectionStatus('Escaneando', 'connecting');
                break;
                
            case 'connecting':
                this.updateConnectionStatus('Conectando', 'connecting');
                break;
                
            case 'connected':
                this.updateConnectionStatus('Conectado', 'connected');
                this.updateButtons({ connected: true });
                break;
                
            case 'disconnected':
                this.updateConnectionStatus('Desconectado', 'disconnected');
                this.updateButtons({ connected: false, authenticated: false });
                this.clearDeviceInfo();
                break;
        }
    }
    
    /**
     * Manejar cambio de autenticación
     */
    handleBLEAuthenticationChange(status) {
        this.log(`Estado de autenticación: ${status}`, 'info');
        
        switch (status) {
            case 'authenticating':
                this.updateConnectionStatus('Autenticando', 'connecting');
                break;
                
            case 'authenticated':
                this.updateConnectionStatus('Autenticado', 'authenticated');
                this.updateButtons({ authenticated: true });
                this.loadDeviceInfo();
                break;
                
            case 'failed':
                this.updateConnectionStatus('Autenticación fallida', 'disconnected');
                break;
                
            case 'timeout':
                this.updateConnectionStatus('Timeout de autenticación', 'disconnected');
                break;
        }
    }
    
    /**
     * Manejar actualización de estado
     */
    handleBLEStatusUpdate(data) {
        this.log(`Actualización de estado: ${JSON.stringify(data)}`, 'info');
        
        // Actualizar información de estado en UI
        if (data.battery !== undefined) {
            this.updateBatteryStatus(data.battery);
        }
        
        if (data.temperature !== undefined) {
            this.updateTemperatureStatus(data.temperature);
        }
    }
    
    /**
     * Manejar datos recibidos
     */
    handleBLEDataReceived(data) {
        if (this.streamingActive) {
            // Agregar datos al gráfico
            ChartService.addDataPoint(data);
            
            // Actualizar estadísticas
            this.updateStreamingStats(data);
            
            // Agregar al buffer local
            this.streamingData.push(data);
        }
    }
    
    /**
     * Manejar errores BLE
     */
    handleBLEError(errorData) {
        this.log(`Error BLE: ${errorData.error.message}`, 'error');
        this.showError('Error BLE', errorData.error.message);
    }
    
    /**
     * Manejar logs BLE
     */
    handleBLELog(logData) {
        this.addToLogOutput(`[BLE] ${logData.message}`, logData.level);
    }
    
    // ========================================================================
    // STREAMING DE DATOS
    // ========================================================================
    
    /**
     * Iniciar streaming
     */
    async startStreaming() {
        if (!BLEService.isAuthenticated) {
            this.showError('No autenticado', 'Debe autenticarse antes de iniciar streaming');
            return;
        }
        
        const duration = parseInt(this.elements.streamDuration?.value || 30);
        
        try {
            this.log(`Iniciando streaming por ${duration} segundos...`, 'info');
            
            // Preparar UI
            this.streamingActive = true;
            this.streamingData = [];
            this.streamingStartTime = Date.now();
            
            // Configurar gráfico
            ChartService.clearData();
            ChartService.startRealTimeMode();
            
            // Actualizar botones
            this.updateButtons({ streaming: true });
            
            // Iniciar streaming BLE
            const success = await BLEService.startStreaming(duration, (data) => {
                this.handleBLEDataReceived(data);
            });
            
            if (!success) {
                throw new Error('No se pudo iniciar streaming');
            }
            
            this.log('Streaming iniciado correctamente', 'success');
            
        } catch (error) {
            this.log(`Error iniciando streaming: ${error.message}`, 'error');
            this.showError('Error de streaming', error.message);
            this.streamingActive = false;
            this.updateButtons({ streaming: false });
        }
    }
    
    /**
     * Detener streaming
     */
    async stopStreaming() {
        try {
            this.log('Deteniendo streaming...', 'info');
            
            await BLEService.stopStreaming();
            
            this.streamingActive = false;
            this.updateButtons({ streaming: false });
            
            // Detener modo tiempo real del gráfico
            ChartService.stopRealTimeMode();
            
            this.log(`Streaming detenido. ${this.streamingData.length} muestras recibidas`, 'success');
            
        } catch (error) {
            this.log(`Error deteniendo streaming: ${error.message}`, 'error');
        }
    }
    
    /**
     * Exportar datos de streaming
     */
    exportStreamingData() {
        if (this.streamingData.length === 0) {
            this.showError('Sin datos', 'No hay datos para exportar');
            return;
        }
        
        try {
            // Crear CSV
            const headers = ['Timestamp', 'X (g)', 'Y (g)', 'Z (g)', 'Temperature (°C)', 'Battery (%)'];
            const csvData = [headers.join(',')];
            
            this.streamingData.forEach(data => {
                const row = [
                    new Date(data.timestamp).toISOString(),
                    data.x.toFixed(6),
                    data.y.toFixed(6),
                    data.z.toFixed(6),
                    data.temperature.toFixed(2),
                    data.battery.toFixed(1)
                ];
                csvData.push(row.join(','));
            });
            
            // Descargar archivo
            const blob = new Blob([csvData.join('\n')], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            
            const timestamp = new Date().toISOString().substring(0, 19).replace(/:/g, '-');
            a.href = url;
            a.download = `huella_data_${timestamp}.csv`;
            a.click();
            
            URL.revokeObjectURL(url);
            
            this.log(`Datos exportados: ${this.streamingData.length} muestras`, 'success');
            
        } catch (error) {
            this.log(`Error exportando datos: ${error.message}`, 'error');
            this.showError('Error de exportación', error.message);
        }
    }
    
    /**
     * Actualizar estadísticas de streaming
     */
    updateStreamingStats(data) {
        if (!this.streamingStartTime) return;
        
        // Calcular frecuencia de muestreo
        const elapsed = (Date.now() - this.streamingStartTime) / 1000;
        const sampleRate = this.streamingData.length / elapsed;
        
        // Actualizar UI
        if (this.elements.sampleCount) {
            this.elements.sampleCount.textContent = this.streamingData.length;
        }
        
        if (this.elements.sampleRate) {
            this.elements.sampleRate.textContent = `${sampleRate.toFixed(1)} Hz`;
        }
        
        if (this.elements.lastX) {
            this.elements.lastX.textContent = data.x.toFixed(4);
        }
        
        if (this.elements.lastY) {
            this.elements.lastY.textContent = data.y.toFixed(4);
        }
    }
    
    // ========================================================================
    // CONFIGURACIÓN
    // ========================================================================
    
    /**
     * Cargar información del dispositivo
     */
    async loadDeviceInfo() {
        try {
            const deviceInfo = await BLEService.getDeviceInfo();
            const config = await BLEService.getConfiguration();
            
            if (deviceInfo) {
                this.deviceInfo = deviceInfo;
                this.displayDeviceInfo(deviceInfo);
            }
            
            if (config) {
                this.displayConfiguration(config);
            }
            
        } catch (error) {
            this.log(`Error cargando información del dispositivo: ${error.message}`, 'error');
        }
    }
    
    /**
     * Mostrar información del dispositivo
     */
    displayDeviceInfo(info) {
        if (this.elements.deviceInfo) {
            const infoHTML = `
                <div class="device-info-details">
                    <div class="row">
                        <div class="col-md-6">
                            <strong>Nombre:</strong> ${info.name || 'N/A'}<br>
                            <strong>ID:</strong> ${info.id || 'N/A'}<br>
                            <strong>Firmware:</strong> ${info.firmware || this.firmwareVersion}<br>
                            <strong>Hardware:</strong> ${info.hardware || 'ESP32-S3'}
                        </div>
                        <div class="col-md-6">
                            <strong>Sensor:</strong> ${info.sensor || 'ADXL355'}<br>
                            <strong>Frecuencia:</strong> ${info.frequency || '250'} Hz<br>
                            <strong>Rango:</strong> ±${info.range || '2'}g<br>
                            <strong>Estado:</strong> ${info.status || 'Conectado'}
                        </div>
                    </div>
                </div>
            `;
            this.elements.deviceInfo.innerHTML = infoHTML;
        }
        
        if (this.elements.deviceDetails) {
            this.elements.deviceDetails.innerHTML = `
                <pre>${JSON.stringify(info, null, 2)}</pre>
            `;
        }
    }
    
    /**
     * Mostrar configuración
     */
    displayConfiguration(config) {
        // Actualizar campos de configuración
        if (this.elements.sensorFreq && config.frequency) {
            this.elements.sensorFreq.value = config.frequency;
        }
        
        if (this.elements.sensorRange && config.range) {
            this.elements.sensorRange.value = config.range;
        }
        
        if (this.elements.wifiSSID && config.ssid) {
            this.elements.wifiSSID.value = config.ssid;
        }
        
        if (this.elements.calX && config.calFactorX) {
            this.elements.calX.value = config.calFactorX;
        }
        
        if (this.elements.calY && config.calFactorY) {
            this.elements.calY.value = config.calFactorY;
        }
        
        if (this.elements.calZ && config.calFactorZ) {
            this.elements.calZ.value = config.calFactorZ;
        }
        
        // Habilitar campos de configuración
        const configFields = ['sensorFreq', 'sensorRange', 'wifiSSID', 'wifiPassword', 'calX', 'calY', 'calZ'];
        configFields.forEach(field => {
            if (this.elements[field]) {
                this.elements[field].disabled = false;
            }
        });
        
        // Habilitar botones de configuración
        if (this.elements.saveConfigButton) {
            this.elements.saveConfigButton.disabled = false;
        }
        
        if (this.elements.loadConfigButton) {
            this.elements.loadConfigButton.disabled = false;
        }
    }
    
    /**
     * Guardar configuración
     */
    async saveConfiguration() {
        try {
            const config = {
                frequency: parseInt(this.elements.sensorFreq?.value || 250),
                range: parseInt(this.elements.sensorRange?.value || 2),
                ssid: this.elements.wifiSSID?.value || '',
                password: this.elements.wifiPassword?.value || '',
                calFactorX: parseFloat(this.elements.calX?.value || BLE_CONFIG.CALIBRATION_FACTORS.X),
                calFactorY: parseFloat(this.elements.calY?.value || BLE_CONFIG.CALIBRATION_FACTORS.Y),
                calFactorZ: parseFloat(this.elements.calZ?.value || BLE_CONFIG.CALIBRATION_FACTORS.Z)
            };
            
            this.log('Guardando configuración...', 'info');
            this.showLoadingOverlay('Guardando configuración...');
            
            const success = await BLEService.setConfiguration(config);
            
            if (success) {
                this.log('Configuración guardada correctamente', 'success');
                this.showAlert('Configuración guardada correctamente', 'success');
            } else {
                throw new Error('No se pudo guardar la configuración');
            }
            
        } catch (error) {
            this.log(`Error guardando configuración: ${error.message}`, 'error');
            this.showError('Error de configuración', error.message);
        } finally {
            this.hideLoadingOverlay();
        }
    }
    
    /**
     * Cargar configuración
     */
    async loadConfiguration() {
        try {
            this.log('Cargando configuración...', 'info');
            this.showLoadingOverlay('Cargando configuración...');
            
            const config = await BLEService.getConfiguration();
            
            if (config) {
                this.displayConfiguration(config);
                this.log('Configuración cargada correctamente', 'success');
            } else {
                throw new Error('No se pudo cargar la configuración');
            }
            
        } catch (error) {
            this.log(`Error cargando configuración: ${error.message}`, 'error');
            this.showError('Error de configuración', error.message);
        } finally {
            this.hideLoadingOverlay();
        }
    }
    
    // ========================================================================
    // CONTROL DEL SENSOR
    // ========================================================================
    
    /**
     * Iniciar sensor
     */
    async startSensor() {
        try {
            this.log('Iniciando sensor...', 'info');
            const success = await BLEService.sendCommand(BLE_COMMANDS.START);
            
            if (success) {
                this.log('Sensor iniciado', 'success');
                this.updateButtons({ sensorRunning: true });
            } else {
                throw new Error('No se pudo iniciar el sensor');
            }
            
        } catch (error) {
            this.log(`Error iniciando sensor: ${error.message}`, 'error');
            this.showError('Error del sensor', error.message);
        }
    }
    
    /**
     * Detener sensor
     */
    async stopSensor() {
        try {
            this.log('Deteniendo sensor...', 'info');
            const success = await BLEService.sendCommand(BLE_COMMANDS.STOP);
            
            if (success) {
                this.log('Sensor detenido', 'success');
                this.updateButtons({ sensorRunning: false });
            } else {
                throw new Error('No se pudo detener el sensor');
            }
            
        } catch (error) {
            this.log(`Error deteniendo sensor: ${error.message}`, 'error');
            this.showError('Error del sensor', error.message);
        }
    }
    
    // ========================================================================
    // INTERFAZ DE USUARIO
    // ========================================================================
    
    /**
     * Actualizar estado de conexión
     */
    updateConnectionStatus(text, status) {
        if (this.elements.connectionIndicator) {
            this.elements.connectionIndicator.innerHTML = `<i class="bi bi-circle-fill"></i> ${text}`;
            this.elements.connectionIndicator.className = `status-badge status-${status}`;
        }
    }
    
    /**
     * Actualizar estado de botones
     */
    updateButtons(states) {
        // Botón de desconexión
        if (this.elements.disconnectButton) {
            this.elements.disconnectButton.style.display = 
                (states.connected || states.authenticated) ? 'inline-block' : 'none';
        }
        
        // Botones de sensor
        if (this.elements.startButton) {
            this.elements.startButton.disabled = !(states.authenticated && !states.sensorRunning);
        }
        
        if (this.elements.stopButton) {
            this.elements.stopButton.disabled = !(states.authenticated && states.sensorRunning);
        }
        
        // Botones de streaming
        if (this.elements.startStreamBtn) {
            this.elements.startStreamBtn.disabled = !(states.authenticated && !states.streaming);
        }
        
        if (this.elements.stopStreamBtn) {
            this.elements.stopStreamBtn.disabled = !states.streaming;
        }
        
        if (this.elements.exportBtn) {
            this.elements.exportBtn.disabled = states.streaming || this.streamingData.length === 0;
        }
    }
    
    /**
     * Actualizar estado de Bluetooth
     */
    updateBluetoothStatus(status) {
        if (this.elements.bluetoothStatus) {
            this.elements.bluetoothStatus.textContent = status;
        }
    }
    
    /**
     * Actualizar estado de batería
     */
    updateBatteryStatus(battery) {
        if (this.elements.batteryStatus) {
            this.elements.batteryStatus.textContent = `${battery}%`;
        }
    }
    
    /**
     * Actualizar estado de temperatura
     */
    updateTemperatureStatus(temperature) {
        if (this.elements.temperatureStatus) {
            this.elements.temperatureStatus.textContent = `${temperature}°C`;
        }
    }
    
    /**
     * Limpiar información del dispositivo
     */
    clearDeviceInfo() {
        if (this.elements.deviceInfo) {
            this.elements.deviceInfo.innerHTML = `
                <p class="no-device-msg">
                    <i class="bi bi-bluetooth"></i>
                    No hay dispositivo conectado
                </p>
            `;
        }
        
        if (this.elements.deviceDetails) {
            this.elements.deviceDetails.innerHTML = '<small class="text-muted">Conecte un dispositivo para ver detalles</small>';
        }
        
        // Resetear estados
        this.updateBatteryStatus('--');
        this.updateTemperatureStatus('--');
        
        // Deshabilitar campos de configuración
        const configFields = ['sensorFreq', 'sensorRange', 'wifiSSID', 'wifiPassword', 'calX', 'calY', 'calZ'];
        configFields.forEach(field => {
            if (this.elements[field]) {
                this.elements[field].disabled = true;
                this.elements[field].value = '';
            }
        });
        
        // Deshabilitar botones de configuración
        if (this.elements.saveConfigButton) {
            this.elements.saveConfigButton.disabled = true;
        }
        
        if (this.elements.loadConfigButton) {
            this.elements.loadConfigButton.disabled = true;
        }
    }
    
    // ========================================================================
    // TEMAS
    // ========================================================================
    
    /**
     * Cambiar tema
     */
    toggleTheme() {
        const newTheme = this.currentTheme === 'night' ? 'day' : 'night';
        this.setTheme(newTheme);
    }
    
    /**
     * Establecer tema
     */
    setTheme(theme) {
        this.currentTheme = theme;
        
        // Aplicar tema al documento
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);
        
        // Guardar preferencia
        localStorage.setItem('huella-ble-theme', theme);
        
        // Actualizar gráfico si existe
        if (typeof ChartService !== 'undefined') {
            ChartService.updateTheme(theme);
        }
        
        this.log(`Tema cambiado a: ${theme}`, 'info');
    }
    
    // ========================================================================
    // LOADING Y ALERTAS
    // ========================================================================
    
    /**
     * Mostrar loading overlay
     */
    showLoadingOverlay(message = 'Procesando...') {
        if (this.elements.loadingOverlay) {
            const loadingText = this.elements.loadingOverlay.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = message;
            }
            this.elements.loadingOverlay.classList.add('show');
        }
    }
    
    /**
     * Ocultar loading overlay
     */
    hideLoadingOverlay() {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.remove('show');
        }
    }
    
    /**
     * Mostrar error
     */
    showError(title, message) {
        console.error(`${title}: ${message}`);
        
        // Crear toast de Bootstrap si está disponible
        if (typeof bootstrap !== 'undefined') {
            this.showToast(title, message, 'danger');
        } else {
            alert(`${title}: ${message}`);
        }
    }
    
    /**
     * Mostrar alerta de éxito
     */
    showAlert(title, type = 'success') {
        if (typeof bootstrap !== 'undefined') {
            this.showToast(title, '', type);
        }
    }
    
    /**
     * Mostrar toast
     */
    showToast(title, message, type = 'info') {
        // Implementación simple de toast
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <strong>${title}</strong>${message ? ': ' + message : ''}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        // Agregar al DOM
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        
        toastContainer.appendChild(toast);
        
        // Mostrar toast
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        // Limpiar después de que se oculte
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }
    
    // ========================================================================
    // LOGS
    // ========================================================================
    
    /**
     * Agregar mensaje al log
     */
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            message,
            level
        };
        
        this.logs.push(logEntry);
        
        // Limitar número de logs
        if (this.logs.length > this.config.maxLogEntries) {
            this.logs = this.logs.slice(-this.config.maxLogEntries);
        }
        
        // Agregar a output visual
        this.addToLogOutput(`[${timestamp.substring(11, 23)}] ${message}`, level);
        
        // Log a consola también
        switch (level) {
            case 'error':
                console.error(`[HUELLA] ${message}`);
                break;
            case 'warning':
                console.warn(`[HUELLA] ${message}`);
                break;
            case 'success':
                console.log(`%c[HUELLA] ${message}`, 'color: green');
                break;
            default:
                console.log(`[HUELLA] ${message}`);
        }
    }
    
    /**
     * Agregar mensaje al output de logs
     */
    addToLogOutput(message, level = 'info') {
        if (!this.elements.logOutput) return;
        
        const colorMap = {
            error: '#ff6b6b',
            warning: '#feca57',
            success: '#48ca88',
            info: '#00ff00'
        };
        
        const color = colorMap[level] || colorMap.info;
        const logLine = `<span style="color: ${color}">${message}</span>\n`;
        
        this.elements.logOutput.innerHTML += logLine;
        
        // Auto-scroll si está habilitado
        if (this.config.autoScroll) {
            this.elements.logOutput.scrollTop = this.elements.logOutput.scrollHeight;
        }
    }
    
    /**
     * Limpiar logs
     */
    clearDebugLog() {
        this.logs = [];
        if (this.elements.logOutput) {
            this.elements.logOutput.innerHTML = '';
        }
        this.log('Logs limpiados', 'info');
    }
    
    /**
     * Exportar logs
     */
    exportDebugLog() {
        try {
            const logData = this.logs.map(log => 
                `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}`
            ).join('\n');
            
            const blob = new Blob([logData], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            
            const timestamp = new Date().toISOString().substring(0, 19).replace(/:/g, '-');
            a.href = url;
            a.download = `huella_logs_${timestamp}.txt`;
            a.click();
            
            URL.revokeObjectURL(url);
            
            this.log(`Logs exportados: ${this.logs.length} entradas`, 'success');
            
        } catch (error) {
            this.log(`Error exportando logs: ${error.message}`, 'error');
        }
    }
    
    /**
     * Mostrar información de debug BLE
     */
    debugBLEInfo() {
        const status = BLEService.getStatus();
        const info = {
            version: this.version,
            bleStatus: status,
            currentTab: this.currentTab,
            theme: this.currentTheme,
            streamingData: this.streamingData.length,
            logs: this.logs.length
        };
        
        this.addToLogOutput(`=== DEBUG INFO ===\n${JSON.stringify(info, null, 2)}\n==================`, 'info');
    }
}

// ============================================================================
// FUNCIONES GLOBALES (PARA COMPATIBILIDAD CON HTML)
// ============================================================================

// Instancia global de la aplicación
let app;

/**
 * Inicializar aplicación cuando el DOM esté listo
 */
document.addEventListener('DOMContentLoaded', async () => {
    app = new HuellaApp();
    await app.init();
});

/**
 * Funciones globales para compatibilidad con HTML
 */
window.switchTab = (tabName) => {
    if (app && app.isInitialized) {
        app.switchTab(tabName);
    }
};

window.scanForHuellaDevices = () => {
    if (app && app.isInitialized) {
        app.scanForDevices();
    }
};

window.submitPin = () => {
    if (app && app.isInitialized) {
        app.submitPin();
    }
};

window.saveConfiguration = () => {
    if (app && app.isInitialized) {
        app.saveConfiguration();
    }
};

window.loadConfiguration = () => {
    if (app && app.isInitialized) {
        app.loadConfiguration();
    }
};

window.clearDebugLog = () => {
    if (app && app.isInitialized) {
        app.clearDebugLog();
    }
};

window.exportDebugLog = () => {
    if (app && app.isInitialized) {
        app.exportDebugLog();
    }
};

window.debugBLEInfo = () => {
    if (app && app.isInitialized) {
        app.debugBLEInfo();
    }
};

console.log('HUELLA BLE PWA v3.0 - Aplicación Principal Cargada');
console.log('Compatible con Firmware CTIM3 v2.3.016');
console.log('Desarrollado por Symbiot Technologies');
