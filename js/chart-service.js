/*
 * PWA Controlador del Sensor CTIM3 por BLE de Huella Estructural y Symbiot Technologies
 * Archivo: js/chart-service.js
 * Descripción: Servicio de gráficos en tiempo real para datos del acelerómetro ADXL355
 * Versión: 3.0.0
 * Compatible con: Firmware CTIM3 v2.3.016, Chart.js, Azure Web Apps
 * Fecha: 2025-07-22
 */

// ============================================================================
// SERVICIO DE GRÁFICOS EN TIEMPO REAL
// ============================================================================

const ChartService = {
    // Estado del servicio
    isInitialized: false,
    canvasId: null,
    chart: null,
    
    // Configuración del gráfico
    config: {
        maxDataPoints: 1000,
        updateInterval: 100, // ms
        animationDuration: 0, // Sin animación para mejor rendimiento
        responsive: true,
        maintainAspectRatio: false,
        gridLines: true,
        legend: true,
        tooltips: true,
        zoom: false,
        pan: false
    },
    
    // Buffer de datos para rendimiento
    dataBuffer: {
        x: [],
        y: [],
        z: [],
        timestamps: [],
        maxSize: 1000
    },
    
    // Estado de tiempo real
    realTimeMode: false,
    updateQueue: [],
    isUpdating: false,
    lastUpdateTime: 0,
    
    // Factores de calibración ADXL355
    calibrationFactors: {
        X: 3.814697266E-06,
        Y: 3.814697266E-06,
        Z: 3.814697266E-06
    },
    
    // Colores para los ejes
    colors: {
        x: '#ff6b6b', // Rojo para X
        y: '#4ecdc4', // Verde azulado para Y
        z: '#45b7d1', // Azul para Z
        grid: '#30363d',
        text: '#ffffff',
        background: '#0d1117'
    },
    
    // ========================================================================
    // INICIALIZACIÓN
    // ========================================================================
    
    /**
     * Inicializar el servicio de gráficos
     * @param {string} canvasId - ID del elemento canvas
     * @param {Object} options - Opciones de configuración
     * @returns {boolean}
     */
    init(canvasId, options = {}) {
        try {
            console.log('Inicializando Chart Service v3.0...');
            
            // Verificar dependencias
            if (typeof Chart === 'undefined') {
                throw new Error('Chart.js no está disponible');
            }
            
            // Verificar canvas
            const canvas = document.getElementById(canvasId);
            if (!canvas) {
                throw new Error(`Canvas con ID '${canvasId}' no encontrado`);
            }
            
            this.canvasId = canvasId;
            
            // Fusionar configuración
            this.config = { ...this.config, ...options };
            
            // Crear gráfico
            this.createChart();
            
            // Configurar tema inicial
            this.updateTheme(document.documentElement.getAttribute('data-theme') || 'night');
            
            this.isInitialized = true;
            console.log('Chart Service inicializado correctamente');
            return true;
            
        } catch (error) {
            console.error('Error inicializando Chart Service:', error);
            return false;
        }
    },
    
    /**
     * Crear gráfico Chart.js
     * @private
     */
    createChart() {
        const ctx = document.getElementById(this.canvasId).getContext('2d');
        
        // Configuración optimizada para tiempo real
        Chart.defaults.animation.duration = 0;
        Chart.defaults.responsive = true;
        Chart.defaults.maintainAspectRatio = false;
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'X (g)',
                        data: [],
                        borderColor: this.colors.x,
                        backgroundColor: this.colors.x + '20',
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0,
                        pointHoverRadius: 3,
                        tension: 0.1
                    },
                    {
                        label: 'Y (g)',
                        data: [],
                        borderColor: this.colors.y,
                        backgroundColor: this.colors.y + '20',
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0,
                        pointHoverRadius: 3,
                        tension: 0.1
                    },
                    {
                        label: 'Z (g)',
                        data: [],
                        borderColor: this.colors.z,
                        backgroundColor: this.colors.z + '20',
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0,
                        pointHoverRadius: 3,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: this.config.legend,
                        position: 'top',
                        labels: {
                            color: this.colors.text,
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12,
                                family: "'Segoe UI', sans-serif"
                            }
                        }
                    },
                    tooltip: {
                        enabled: this.config.tooltips,
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#30363d',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = Number(context.parsed.y).toFixed(4);
                                return `${label}: ${value} g`;
                            },
                            title: function(tooltipItems) {
                                if (tooltipItems.length > 0) {
                                    const time = new Date(tooltipItems[0].label);
                                    return time.toLocaleTimeString();
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'second',
                            displayFormats: {
                                second: 'HH:mm:ss'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Tiempo',
                            color: this.colors.text,
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            display: this.config.gridLines,
                            color: this.colors.grid,
                            lineWidth: 1
                        },
                        ticks: {
                            color: this.colors.text,
                            maxTicksLimit: 10,
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Aceleración (g)',
                            color: this.colors.text,
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            display: this.config.gridLines,
                            color: this.colors.grid,
                            lineWidth: 1
                        },
                        ticks: {
                            color: this.colors.text,
                            callback: function(value) {
                                return Number(value).toFixed(3);
                            },
                            font: {
                                size: 11
                            }
                        },
                        beginAtZero: false
                    }
                },
                elements: {
                    line: {
                        borderJoinStyle: 'round'
                    },
                    point: {
                        radius: 0,
                        hoverRadius: 4
                    }
                }
            }
        });
        
        console.log('Gráfico Chart.js creado');
    },
    
    // ========================================================================
    // GESTIÓN DE DATOS EN TIEMPO REAL
    // ========================================================================
    
    /**
     * Iniciar modo de tiempo real
     */
    startRealTimeMode() {
        this.realTimeMode = true;
        this.clearData();
        console.log('Modo tiempo real iniciado');
    },
    
    /**
     * Detener modo de tiempo real
     */
    stopRealTimeMode() {
        this.realTimeMode = false;
        console.log('Modo tiempo real detenido');
    },
    
    /**
     * Agregar punto de datos en tiempo real
     * @param {Object} dataPoint - Punto de datos con x, y, z, timestamp
     */
    addDataPoint(dataPoint) {
        if (!this.isInitialized || !this.chart) {
            console.warn('Chart Service no está inicializado');
            return;
        }
        
        // Agregar a la cola de actualización para procesamiento por lotes
        this.updateQueue.push(dataPoint);
        
        // Procesar cola si no está en proceso
        if (!this.isUpdating) {
            this.processUpdateQueue();
        }
    },
    
    /**
     * Procesar cola de actualizaciones por lotes
     * @private
     */
    async processUpdateQueue() {
        if (this.isUpdating || this.updateQueue.length === 0) {
            return;
        }
        
        this.isUpdating = true;
        
        try {
            // Procesar hasta 10 puntos por lote para mejor rendimiento
            const batchSize = Math.min(10, this.updateQueue.length);
            const batch = this.updateQueue.splice(0, batchSize);
            
            // Agregar puntos al buffer
            batch.forEach(dataPoint => {
                this.addToBuffer(dataPoint);
            });
            
            // Actualizar gráfico si ha pasado suficiente tiempo
            const now = Date.now();
            if (now - this.lastUpdateTime >= this.config.updateInterval) {
                this.updateChartFromBuffer();
                this.lastUpdateTime = now;
            }
            
        } catch (error) {
            console.error('Error procesando cola de actualizaciones:', error);
        } finally {
            this.isUpdating = false;
            
            // Continuar procesando si hay más datos
            if (this.updateQueue.length > 0) {
                setTimeout(() => this.processUpdateQueue(), 10);
            }
        }
    },
    
    /**
     * Agregar datos al buffer
     * @private
     */
    addToBuffer(dataPoint) {
        const timestamp = new Date(dataPoint.timestamp);
        
        // Agregar al buffer
        this.dataBuffer.timestamps.push(timestamp);
        this.dataBuffer.x.push(dataPoint.x);
        this.dataBuffer.y.push(dataPoint.y);
        this.dataBuffer.z.push(dataPoint.z);
        
        // Mantener tamaño del buffer
        if (this.dataBuffer.x.length > this.dataBuffer.maxSize) {
            this.dataBuffer.timestamps.shift();
            this.dataBuffer.x.shift();
            this.dataBuffer.y.shift();
            this.dataBuffer.z.shift();
        }
    },
    
    /**
     * Actualizar gráfico desde el buffer
     * @private
     */
    updateChartFromBuffer() {
        if (!this.chart || this.dataBuffer.x.length === 0) {
            return;
        }
        
        try {
            // Actualizar labels (timestamps)
            this.chart.data.labels = [...this.dataBuffer.timestamps];
            
            // Actualizar datasets
            this.chart.data.datasets[0].data = [...this.dataBuffer.x];
            this.chart.data.datasets[1].data = [...this.dataBuffer.y];
            this.chart.data.datasets[2].data = [...this.dataBuffer.z];
            
            // Actualizar gráfico sin animación
            this.chart.update('none');
            
        } catch (error) {
            console.error('Error actualizando gráfico:', error);
        }
    },
    
    // ========================================================================
    // GESTIÓN DE DATOS ESTÁTICOS
    // ========================================================================
    
    /**
     * Cargar datos estáticos (para sesiones guardadas)
     * @param {Array} data - Array de puntos de datos
     */
    loadData(data) {
        if (!this.isInitialized || !this.chart || !Array.isArray(data)) {
            console.warn('No se pueden cargar datos: Chart Service no inicializado o datos inválidos');
            return;
        }
        
        try {
            console.log(`Cargando ${data.length} puntos de datos...`);
            
            // Limpiar buffer actual
            this.clearBuffer();
            
            // Procesar datos
            const timestamps = [];
            const xData = [];
            const yData = [];
            const zData = [];
            
            data.forEach(point => {
                timestamps.push(new Date(point.timestamp));
                xData.push(point.x);
                yData.push(point.y);
                zData.push(point.z);
            });
            
            // Actualizar gráfico
            this.chart.data.labels = timestamps;
            this.chart.data.datasets[0].data = xData;
            this.chart.data.datasets[1].data = yData;
            this.chart.data.datasets[2].data = zData;
            
            this.chart.update();
            
            console.log('Datos cargados correctamente');
            
        } catch (error) {
            console.error('Error cargando datos:', error);
        }
    },
    
    /**
     * Limpiar todos los datos
     */
    clearData() {
        if (!this.chart) {
            return;
        }
        
        try {
            this.clearBuffer();
            
            this.chart.data.labels = [];
            this.chart.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            
            this.chart.update();
            console.log('Datos del gráfico limpiados');
            
        } catch (error) {
            console.error('Error limpiando datos:', error);
        }
    },
    
    /**
     * Limpiar buffer de datos
     * @private
     */
    clearBuffer() {
        this.dataBuffer.timestamps = [];
        this.dataBuffer.x = [];
        this.dataBuffer.y = [];
        this.dataBuffer.z = [];
        this.updateQueue = [];
    },
    
    // ========================================================================
    // CONFIGURACIÓN Y PERSONALIZACIÓN
    // ========================================================================
    
    /**
     * Actualizar tema del gráfico
     * @param {string} theme - 'night' o 'day'
     */
    updateTheme(theme) {
        if (!this.chart) {
            return;
        }
        
        try {
            if (theme === 'day') {
                this.colors = {
                    x: '#dc3545',     // Rojo más oscuro
                    y: '#198754',     // Verde más oscuro
                    z: '#0d6efd',     // Azul más oscuro
                    grid: '#dee2e6',
                    text: '#212529',
                    background: '#ffffff'
                };
            } else {
                this.colors = {
                    x: '#ff6b6b',
                    y: '#4ecdc4',
                    z: '#45b7d1',
                    grid: '#30363d',
                    text: '#ffffff',
                    background: '#0d1117'
                };
            }
            
            // Actualizar colores del gráfico
            this.chart.data.datasets[0].borderColor = this.colors.x;
            this.chart.data.datasets[1].borderColor = this.colors.y;
            this.chart.data.datasets[2].borderColor = this.colors.z;
            
            this.chart.data.datasets[0].backgroundColor = this.colors.x + '20';
            this.chart.data.datasets[1].backgroundColor = this.colors.y + '20';
            this.chart.data.datasets[2].backgroundColor = this.colors.z + '20';
            
            // Actualizar opciones de tema
            this.chart.options.plugins.legend.labels.color = this.colors.text;
            this.chart.options.scales.x.title.color = this.colors.text;
            this.chart.options.scales.x.grid.color = this.colors.grid;
            this.chart.options.scales.x.ticks.color = this.colors.text;
            this.chart.options.scales.y.title.color = this.colors.text;
            this.chart.options.scales.y.grid.color = this.colors.grid;
            this.chart.options.scales.y.ticks.color = this.colors.text;
            
            this.chart.update();
            
            console.log(`Tema del gráfico actualizado: ${theme}`);
            
        } catch (error) {
            console.error('Error actualizando tema:', error);
        }
    },
    
    /**
     * Configurar visibilidad de ejes
     * @param {Object} visibility - {x: boolean, y: boolean, z: boolean}
     */
    setAxisVisibility(visibility) {
        if (!this.chart) {
            return;
        }
        
        try {
            this.chart.data.datasets[0].hidden = !visibility.x;
            this.chart.data.datasets[1].hidden = !visibility.y;
            this.chart.data.datasets[2].hidden = !visibility.z;
            
            this.chart.update();
            
            console.log('Visibilidad de ejes actualizada:', visibility);
            
        } catch (error) {
            console.error('Error configurando visibilidad de ejes:', error);
        }
    },
    
    /**
     * Configurar rango del eje Y
     * @param {number} min - Valor mínimo
     * @param {number} max - Valor máximo
     */
    setYAxisRange(min, max) {
        if (!this.chart) {
            return;
        }
        
        try {
            this.chart.options.scales.y.min = min;
            this.chart.options.scales.y.max = max;
            
            this.chart.update();
            
            console.log(`Rango del eje Y configurado: ${min} a ${max}`);
            
        } catch (error) {
            console.error('Error configurando rango del eje Y:', error);
        }
    },
    
    /**
     * Habilitar/deshabilitar zoom
     * @param {boolean} enabled - Habilitar zoom
     */
    setZoomEnabled(enabled) {
        this.config.zoom = enabled;
        console.log(`Zoom ${enabled ? 'habilitado' : 'deshabilitado'}`);
    },
    
    // ========================================================================
    // EXPORTACIÓN Y ANÁLISIS
    // ========================================================================
    
    /**
     * Exportar gráfico como imagen
     * @param {string} format - 'png' o 'jpeg'
     * @param {number} quality - Calidad de la imagen (0-1)
     * @returns {string} Data URL de la imagen
     */
    exportAsImage(format = 'png', quality = 0.9) {
        if (!this.chart) {
            console.error('No hay gráfico para exportar');
            return null;
        }
        
        try {
            const canvas = this.chart.canvas;
            const dataURL = canvas.toDataURL(`image/${format}`, quality);
            
            console.log(`Gráfico exportado como imagen ${format}`);
            return dataURL;
            
        } catch (error) {
            console.error('Error exportando gráfico:', error);
            return null;
        }
    },
    
    /**
     * Descargar gráfico como imagen
     * @param {string} filename - Nombre del archivo
     * @param {string} format - Formato de imagen
     */
    downloadAsImage(filename = 'huella_chart', format = 'png') {
        const dataURL = this.exportAsImage(format);
        
        if (dataURL) {
            const link = document.createElement('a');
            link.download = `${filename}.${format}`;
            link.href = dataURL;
            link.click();
            
            console.log(`Gráfico descargado: ${filename}.${format}`);
        }
    },
    
    /**
     * Obtener estadísticas de los datos actuales
     * @returns {Object} Estadísticas
     */
    getDataStatistics() {
        if (this.dataBuffer.x.length === 0) {
            return null;
        }
        
        try {
            const calculateStats = (data) => {
                const sorted = [...data].sort((a, b) => a - b);
                const sum = data.reduce((a, b) => a + b, 0);
                const mean = sum / data.length;
                const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
                
                return {
                    count: data.length,
                    min: Math.min(...data),
                    max: Math.max(...data),
                    mean: mean,
                    std: Math.sqrt(variance),
                    median: sorted[Math.floor(sorted.length / 2)],
                    p25: sorted[Math.floor(sorted.length * 0.25)],
                    p75: sorted[Math.floor(sorted.length * 0.75)]
                };
            };
            
            const stats = {
                x: calculateStats(this.dataBuffer.x),
                y: calculateStats(this.dataBuffer.y),
                z: calculateStats(this.dataBuffer.z),
                duration: this.dataBuffer.timestamps.length > 1 ? 
                    (this.dataBuffer.timestamps[this.dataBuffer.timestamps.length - 1] - this.dataBuffer.timestamps[0]) / 1000 : 0,
                sampleRate: this.dataBuffer.timestamps.length > 1 ? 
                    this.dataBuffer.x.length / ((this.dataBuffer.timestamps[this.dataBuffer.timestamps.length - 1] - this.dataBuffer.timestamps[0]) / 1000) : 0
            };
            
            return stats;
            
        } catch (error) {
            console.error('Error calculando estadísticas:', error);
            return null;
        }
    },
    
    // ========================================================================
    // UTILIDADES Y GESTIÓN
    // ========================================================================
    
    /**
     * Redimensionar gráfico
     */
    resize() {
        if (this.chart) {
            try {
                this.chart.resize();
                console.log('Gráfico redimensionado');
            } catch (error) {
                console.error('Error redimensionando gráfico:', error);
            }
        }
    },
    
    /**
     * Destruir gráfico y limpiar recursos
     */
    destroy() {
        if (this.chart) {
            try {
                this.chart.destroy();
                this.chart = null;
                console.log('Gráfico destruido');
            } catch (error) {
                console.error('Error destruyendo gráfico:', error);
            }
        }
        
        // Limpiar buffers y estado
        this.clearBuffer();
        this.isInitialized = false;
        this.realTimeMode = false;
        this.isUpdating = false;
        
        console.log('Chart Service destruido');
    },
    
    /**
     * Obtener configuración actual
     * @returns {Object}
     */
    getConfig() {
        return { ...this.config };
    },
    
    /**
     * Actualizar configuración
     * @param {Object} newConfig - Nueva configuración
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        if (this.chart) {
            // Aplicar cambios que requieren actualización del gráfico
            if (newConfig.gridLines !== undefined) {
                this.chart.options.scales.x.grid.display = newConfig.gridLines;
                this.chart.options.scales.y.grid.display = newConfig.gridLines;
            }
            
            if (newConfig.legend !== undefined) {
                this.chart.options.plugins.legend.display = newConfig.legend;
            }
            
            if (newConfig.tooltips !== undefined) {
                this.chart.options.plugins.tooltip.enabled = newConfig.tooltips;
            }
            
            this.chart.update();
        }
        
        console.log('Configuración del gráfico actualizada:', newConfig);
    },
    
    /**
     * Obtener estado del servicio
     * @returns {Object}
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            canvasId: this.canvasId,
            realTimeMode: this.realTimeMode,
            dataPoints: this.dataBuffer.x.length,
            queueLength: this.updateQueue.length,
            isUpdating: this.isUpdating,
            config: this.config,
            colors: this.colors,
            calibrationFactors: this.calibrationFactors
        };
    },
    
    /**
     * Obtener datos actuales del buffer
     * @returns {Object}
     */
    getCurrentData() {
        return {
            timestamps: [...this.dataBuffer.timestamps],
            x: [...this.dataBuffer.x],
            y: [...this.dataBuffer.y],
            z: [...this.dataBuffer.z]
        };
    }
};

// ============================================================================
// EVENT LISTENERS GLOBALES
// ============================================================================

// Redimensionamiento automático
window.addEventListener('resize', () => {
    if (ChartService.isInitialized) {
        ChartService.resize();
    }
});

// Manejo de cambios de tema
document.addEventListener('themeChanged', (event) => {
    if (ChartService.isInitialized) {
        ChartService.updateTheme(event.detail.theme);
    }
});

// ============================================================================
// FUNCIONES HELPER PARA COMPATIBILIDAD
// ============================================================================

/**
 * Función helper para inicialización rápida
 */
function initChartService(canvasId, options = {}) {
    return ChartService.init(canvasId, options);
}

/**
 * Función helper para agregar datos
 */
function addChartData(x, y, z, timestamp = Date.now()) {
    ChartService.addDataPoint({ x, y, z, timestamp });
}

/**
 * Función helper para limpiar gráfico
 */
function clearChart() {
    ChartService.clearData();
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ChartService = ChartService;
    window.initChartService = initChartService;
    window.addChartData = addChartData;
    window.clearChart = clearChart;
}

console.log('Chart Service v3.0 cargado - Compatible con Chart.js y datos en tiempo real del ADXL355');
