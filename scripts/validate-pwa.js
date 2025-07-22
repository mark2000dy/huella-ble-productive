#!/usr/bin/env node

/*
 * PWA Controlador del Sensor CTIM3 por BLE de Huella Estructural y Symbiot Technologies
 * Archivo: scripts/validate-pwa.js
 * Descripción: Script de validación completa para PWA v3.0
 * Versión: 3.0.0
 * Compatible con: Node.js 20+, Azure Web Apps, Firmware CTIM3 v2.3.016
 * Fecha: 2025-07-22
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// CONFIGURACIÓN DE VALIDACIÓN
// ============================================================================

const CONFIG = {
    version: '3.0.0',
    firmwareVersion: '2.3.016',
    nodeVersion: '20.0.0',
    azureService: 'huella-ble-control-20250716130811.azurewebsites.net',
    resourceGroup: 'rg-huella-ble-pwa'
};

const REQUIRED_FILES = [
    'index.html',
    'manifest.json',
    'service-worker.js',
    'package.json',
    'server.js',
    'web.config',
    'favicon.svg',
    'favicon.ico',
    '.gitignore',
    'README.md'
];

const REQUIRED_DIRECTORIES = [
    'css',
    'js'
];

const REQUIRED_CSS_FILES = [
    'css/app.css',
    'css/theme.css'
];

const REQUIRED_JS_FILES = [
    'js/app.js',
    'js/ble-service.js',
    'js/storage-service.js',
    'js/chart-service.js'
];

const REQUIRED_ICONS = [
    'icon-48.png',
    'icon-72.png',
    'icon-96.png',
    'icon-128.png',
    'icon-192.png',
    'icon-512.png'
];

// ============================================================================
// UTILIDADES DE LOGGING
// ============================================================================

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('');
    log('='.repeat(60), 'blue');
    log(`${title}`, 'bright');
    log('='.repeat(60), 'blue');
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
    log(`ℹ️  ${message}`, 'cyan');
}

// ============================================================================
// FUNCIONES DE VALIDACIÓN
// ============================================================================

function runTest(testName, testFunction) {
    try {
        const result = testFunction();
        if (result === true) {
            logSuccess(testName);
            return true;
        } else if (typeof result === 'string') {
            logError(`${testName}: ${result}`);
            return false;
        } else {
            logError(`${testName}: Test falló`);
            return false;
        }
    } catch (error) {
        logError(`${testName}: ${error.message}`);
        return false;
    }
}

function validateFileExists(filePath, required = true) {
    const exists = fs.existsSync(filePath);
    return exists ? true : required ? 'Archivo requerido no encontrado' : 'Archivo opcional no encontrado';
}

function validateJSONFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        JSON.parse(content);
        return true;
    } catch (error) {
        return `JSON inválido: ${error.message}`;
    }
}

function validateHTMLFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const hasDoctype = content.includes('<!DOCTYPE html>');
        const hasHtml = content.includes('<html');
        const hasHead = content.includes('<head>');
        const hasBody = content.includes('<body>');
        const hasViewport = content.includes('viewport');
        const hasManifest = content.includes('manifest.json');
        
        if (hasDoctype && hasHtml && hasHead && hasBody && hasViewport && hasManifest) {
            return true;
        } else {
            const missing = [];
            if (!hasDoctype) missing.push('DOCTYPE');
            if (!hasHtml) missing.push('html tag');
            if (!hasHead) missing.push('head tag');
            if (!hasBody) missing.push('body tag');
            if (!hasViewport) missing.push('viewport meta');
            if (!hasManifest) missing.push('manifest link');
            return `Estructura HTML incompleta: ${missing.join(', ')}`;
        }
    } catch (error) {
        return `Error leyendo HTML: ${error.message}`;
    }
}

function validateManifest() {
    try {
        const manifestContent = fs.readFileSync('manifest.json', 'utf8');
        const manifest = JSON.parse(manifestContent);
        
        const requiredFields = ['name', 'short_name', 'start_url', 'display', 'icons', 'theme_color', 'background_color'];
        const missingFields = requiredFields.filter(field => !manifest[field]);
        
        if (missingFields.length > 0) {
            return `Campos faltantes en manifest: ${missingFields.join(', ')}`;
        }
        
        // Verificar iconos requeridos
        const iconSizes = ['48', '72', '96', '128', '192', '512'];
        const missingIcons = iconSizes.filter(size => 
            !manifest.icons.some(icon => icon.sizes.includes(`${size}x${size}`))
        );
        
        if (missingIcons.length > 0) {
            return `Iconos faltantes en manifest: ${missingIcons.join(', ')}`;
        }
        
        // Verificar versión
        if (!manifest.version || manifest.version !== CONFIG.version) {
            return `Versión incorrecta en manifest: esperada ${CONFIG.version}, encontrada ${manifest.version}`;
        }
        
        return true;
        
    } catch (error) {
        return `Error validando manifest: ${error.message}`;
    }
}

function validateServiceWorker() {
    try {
        const swContent = fs.readFileSync('service-worker.js', 'utf8');
        
        const requiredElements = [
            'CACHE_NAME',
            'addEventListener',
            'install',
            'fetch',
            'activate'
        ];
        
        const missingElements = requiredElements.filter(element => 
            !swContent.includes(element)
        );
        
        if (missingElements.length > 0) {
            return `Elementos faltantes en Service Worker: ${missingElements.join(', ')}`;
        }
        
        // Verificar versión
        if (!swContent.includes(CONFIG.version)) {
            return `Versión incorrecta en Service Worker`;
        }
        
        return true;
        
    } catch (error) {
        return `Error validando Service Worker: ${error.message}`;
    }
}

function validatePackageJson() {
    try {
        const packageContent = fs.readFileSync('package.json', 'utf8');
        const packageJson = JSON.parse(packageContent);
        
        // Verificar versión de Node.js
        if (!packageJson.engines || !packageJson.engines.node) {
            return 'engines.node no especificado en package.json';
        }
        
        const nodeVersion = packageJson.engines.node;
        if (!nodeVersion.includes('20')) {
            return `Versión de Node.js incorrecta: ${nodeVersion}, se requiere 20+`;
        }
        
        // Verificar versión del proyecto
        if (packageJson.version !== CONFIG.version) {
            return `Versión incorrecta: esperada ${CONFIG.version}, encontrada ${packageJson.version}`;
        }
        
        // Verificar scripts requeridos
        const requiredScripts = ['start'];
        const missingScripts = requiredScripts.filter(script => 
            !packageJson.scripts || !packageJson.scripts[script]
        );
        
        if (missingScripts.length > 0) {
            return `Scripts faltantes: ${missingScripts.join(', ')}`;
        }
        
        return true;
        
    } catch (error) {
        return `Error validando package.json: ${error.message}`;
    }
}

function validateWebConfig() {
    try {
        const webConfigContent = fs.readFileSync('web.config', 'utf8');
        
        const requiredElements = [
            'iisnode',
            'rewrite',
            'staticContent',
            'handlers',
            'NODE|20'
        ];
        
        const missingElements = requiredElements.filter(element => 
            !webConfigContent.includes(element)
        );
        
        if (missingElements.length > 0) {
            return `Elementos faltantes en web.config: ${missingElements.join(', ')}`;
        }
        
        return true;
        
    } catch (error) {
        return `Error validando web.config: ${error.message}`;
    }
}

function validateCSS() {
    const cssFiles = REQUIRED_CSS_FILES;
    const missingFiles = cssFiles.filter(file => !fs.existsSync(file));
    
    if (missingFiles.length === 0) {
        try {
            // Verificar contenido básico de CSS
            const appCss = fs.readFileSync('css/app.css', 'utf8');
            const themeCss = fs.readFileSync('css/theme.css', 'utf8');
            
            const hasThemeVars = themeCss.includes(':root') && themeCss.includes('--');
            const hasAppStyles = appCss.includes('.header-main') || appCss.includes('.loading-overlay');
            
            if (hasThemeVars && hasAppStyles) {
                return true;
            } else {
                return 'CSS incompleto - faltan estilos requeridos';
            }
        } catch (error) {
            return 'Error leyendo archivos CSS';
        }
    } else {
        return `Archivos CSS faltantes: ${missingFiles.join(', ')}`;
    }
}

function validateJavaScript() {
    const jsFiles = REQUIRED_JS_FILES;
    const missingFiles = jsFiles.filter(file => !fs.existsSync(file));
    
    if (missingFiles.length === 0) {
        try {
            // Verificar que cada archivo tenga el encabezado correcto
            const hasCorrectHeaders = jsFiles.every(file => {
                const content = fs.readFileSync(file, 'utf8');
                return content.includes('Symbiot Technologies') &&
                       content.includes('3.0.0');
            });
            
            if (hasCorrectHeaders) {
                return true;
            } else {
                return 'Algunos archivos JS no tienen el encabezado correcto';
            }
        } catch (error) {
            return 'Error leyendo archivos JavaScript';
        }
    } else {
        return `Archivos JS faltantes: ${missingFiles.join(', ')}`;
    }
}

function validateBLEService() {
    try {
        const bleContent = fs.readFileSync('js/ble-service.js', 'utf8');
        
        const requiredElements = [
            'BLEService',
            'BLE_CONFIG',
            '12345678-1234-5678-1234-56789abcdef0',
            'navigator.bluetooth',
            'startStreaming',
            'authenticate'
        ];
        
        const missingElements = requiredElements.filter(element => 
            !bleContent.includes(element)
        );
        
        if (missingElements.length > 0) {
            return `Elementos faltantes en BLE Service: ${missingElements.join(', ')}`;
        }
        
        // Verificar compatibilidad con firmware
        if (!bleContent.includes(CONFIG.firmwareVersion)) {
            return `Compatibilidad con firmware ${CONFIG.firmwareVersion} no verificada`;
        }
        
        return true;
        
    } catch (error) {
        return `Error validando BLE Service: ${error.message}`;
    }
}

function validateIcons() {
    const missingIcons = REQUIRED_ICONS.filter(icon => 
        !fs.existsSync(icon)
    );
    
    if (missingIcons.length === 0) {
        return true;
    } else {
        return `Iconos PNG faltantes: ${missingIcons.join(', ')}`;
    }
}

function validateServerJS() {
    try {
        const serverContent = fs.readFileSync('server.js', 'utf8');
        
        const requiredElements = [
            'express',
            'PORT',
            'process.env.PORT',
            'app.listen',
            'manifest.json',
            'service-worker.js'
        ];
        
        const missingElements = requiredElements.filter(element => 
            !serverContent.includes(element)
        );
        
        if (missingElements.length > 0) {
            return `Elementos faltantes en server.js: ${missingElements.join(', ')}`;
        }
        
        return true;
        
    } catch (error) {
        return `Error validando server.js: ${error.message}`;
    }
}

function checkNodeVersion() {
    try {
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
        
        if (majorVersion >= 20) {
            return true;
        } else {
            return `Node.js versión incorrecta: ${nodeVersion}, se requiere 20+`;
        }
    } catch (error) {
        return `Error verificando versión de Node.js: ${error.message}`;
    }
}

function checkNpmPackages() {
    try {
        // Verificar que node_modules existe
        if (!fs.existsSync('node_modules')) {
            return 'node_modules no encontrado - ejecutar npm install';
        }
        
        // Verificar dependencias críticas
        const criticalDeps = ['express', 'compression', 'helmet'];
        const missingDeps = criticalDeps.filter(dep => 
            !fs.existsSync(`node_modules/${dep}`)
        );
        
        if (missingDeps.length > 0) {
            return `Dependencias faltantes: ${missingDeps.join(', ')}`;
        }
        
        return true;
        
    } catch (error) {
        return `Error verificando paquetes npm: ${error.message}`;
    }
}

function validateAzureConfig() {
    try {
        // Verificar que azuredeploy.json existe y es válido
        if (fs.existsSync('azuredeploy.json')) {
            const azureConfig = JSON.parse(fs.readFileSync('azuredeploy.json', 'utf8'));
            
            if (!azureConfig.resources || azureConfig.resources.length === 0) {
                return 'azuredeploy.json no tiene recursos definidos';
            }
            
            // Verificar que incluye Node.js 20
            const configString = JSON.stringify(azureConfig);
            if (!configString.includes('20') && !configString.includes('NODE')) {
                return 'azuredeploy.json no está configurado para Node.js 20';
            }
        }
        
        return true;
        
    } catch (error) {
        return `Error validando configuración Azure: ${error.message}`;
    }
}

// ============================================================================
// FUNCIÓN PRINCIPAL DE VALIDACIÓN
// ============================================================================

function runAllValidations() {
    let totalTests = 0;
    let passedTests = 0;
    
    logSection('🚀 HUELLA BLE PWA v3.0 - VALIDACIÓN COMPLETA');
    logInfo(`Versión: ${CONFIG.version}`);
    logInfo(`Firmware: ${CONFIG.firmwareVersion}`);
    logInfo(`Azure Service: ${CONFIG.azureService}`);
    logInfo(`Resource Group: ${CONFIG.resourceGroup}`);
    
    // 1. Verificación del entorno
    logSection('🔧 ENTORNO DE DESARROLLO');
    totalTests++; if (runTest('Node.js versión 20+', checkNodeVersion)) passedTests++;
    totalTests++; if (runTest('Paquetes npm instalados', checkNpmPackages)) passedTests++;
    
    // 2. Archivos principales
    logSection('📄 ARCHIVOS PRINCIPALES');
    REQUIRED_FILES.forEach(file => {
        totalTests++;
        if (runTest(`${file} existe`, () => validateFileExists(file))) passedTests++;
    });
    
    // 3. Validación de contenido
    logSection('✅ VALIDACIÓN DE CONTENIDO');
    totalTests++; if (runTest('index.html es válido', () => validateHTMLFile('index.html'))) passedTests++;
    totalTests++; if (runTest('manifest.json es válido', () => validateManifest())) passedTests++;
    totalTests++; if (runTest('service-worker.js es válido', () => validateServiceWorker())) passedTests++;
    totalTests++; if (runTest('package.json es válido', () => validatePackageJson())) passedTests++;
    totalTests++; if (runTest('web.config es válido', () => validateWebConfig())) passedTests++;
    totalTests++; if (runTest('server.js es válido', () => validateServerJS())) passedTests++;
    
    // 4. Directorios
    logSection('📁 ESTRUCTURA DE DIRECTORIOS');
    REQUIRED_DIRECTORIES.forEach(dir => {
        totalTests++;
        if (runTest(`Directorio ${dir}/ existe`, () => fs.existsSync(dir) ? true : 'Directorio no encontrado')) passedTests++;
    });
    
    // 5. Archivos CSS
    logSection('🎨 ARCHIVOS CSS');
    totalTests++; if (runTest('Archivos CSS válidos', validateCSS)) passedTests++;
    
    // 6. Archivos JavaScript
    logSection('📜 ARCHIVOS JAVASCRIPT');
    totalTests++; if (runTest('Archivos JS válidos', validateJavaScript)) passedTests++;
    totalTests++; if (runTest('BLE Service compatible', validateBLEService)) passedTests++;
    
    // 7. Iconos y assets
    logSection('🎨 ICONOS Y ASSETS');
    totalTests++; if (runTest('favicon.svg existe', () => validateFileExists('favicon.svg'))) passedTests++;
    totalTests++; if (runTest('favicon.ico existe', () => validateFileExists('favicon.ico', false))) passedTests++;
    totalTests++; if (runTest('Iconos PNG completos', validateIcons)) passedTests++;
    
    // 8. Configuración Azure
    logSection('☁️  CONFIGURACIÓN AZURE');
    totalTests++; if (runTest('Configuración Azure válida', validateAzureConfig)) passedTests++;
    
    // 9. Resumen final
    logSection('📊 RESUMEN DE VALIDACIÓN');
    
    const percentage = Math.round((passedTests / totalTests) * 100);
    
    log('');
    logInfo(`Tests ejecutados: ${totalTests}`);
    logInfo(`Tests pasados: ${passedTests}`);
    logInfo(`Tests fallidos: ${totalTests - passedTests}`);
    logInfo(`Porcentaje de éxito: ${percentage}%`);
    
    if (percentage === 100) {
        log('');
        logSuccess('🎉 ¡VALIDACIÓN COMPLETA EXITOSA!');
        logSuccess('✅ El PWA está listo para deployment en Azure');
        logSuccess('🚀 Compatible con Firmware CTIM3 v2.3.016');
        log('');
    } else if (percentage >= 90) {
        log('');
        logWarning('⚠️  Validación mayormente exitosa con advertencias menores');
        logInfo('🔧 Revisar y corregir los tests fallidos antes del deployment');
        log('');
    } else {
        log('');
        logError('❌ VALIDACIÓN FALLÓ');
        logError('🛠️  Se requieren correcciones antes del deployment');
        log('');
        process.exit(1);
    }
    
    return percentage === 100;
}

// ============================================================================
// EJECUCIÓN DEL SCRIPT
// ============================================================================

if (require.main === module) {
    console.clear();
    
    log('', 'bright');
    log('██╗  ██╗██╗   ██╗███████╗██╗     ██╗      █████╗     ██████╗ ██╗     ███████╗', 'blue');
    log('██║  ██║██║   ██║██╔════╝██║     ██║     ██╔══██╗    ██╔══██╗██║     ██╔════╝', 'blue');
    log('███████║██║   ██║█████╗  ██║     ██║     ███████║    ██████╔╝██║     █████╗  ', 'blue');
    log('██╔══██║██║   ██║██╔══╝  ██║     ██║     ██╔══██║    ██╔══██╗██║     ██╔══╝  ', 'blue');
    log('██║  ██║╚██████╔╝███████╗███████╗███████╗██║  ██║    ██████╔╝███████╗███████╗', 'blue');
    log('╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝    ╚═════╝ ╚══════╝╚══════╝', 'blue');
    log('', 'bright');
    log('PWA Controlador del Sensor CTIM3 por BLE', 'cyan');
    log('Huella Estructural - Symbiot Technologies', 'cyan');
    log('', 'bright');
    
    const success = runAllValidations();
    process.exit(success ? 0 : 1);
}

module.exports = {
    runAllValidations,
    validateManifest,
    validateServiceWorker,
    validateBLEService,
    CONFIG
};
