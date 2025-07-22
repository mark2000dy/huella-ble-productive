# 🚀 HUELLA BLE Control PWA v3.0

**PWA Controlador del Sensor CTIM3 por BLE de Huella Estructural y Symbiot Technologies**

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](https://github.com/symbiot-technologies/huella-ble-control-pwa)
[![Firmware](https://img.shields.io/badge/firmware-2.3.016-green.svg)](https://github.com/symbiot-technologies/ctim3-firmware)
[![Node.js](https://img.shields.io/badge/node.js-20+-brightgreen.svg)](https://nodejs.org/)
[![Azure](https://img.shields.io/badge/azure-web%20apps-blue.svg)](https://azure.microsoft.com/en-us/services/app-service/web/)
[![PWA](https://img.shields.io/badge/PWA-ready-purple.svg)](https://web.dev/progressive-web-apps/)
[![Bluetooth](https://img.shields.io/badge/Web%20Bluetooth-enabled-blue.svg)](https://webbluetoothcg.github.io/web-bluetooth/)

---

## 📱 **¿Qué es HUELLA BLE PWA?**

HUELLA BLE Control es una **Progressive Web App (PWA)** diseñada para conectar, controlar y monitorear dispositivos **CTIM3** (Controlador de Transducción Inteligente para Monitoreo 3-Axis) a través de **Bluetooth Low Energy (BLE)**.

### 🎯 **Características Principales**

- 🔵 **Conexión BLE nativa** sin necesidad de aplicaciones adicionales
- 📊 **Monitoreo en tiempo real** de datos del acelerómetro ADXL355
- 📱 **PWA completa** - funciona como app nativa en móviles
- 🌙 **Modo oscuro/claro** adaptativo
- 💾 **Almacenamiento offline** con IndexedDB
- 📈 **Gráficos interactivos** en tiempo real
- 📥 **Exportación de datos** en CSV/JSON
- ⚙️ **Configuración remota** del sensor
- 🔒 **Autenticación segura** por PIN

---

## 🏗️ **Arquitectura Técnica**

### **Hardware Compatible**
- **Platform**: ESP32-S3-DEVKITC-1 (N8R8)
- **Sensor**: ADXL355 3-Axis Accelerometer
- **Firmware**: CTIM3 v2.3.016
- **Conectividad**: Bluetooth Low Energy 5.0

### **Software Stack**
- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Backend**: Node.js 20+ con Express
- **Charts**: Chart.js para visualización
- **Storage**: IndexedDB + localStorage
- **PWA**: Service Worker + Web App Manifest
- **Cloud**: Azure Web Apps
- **Protocols**: Web Bluetooth API

---

## 🚀 **Inicio Rápido**

### **Acceso Directo (Recomendado)**

1. 🌐 **Abrir en navegador**: [https://huella-ble-control-20250716130811.azurewebsites.net](https://huella-ble-control-20250716130811.azurewebsites.net)
2. 📱 **Instalar PWA**: Clic en "Instalar" cuando aparezca el prompt
3. 🔵 **Conectar dispositivo**: Botón "Buscar Dispositivos" 
4. 🔐 **Autenticar**: PIN por defecto `123456`
5. 📊 **Monitorear**: Ir a pestaña "Datos" y comenzar streaming

### **Desarrollo Local**

```bash
# Clonar repositorio
git clone https://github.com/symbiot-technologies/huella-ble-control-pwa.git
cd huella-ble-control-pwa

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm start

# Abrir en navegador
open https://localhost:8080
```

> ⚠️ **Importante**: Web Bluetooth requiere HTTPS o localhost

---

## 📋 **Requisitos del Sistema**

### **Navegadores Soportados**
| Navegador | Desktop | Mobile | Web Bluetooth |
|-----------|---------|--------|---------------|
| Chrome 80+ | ✅ | ✅ | ✅ |
| Edge 80+ | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ❌ |
| Safari | ✅ | ✅ | ❌ |

### **Sistemas Operativos**
- **Windows 10+** (Bluetooth LE compatible)
- **macOS 10.15+** (Bluetooth LE compatible)
- **Android 6.0+** (Chrome/Edge)
- **iOS 13.4+** (limitado - sin Web Bluetooth)

### **Hardware Mínimo**
- **RAM**: 4GB mínimo, 8GB recomendado
- **Bluetooth**: 4.0+ compatible
- **Conexión**: HTTPS obligatorio (excepto localhost)

---

## 🔧 **Configuración del Dispositivo**

### **Especificaciones CTIM3**

```json
{
  "firmware": "2.3.016",
  "platform": "ESP32-S3-DEVKITC-1 (N8R8)",
  "sensor": {
    "model": "ADXL355",
    "type": "3-Axis Accelerometer",
    "range": "±2g, ±4g, ±8g",
    "resolution": "20-bit",
    "frequencies": [125, 250, 500, 1000]
  },
  "connectivity": {
    "bluetooth": "BLE 5.0",
    "wifi": "802.11 b/g/n",
    "range": "10-50m (BLE)"
  }
}
```

### **Comandos BLE Soportados**

| Comando | Descripción | Parámetros |
|---------|-------------|------------|
| `AUTH` | Autenticación | `pin: "123456"` |
| `START` | Iniciar sensor | - |
| `STOP` | Detener sensor | - |
| `STREAM_START` | Iniciar streaming | `duration: 30` |
| `STREAM_STOP` | Detener streaming | - |
| `GET_INFO` | Información del dispositivo | - |
| `GET_CONFIG` | Obtener configuración | - |
| `SET_CONFIG` | Establecer configuración | `config: {}` |

---

## 📊 **Uso de la Aplicación**

### **1. Dashboard Principal**
- 📱 **Estado de conexión** en tiempo real
- 🔋 **Información del dispositivo** (batería, temperatura)
- ⚙️ **Controles principales** (conectar, iniciar, detener)
- 📊 **Métricas del sistema** (Bluetooth, firmware, hardware)

### **2. Streaming de Datos**
```javascript
// Configurar duración
const duration = 30; // segundos

// Iniciar streaming
await BLEService.startStreaming(duration, (data) => {
  console.log(`X: ${data.x}g, Y: ${data.y}g, Z: ${data.z}g`);
});

// Los datos se muestran en gráfico en tiempo real
```

### **3. Configuración del Sensor**
- **Frecuencia**: 125, 250, 500, 1000 Hz
- **Rango**: ±2g, ±4g, ±8g
- **WiFi**: SSID y contraseña
- **Calibración**: Factores X, Y, Z

### **4. Exportación de Datos**
- **CSV**: Para análisis en Excel/MATLAB
- **JSON**: Para procesamiento programático
- **Imagen**: Capturas del gráfico

---

## 🔧 **API y Configuración**

### **BLE Service UUIDs**

```javascript
const BLE_CONFIG = {
  SERVICE_UUID: '12345678-1234-5678-1234-56789abcdef0',
  CHARACTERISTICS: {
    CMD: '12345678-1234-5678-1234-56789abcdef1',      // Write
    STATUS: '12345678-1234-5678-1234-56789abcdef2',   // Read/Notify
    DATA: '12345678-1234-5678-1234-56789abcdef3',     // Notify
    CONFIG: '12345678-1234-5678-1234-56789abcdef4',   // Read/Write
    INFO: '12345678-1234-5678-1234-56789abcdef5',     // Read
    PARAMS: '12345678-1234-5678-1234-56789abcdef6',   // Read/Write
    SYNC: '12345678-1234-5678-1234-56789abcdef7'      // Read
  }
};
```

### **Formato de Datos**

```json
{
  "timestamp": 1705123456789,
  "x": 0.0012,
  "y": -0.0034,
  "z": 0.9981,
  "temperature": 25.6,
  "battery": 87.2,
  "raw": {
    "x": 314572,
    "y": -891234,
    "z": 16155432
  }
}
```

### **Factores de Calibración ADXL355**

```javascript
const CALIBRATION_FACTORS = {
  X: 3.814697266E-06,  // LSB to g conversion
  Y: 3.814697266E-06,
  Z: 3.814697266E-06
};

// Conversión: accel_g = raw_value * calibration_factor
```

---

## 🏗️ **Estructura del Proyecto**

```
huella-ble-pwa/
├── 📄 index.html              # Página principal PWA
├── 📱 manifest.json           # Manifiesto PWA
├── ⚙️ service-worker.js       # Service Worker
├── 🖥️ server.js              # Servidor Express
├── ⚙️ web.config             # Configuración Azure/IIS
├── 📦 package.json           # Dependencias Node.js
├── 🎨 favicon.svg            # Icono vectorial
├── 📂 css/
│   ├── app.css               # Estilos principales
│   └── theme.css             # Sistema de temas
├── 📂 js/
│   ├── app.js                # Lógica principal
│   ├── ble-service.js        # Servicio BLE
│   ├── storage-service.js    # IndexedDB + localStorage
│   └── chart-service.js      # Gráficos tiempo real
├── 📂 icons/
│   ├── icon-48.png           # Iconos PWA
│   ├── icon-72.png
│   ├── icon-96.png
│   ├── icon-128.png
│   ├── icon-192.png
│   └── icon-512.png
└── 📄 README.md              # Documentación
```

---

## 🔒 **Seguridad y Privacidad**

### **Características de Seguridad**
- 🔐 **Autenticación PIN** de 6 dígitos
- 🔒 **HTTPS obligatorio** para Web Bluetooth
- 🛡️ **CSP headers** contra XSS
- 🚫 **Sin telemetría** - todos los datos son locales
- 💾 **Almacenamiento local** - sin datos en la nube

### **Privacidad de Datos**
- ✅ **Datos locales únicamente** - no se envían a servidores
- ✅ **Sin cookies de tracking**
- ✅ **Sin analytics externos**
- ✅ **Usuario controla exportación**

---

## 🌐 **Despliegue en Azure**

### **Configuración Azure Web Apps**

```yaml
# Configuración de aplicación
Runtime: Node.js 20-lts
OS: Linux
Resource Group: rg-huella-ble-pwa
Service Plan: B1 Basic
Region: East US
```

### **Variables de Entorno**

```bash
NODE_ENV=production
PORT=8080
WEBSITE_NODE_DEFAULT_VERSION=20.11.0
```

### **Comandos de Despliegue**

```bash
# Build para producción
npm run build

# Deploy a Azure (con Azure CLI)
az webapp deployment source config-zip \
  --resource-group rg-huella-ble-pwa \
  --name huella-ble-control-20250716130811 \
  --src huella-ble-pwa.zip
```

---

## 🔧 **Desarrollo y Contribución**

### **Scripts NPM Disponibles**

```bash
npm start          # Iniciar servidor de desarrollo
npm run build      # Build para producción  
npm test           # Ejecutar tests
npm run validate   # Validar PWA y manifest
npm run deploy     # Deploy a Azure
```

### **Configuración de Desarrollo**

```javascript
// Configuración local para desarrollo
const isDevelopment = process.env.NODE_ENV !== 'production';
const useLocalhost = true;
const enableDebugLogs = true;
const mockBLEDevice = false; // Para testing sin hardware
```

### **Testing**

```bash
# Test de compatibilidad BLE
npm run test-ble

# Test de PWA con Lighthouse
npm run test-pwa

# Validación de manifest
npm run validate-manifest
```

---

## 🐛 **Troubleshooting**

### **Problemas Comunes**

| Problema | Causa | Solución |
|----------|-------|----------|
| "Web Bluetooth no soportado" | Navegador incompatible | Usar Chrome/Edge en HTTPS |
| "Dispositivo no encontrado" | BLE desactivado | Activar Bluetooth y verificar rango |
| "Error de autenticación" | PIN incorrecto | Usar PIN correcto (default: 123456) |
| "Conexión inestable" | Interferencia/distancia | Acercarse al dispositivo (<10m) |
| "Datos no aparecen" | Sensor no iniciado | Verificar que sensor esté activo |

### **Logs de Debug**

```javascript
// Habilitar logs detallados
localStorage.setItem('huella_ble_debug', 'true');

// Ver logs en consola
console.log('BLE Status:', BLEService.getStatus());
console.log('Storage Info:', StorageService.getStorageInfo());
console.log('Chart Status:', ChartService.getStatus());
```

### **Reset de Configuración**

```javascript
// Limpiar datos locales
localStorage.clear();
StorageService.clearDatabase();
ChartService.clearData();

// Recargar aplicación
window.location.reload();
```

---

## 📈 **Roadmap y Futuras Características**

### **v3.1 (Q3 2025)**
- 🔄 **Sincronización automática** con la nube
- 📊 **Análisis FFT** en tiempo real
- 📱 **Notificaciones push** para alertas
- 🔧 **Calibración automática** del sensor

### **v3.2 (Q4 2025)**
- 🤖 **Machine Learning** para detección de anomalías
- 📡 **Multi-dispositivo** - conectar varios sensores
- 🗺️ **Geolocalización** de mediciones
- 📊 **Dashboard avanzado** con métricas complejas

### **v4.0 (2026)**
- 🌐 **API REST completa** para integración
- 🔗 **Integración con plataformas IoT**
- 📊 **Big Data analytics**
- 🤖 **IA predictiva** para mantenimiento

---

## 📚 **Documentación Técnica**

### **Referencias**
- 📘 [Web Bluetooth API](https://webbluetoothcg.github.io/web-bluetooth/)
- 📘 [PWA Best Practices](https://web.dev/progressive-web-apps/)
- 📘 [ADXL355 Datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/adxl355.pdf)
- 📘 [ESP32-S3 Technical Reference](https://www.espressif.com/sites/default/files/documentation/esp32-s3_technical_reference_manual_en.pdf)

### **Soporte Técnico**
- 📧 **Email**: support@symbiot.tech
- 🐛 **Issues**: [GitHub Issues](https://github.com/symbiot-technologies/huella-ble-control-pwa/issues)
- 📖 **Wiki**: [Documentación Completa](https://github.com/symbiot-technologies/huella-ble-control-pwa/wiki)
- 💬 **Chat**: [Slack Community](https://symbiot-tech.slack.com)

---

## 📄 **Licencia y Copyright**

```
Copyright (c) 2025 Symbiot Technologies
All rights reserved.

HUELLA BLE Control PWA v3.0
Controlador del Sensor CTIM3 por BLE
Huella Estructural - Symbiot Technologies

Esta es una aplicación propietaria de Symbiot Technologies.
El uso, distribución y modificación están sujetos a los
términos de la licencia comercial de Symbiot Technologies.

Para información sobre licencias comerciales, contactar:
licensing@symbiot.tech
```

---

## 🏆 **Créditos**

### **Equipo de Desarrollo**
- 👨‍💻 **Lead Developer**: Equipo Symbiot Technologies
- 🔬 **Firmware Engineer**: Especialista CTIM3
- 🎨 **UI/UX Designer**: Diseño PWA
- 🧪 **QA Engineer**: Testing y validación

### **Tecnologías Utilizadas**
- ⚡ **Node.js 20+** - Runtime de JavaScript
- 🌐 **Express.js** - Framework web
- 📊 **Chart.js** - Visualización de datos
- 🔵 **Web Bluetooth API** - Conectividad BLE
- 💾 **IndexedDB** - Almacenamiento local
- ☁️ **Azure Web Apps** - Cloud hosting
- 🎨 **Bootstrap 5** - Framework CSS

---

<div align="center">

## 🚀 **¡Comienza a Monitorear Hoy!**

[![Abrir PWA](https://img.shields.io/badge/🚀%20Abrir%20PWA-blue?style=for-the-badge)](https://huella-ble-control-20250716130811.azurewebsites.net)

### 🔗 **Enlaces Rápidos**
[📱 PWA](https://huella-ble-control-20250716130811.azurewebsites.net) • [📖 Docs](https://github.com/symbiot-technologies/huella-ble-control-pwa/wiki) • [🐛 Issues](https://github.com/symbiot-technologies/huella-ble-control-pwa/issues) • [💬 Support](mailto:support@symbiot.tech)

---

**Hecho con ❤️ por [Symbiot Technologies](https://symbiot.tech)**  
*Innovación en IoT y Monitoreo Estructural*

</div>
