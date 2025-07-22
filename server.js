/*
 * PWA Controlador del Sensor CTIM3 por BLE de Huella Estructural y Symbiot Technologies
 * Archivo: server.js
 * Descripción: Servidor Express optimizado para Azure Web Apps con Node.js 20
 * Versión: 3.0.0
 * Compatible con: Azure Web Apps, IIS, Node.js 20+, Firmware CTIM3 v2.3.016
 * Service: huella-ble-control-20250716130811.azurewebsites.net
 * Resource Group: rg-huella-ble-pwa
 * Fecha: 2025-07-22
 */

const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');

// ============================================================================
// CONFIGURACIÓN DE LA APLICACIÓN
// ============================================================================

const app = express();

// Puerto de Azure (dinámico) o 8080 por defecto
const port = process.env.PORT || 8080;

// Configuración de entorno
const isDevelopment = process.env.NODE_ENV !== 'production';
const isAzure = !!process.env.WEBSITE_SITE_NAME;

// Información de la aplicación
const appInfo = {
    name: 'HUELLA BLE Control PWA',
    version: '3.0.0',
    firmware: '2.3.016',
    platform: 'Azure Web Apps',
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    azureService: 'huella-ble-control-20250716130811.azurewebsites.net',
    resourceGroup: 'rg-huella-ble-pwa'
};

console.log('='.repeat(80));
console.log(`🚀 Iniciando ${appInfo.name} v${appInfo.version}`);
console.log(`📡 Compatible con Firmware CTIM3 v${appInfo.firmware}`);
console.log(`☁️  Azure Service: ${appInfo.azureService}`);
console.log(`📦 Node.js: ${appInfo.nodeVersion}`);
console.log(`🌍 Environment: ${appInfo.environment}`);
console.log('='.repeat(80));

// ============================================================================
// MIDDLEWARE DE SEGURIDAD Y PERFORMANCE
// ============================================================================

// Compresión gzip para mejor rendimiento
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// Helmet para headers de seguridad con configuración específica para PWA
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: [
                "'self'", 
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com"
            ],
            scriptSrc: [
                "'self'", 
                "'unsafe-inline'",
                "https://code.jquery.com",
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com"
            ],
            imgSrc: [
                "'self'", 
                "data:", 
                "blob:",
                "https:"
            ],
            connectSrc: [
                "'self'",
                "https:",
                "wss:",
                "blob:"
            ],
            fontSrc: [
                "'self'",
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com",
                "data:"
            ],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "blob:", "data:"],
            frameSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// CORS específico para desarrollo local y Azure
const corsOptions = {
    origin: function (origin, callback) {
        // Permitir requests sin origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // Lista de orígenes permitidos
        const allowedOrigins = [
            'http://localhost:8080',
            'https://localhost:8080',
            'http://127.0.0.1:8080',
            'https://127.0.0.1:8080',
            'https://huella-ble-control-20250716130811.azurewebsites.net'
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`CORS: Origin no permitido: ${origin}`);
            callback(null, true); // Permitir por ahora para desarrollo
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Middleware de logging mejorado
app.use((req, res, next) => {
    const start = Date.now();
    const timestamp = new Date().toISOString();
    
    // Log de request
    console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip || 'unknown'}`);
    
    // Log de response al completarse
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const statusIcon = status >= 400 ? '❌' : status >= 300 ? '⚠️' : '✅';
        
        console.log(`${statusIcon} [${timestamp}] ${req.method} ${req.url} - ${status} (${duration}ms)`);
    });
    
    next();
});

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================================
// HEADERS ESPECÍFICOS PARA PWA
// ============================================================================

app.use((req, res, next) => {
    // Headers de seguridad adicionales
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    
    // Headers específicos para PWA
    res.setHeader('Service-Worker-Allowed', '/');
    
    // Permissions Policy para Web Bluetooth
    res.setHeader('Permissions-Policy', [
        'bluetooth=*',
        'accelerometer=()',
        'camera=()',
        'geolocation=()',
        'gyroscope=()',
        'magnetometer=()',
        'microphone=()',
        'payment=()',
        'usb=()'
    ].join(', '));
    
    // Headers de PWA específicos
    res.setHeader('X-PWA-Version', appInfo.version);
    res.setHeader('X-Firmware-Compatibility', appInfo.firmware);
    
    // Cache control estratégico
    if (req.url.endsWith('.html') || req.url === '/') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    } else if (req.url.match(/\.(js|css|json)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hora
    } else if (req.url.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 día
    } else {
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutos por defecto
    }
    
    next();
});

// ============================================================================
// RUTAS DE LA API
// ============================================================================

// Ruta de salud/health check para Azure
app.get('/health', (req, res) => {
    const healthCheck = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: appInfo.azureService,
        version: appInfo.version,
        firmware: appInfo.firmware,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: appInfo.environment,
        nodeVersion: appInfo.nodeVersion
    };
    
    res.status(200).json(healthCheck);
});

// Ruta de información de la aplicación
app.get('/api/info', (req, res) => {
    res.json({
        ...appInfo,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        capabilities: {
            webBluetooth: true,
            pwa: true,
            offline: true,
            realTimeData: true,
            dataExport: true
        },
        supportedDevices: {
            firmware: appInfo.firmware,
            platform: 'ESP32-S3-DEVKITC-1 (N8R8)',
            sensor: 'ADXL355 Accelerometer',
            bleService: '12345678-1234-5678-1234-56789abcdef0'
        }
    });
});

// Ruta para verificar compatibilidad del navegador
app.post('/api/browser-check', (req, res) => {
    const userAgent = req.headers['user-agent'] || '';
    const capabilities = req.body;
    
    const browserInfo = {
        userAgent: userAgent,
        isChrome: userAgent.includes('Chrome'),
        isEdge: userAgent.includes('Edge'),
        isFirefox: userAgent.includes('Firefox'),
        isSafari: userAgent.includes('Safari') && !userAgent.includes('Chrome'),
        isMobile: /Mobile|Android|iPhone|iPad/.test(userAgent),
        webBluetoothSupported: capabilities?.webBluetooth || false,
        serviceWorkerSupported: capabilities?.serviceWorker || false,
        httpsEnabled: req.secure || req.headers['x-forwarded-proto'] === 'https'
    };
    
    const isCompatible = (browserInfo.isChrome || browserInfo.isEdge) && 
                        browserInfo.webBluetoothSupported && 
                        browserInfo.httpsEnabled;
    
    res.json({
        compatible: isCompatible,
        browserInfo: browserInfo,
        recommendations: isCompatible ? [] : [
            !browserInfo.httpsEnabled && 'Se requiere HTTPS para Web Bluetooth',
            !browserInfo.webBluetoothSupported && 'Use Chrome o Edge para soporte completo de Web Bluetooth',
            browserInfo.isSafari && 'Safari tiene soporte limitado para Web Bluetooth'
        ].filter(Boolean)
    });
});

// ============================================================================
// ARCHIVOS ESTÁTICOS CON CONFIGURACIÓN OPTIMIZADA
// ============================================================================

// Configuración específica para archivos estáticos
const staticOptions = {
    maxAge: isDevelopment ? 0 : '1d',
    etag: true,
    lastModified: true,
    index: false, // No servir automáticamente index.html desde directorios
    dotfiles: 'deny',
    setHeaders: (res, path, stat) => {
        // MIME types específicos para PWA
        if (path.endsWith('manifest.json')) {
            res.setHeader('Content-Type', 'application/manifest+json');
            res.setHeader('Cache-Control', 'no-cache');
        } else if (path.endsWith('service-worker.js')) {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Service-Worker-Allowed', '/');
            res.setHeader('Cache-Control', 'no-cache');
        } else if (path.endsWith('.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json');
        }
    }
};

// Servir archivos estáticos desde el directorio raíz
app.use(express.static(path.join(__dirname), staticOptions));

// ============================================================================
// RUTAS ESPECÍFICAS PARA PWA
// ============================================================================

// Ruta principal - servir index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'), (err) => {
        if (err) {
            console.error('Error sirviendo index.html:', err);
            res.status(500).send('Error interno del servidor');
        }
    });
});

// Manifest.json con headers correctos
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, 'manifest.json'), (err) => {
        if (err) {
            console.error('Error sirviendo manifest.json:', err);
            res.status(404).json({ error: 'Manifest no encontrado' });
        }
    });
});

// Service Worker con headers específicos
app.get('/service-worker.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'service-worker.js'), (err) => {
        if (err) {
            console.error('Error sirviendo service-worker.js:', err);
            res.status(404).send('Service Worker no encontrado');
        }
    });
});

// Favicon routes
app.get('/favicon.ico', (req, res) => {
    res.setHeader('Content-Type', 'image/x-icon');
    res.sendFile(path.join(__dirname, 'favicon.ico'), (err) => {
        if (err) {
            // Fallback a favicon.svg si .ico no existe
            res.setHeader('Content-Type', 'image/svg+xml');
            res.sendFile(path.join(__dirname, 'favicon.svg'), (err2) => {
                if (err2) {
                    res.status(404).send('Favicon no encontrado');
                }
            });
        }
    });
});

app.get('/favicon.svg', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.sendFile(path.join(__dirname, 'favicon.svg'), (err) => {
        if (err) {
            res.status(404).send('Favicon SVG no encontrado');
        }
    });
});

// Apple touch icon
app.get('/apple-touch-icon.png', (req, res) => {
    res.redirect(301, '/icon-192.png');
});

// ============================================================================
// SPA ROUTING - TODAS LAS RUTAS NO API VAN A INDEX.HTML
// ============================================================================

app.get('*', (req, res, next) => {
    // Skip si es un archivo con extensión (pero no .html)
    if (path.extname(req.url) && !req.url.endsWith('.html')) {
        return res.status(404).json({ 
            error: 'Archivo no encontrado',
            url: req.url,
            timestamp: new Date().toISOString()
        });
    }
    
    // Skip si es una ruta de API
    if (req.url.startsWith('/api/')) {
        return res.status(404).json({ 
            error: 'Endpoint de API no encontrado',
            url: req.url,
            availableEndpoints: ['/api/info', '/api/browser-check', '/health'],
            timestamp: new Date().toISOString()
        });
    }
    
    // Todas las demás rutas van a la SPA
    console.log(`SPA Route: ${req.url} -> index.html`);
    res.sendFile(path.join(__dirname, 'index.html'), (err) => {
        if (err) {
            console.error('Error sirviendo SPA:', err);
            res.status(500).send('Error interno del servidor');
        }
    });
});

// ============================================================================
// MANEJO DE ERRORES
// ============================================================================

// 404 handler
app.use((req, res) => {
    console.warn(`404 - Recurso no encontrado: ${req.method} ${req.url}`);
    res.status(404).json({
        error: 'Recurso no encontrado',
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString(),
        suggestion: 'Verifique la URL o consulte la documentación de la API'
    });
});

// Error handler global
app.use((err, req, res, next) => {
    console.error('Error interno del servidor:', err);
    
    // No exponer detalles del error en producción
    const errorDetails = isDevelopment ? {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
    } : {
        message: 'Error interno del servidor'
    };
    
    res.status(500).json({
        error: errorDetails,
        timestamp: new Date().toISOString(),
        service: appInfo.azureService
    });
});

// ============================================================================
// INICIO DEL SERVIDOR
// ============================================================================

const server = app.listen(port, () => {
    console.log('');
    console.log('✅ Servidor iniciado correctamente');
    console.log(`🌐 URL: http://localhost:${port}`);
    if (isAzure) {
        console.log(`☁️  Azure URL: https://${appInfo.azureService}`);
    }
    console.log(`📱 PWA disponible en: ${isAzure ? 'https' : 'http'}://${isAzure ? appInfo.azureService : `localhost:${port}`}`);
    console.log(`🔧 Environment: ${appInfo.environment}`);
    console.log(`📦 Node.js: ${appInfo.nodeVersion}`);
    console.log('');
    console.log('🚀 HUELLA BLE PWA v3.0 está listo para recibir conexiones');
    console.log('📡 Compatible con dispositivos CTIM3 v2.3.016');
    console.log('');
});

// ============================================================================
// MANEJO GRACEFUL DE CIERRE
// ============================================================================

// Manejo de señales de cierre
const gracefulShutdown = (signal) => {
    console.log(`\n📡 Señal ${signal} recibida`);
    console.log('🔄 Cerrando servidor gracefully...');
    
    server.close((err) => {
        if (err) {
            console.error('❌ Error cerrando servidor:', err);
            process.exit(1);
        }
        
        console.log('✅ Servidor cerrado correctamente');
        console.log('👋 HUELLA BLE PWA v3.0 desconectado');
        process.exit(0);
    });
    
    // Forzar cierre después de 10 segundos
    setTimeout(() => {
        console.error('⚠️  Forzando cierre del servidor...');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Manejo de errores no capturados
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

// ============================================================================
// INFORMACIÓN DE SISTEMA AL INICIO
// ============================================================================

console.log('📊 Información del sistema:');
console.log(`   - Platform: ${process.platform}`);
console.log(`   - Arch: ${process.arch}`);
console.log(`   - Node.js: ${process.version}`);
console.log(`   - Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
console.log(`   - PID: ${process.pid}`);
if (isAzure) {
    console.log(`   - Azure Site: ${process.env.WEBSITE_SITE_NAME}`);
    console.log(`   - Azure Resource Group: ${appInfo.resourceGroup}`);
}

module.exports = app;
