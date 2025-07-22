/*
 * PWA Controlador del Sensor CTIM3 por BLE de Huella Estructural y Symbiot Technologies
 * Archivo: service-worker.js
 * Descripción: Service Worker optimizado para PWA con estrategias de cache robustas
 * Versión: 3.0.0
 * Compatible con: Firmware CTIM3 v2.3.016, Azure Web Apps, Node.js 20+
 * Fecha: 2025-07-22
 */

// ============================================================================
// CONFIGURACIÓN DEL SERVICE WORKER
// ============================================================================

const CACHE_NAME = 'huella-ble-v3.0.0';
const CACHE_VERSION = '3.0.0';

// Archivos críticos que DEBEN estar en cache para funcionamiento offline
const CRITICAL_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.ico'
];

// Archivos de la aplicación PWA
const APP_CACHE_URLS = [
  '/css/app.css',
  '/css/theme.css',
  '/js/app.js',
  '/js/ble-service.js',
  '/js/storage-service.js',
  '/js/chart-service.js'
];

// Iconos PWA (solo los que existen en el proyecto)
const ICON_CACHE_URLS = [
  '/icon-48.png',
  '/icon-72.png',
  '/icon-96.png',
  '/icon-128.png',
  '/icon-192.png',
  '/icon-512.png'
];

// Recursos externos (CDN) - Cache con estrategia de red primero
const EXTERNAL_URLS = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css',
  'https://code.jquery.com/jquery-3.7.0.min.js',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Todos los archivos para cache inicial
const ALL_CACHE_URLS = [
  ...CRITICAL_CACHE_URLS,
  ...APP_CACHE_URLS,
  ...ICON_CACHE_URLS
];

// Configuración de estrategias de cache
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
  CACHE_ONLY: 'cache-only'
};

// Configuración de timeouts
const NETWORK_TIMEOUT = 5000; // 5 segundos
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 horas

console.log(`[SW] HUELLA BLE Service Worker v${CACHE_VERSION} loading...`);

// ============================================================================
// INSTALACIÓN DEL SERVICE WORKER
// ============================================================================

self.addEventListener('install', event => {
  console.log(`[SW] Installing HUELLA BLE Service Worker v${CACHE_VERSION}`);
  
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('[SW] Cache opened successfully');
        
        // Cache crítico primero (debe funcionar para instalación exitosa)
        console.log('[SW] Caching critical resources...');
        const criticalPromises = CRITICAL_CACHE_URLS.map(async url => {
          try {
            await cache.add(url);
            console.log(`[SW] ✓ Cached critical: ${url}`);
          } catch (error) {
            console.warn(`[SW] ✗ Failed to cache critical resource ${url}:`, error.message);
            // No fallar la instalación por recursos críticos faltantes
          }
        });
        
        await Promise.allSettled(criticalPromises);
        
        // Cache de aplicación (mejor esfuerzo)
        console.log('[SW] Caching app resources...');
        const appPromises = APP_CACHE_URLS.map(async url => {
          try {
            await cache.add(url);
            console.log(`[SW] ✓ Cached app: ${url}`);
          } catch (error) {
            console.warn(`[SW] ✗ Failed to cache app resource ${url}:`, error.message);
          }
        });
        
        await Promise.allSettled(appPromises);
        
        // Cache de iconos (mejor esfuerzo)
        console.log('[SW] Caching icon resources...');
        const iconPromises = ICON_CACHE_URLS.map(async url => {
          try {
            await cache.add(url);
            console.log(`[SW] ✓ Cached icon: ${url}`);
          } catch (error) {
            console.warn(`[SW] ✗ Failed to cache icon ${url}:`, error.message);
          }
        });
        
        await Promise.allSettled(iconPromises);
        
        console.log('[SW] Installation completed successfully');
        
        // Activar inmediatamente para obtener control de la página
        return self.skipWaiting();
        
      } catch (error) {
        console.error('[SW] Installation failed:', error);
        // Continuar con la instalación aunque falle el cache
        return self.skipWaiting();
      }
    })()
  );
});

// ============================================================================
// ACTIVACIÓN DEL SERVICE WORKER
// ============================================================================

self.addEventListener('activate', event => {
  console.log(`[SW] Activating HUELLA BLE Service Worker v${CACHE_VERSION}`);
  
  event.waitUntil(
    (async () => {
      try {
        // Limpiar caches antiguos
        const cacheNames = await caches.keys();
        const deletePromises = cacheNames
          .filter(cacheName => 
            cacheName.startsWith('huella-ble-') && 
            cacheName !== CACHE_NAME
          )
          .map(async cacheName => {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          });
        
        await Promise.all(deletePromises);
        
        // Tomar control de todas las páginas abiertas
        await self.clients.claim();
        
        console.log('[SW] Activation completed successfully');
        
        // Notificar a los clientes sobre la activación
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: CACHE_VERSION
          });
        });
        
      } catch (error) {
        console.error('[SW] Activation failed:', error);
      }
    })()
  );
});

// ============================================================================
// MANEJO DE PETICIONES (FETCH)
// ============================================================================

self.addEventListener('fetch', event => {
  // Solo interceptar peticiones GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  const url = new URL(event.request.url);
  
  // Determinar estrategia según el tipo de recurso
  if (isCriticalResource(url)) {
    event.respondWith(handleCriticalResource(event.request));
  } else if (isAppResource(url)) {
    event.respondWith(handleAppResource(event.request));
  } else if (isExternalResource(url)) {
    event.respondWith(handleExternalResource(event.request));
  } else if (isHTMLRequest(event.request)) {
    event.respondWith(handleHTMLRequest(event.request));
  } else {
    // Estrategia por defecto: Network First con fallback a cache
    event.respondWith(handleDefaultRequest(event.request));
  }
});

// ============================================================================
// ESTRATEGIAS DE CACHE ESPECÍFICAS
// ============================================================================

/**
 * Manejo de recursos críticos - Cache First con Network Fallback
 */
async function handleCriticalResource(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log(`[SW] ✓ Serving critical from cache: ${request.url}`);
      return cachedResponse;
    }
    
    // Si no está en cache, intentar red
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
      console.log(`[SW] ✓ Cached critical from network: ${request.url}`);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error(`[SW] ✗ Failed to serve critical resource: ${request.url}`, error);
    return new Response('Critical resource unavailable', { status: 503 });
  }
}

/**
 * Manejo de recursos de aplicación - Stale While Revalidate
 */
async function handleAppResource(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    // Servir desde cache si está disponible
    const responsePromise = cachedResponse || fetch(request);
    
    // Actualizar cache en background si es necesario
    if (cachedResponse) {
      fetch(request)
        .then(networkResponse => {
          if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
            console.log(`[SW] ✓ Updated app resource in background: ${request.url}`);
          }
        })
        .catch(error => {
          console.warn(`[SW] ✗ Background update failed: ${request.url}`, error);
        });
    }
    
    return responsePromise;
    
  } catch (error) {
    console.error(`[SW] ✗ Failed to serve app resource: ${request.url}`, error);
    return new Response('App resource unavailable', { status: 503 });
  }
}

/**
 * Manejo de recursos externos - Network First con timeout
 */
async function handleExternalResource(request) {
  try {
    // Intentar red primero con timeout
    const networkPromise = fetch(request);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Network timeout')), NETWORK_TIMEOUT)
    );
    
    try {
      const networkResponse = await Promise.race([networkPromise, timeoutPromise]);
      
      if (networkResponse.ok) {
        // Cache recursos externos exitosos
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, networkResponse.clone());
        console.log(`[SW] ✓ Cached external resource: ${request.url}`);
      }
      
      return networkResponse;
      
    } catch (networkError) {
      // Fallback a cache si la red falla
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        console.log(`[SW] ✓ Serving external from cache (network failed): ${request.url}`);
        return cachedResponse;
      }
      
      throw networkError;
    }
    
  } catch (error) {
    console.error(`[SW] ✗ Failed to serve external resource: ${request.url}`, error);
    return new Response('External resource unavailable', { status: 503 });
  }
}

/**
 * Manejo de peticiones HTML - SPA Routing
 */
async function handleHTMLRequest(request) {
  try {
    // Para SPA, siempre servir index.html desde cache si está disponible
    const cache = await caches.open(CACHE_NAME);
    const indexResponse = await cache.match('/index.html') || await cache.match('/');
    
    if (indexResponse) {
      console.log(`[SW] ✓ Serving SPA route from cache: ${request.url}`);
      return indexResponse;
    }
    
    // Si no está en cache, intentar red
    const networkResponse = await fetch('/index.html');
    
    if (networkResponse.ok) {
      await cache.put('/index.html', networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error(`[SW] ✗ Failed to serve HTML: ${request.url}`, error);
    return new Response('Application unavailable', { 
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

/**
 * Manejo por defecto - Network First con Cache Fallback
 */
async function handleDefaultRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log(`[SW] ✓ Serving from cache (network failed): ${request.url}`);
      return cachedResponse;
    }
    
    console.error(`[SW] ✗ Failed to serve request: ${request.url}`, error);
    return new Response('Resource unavailable', { status: 503 });
  }
}

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

/**
 * Verificar si es un recurso crítico
 */
function isCriticalResource(url) {
  return CRITICAL_CACHE_URLS.some(resource => 
    url.pathname === resource || 
    url.pathname.endsWith(resource)
  );
}

/**
 * Verificar si es un recurso de aplicación
 */
function isAppResource(url) {
  return APP_CACHE_URLS.some(resource => 
    url.pathname === resource || 
    url.pathname.endsWith(resource)
  ) || ICON_CACHE_URLS.some(resource => 
    url.pathname === resource || 
    url.pathname.endsWith(resource)
  );
}

/**
 * Verificar si es un recurso externo (CDN)
 */
function isExternalResource(url) {
  return url.origin !== self.location.origin;
}

/**
 * Verificar si es una petición HTML
 */
function isHTMLRequest(request) {
  return request.method === 'GET' && 
         request.headers.get('accept')?.includes('text/html');
}

// ============================================================================
// MANEJO DE MENSAJES
// ============================================================================

self.addEventListener('message', event => {
  const { type, payload } = event.data || {};
  
  console.log(`[SW] Received message: ${type}`);
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0]?.postMessage({ 
          type: 'CACHE_STATUS', 
          payload: status 
        });
      });
      break;
      
    case 'CLEAR_CACHE':
      clearCache().then(success => {
        event.ports[0]?.postMessage({ 
          type: 'CACHE_CLEARED', 
          payload: success 
        });
      });
      break;
      
    case 'UPDATE_CACHE':
      updateCache().then(success => {
        event.ports[0]?.postMessage({ 
          type: 'CACHE_UPDATED', 
          payload: success 
        });
      });
      break;
      
    case 'PRECACHE_EXTERNALS':
      precacheExternals().then(success => {
        event.ports[0]?.postMessage({
          type: 'EXTERNALS_PRECACHED',
          payload: success
        });
      });
      break;
      
    default:
      console.log(`[SW] Unknown message type: ${type}`);
  }
});

/**
 * Obtener estado del cache
 */
async function getCacheStatus() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    
    const status = {
      cacheName: CACHE_NAME,
      version: CACHE_VERSION,
      cachedUrls: keys.length,
      urls: keys.map(req => req.url),
      timestamp: new Date().toISOString()
    };
    
    return status;
    
  } catch (error) {
    console.error('[SW] Error getting cache status:', error);
    return { error: error.message };
  }
}

/**
 * Limpiar cache
 */
async function clearCache() {
  try {
    const deleted = await caches.delete(CACHE_NAME);
    console.log(`[SW] Cache cleared: ${deleted}`);
    return deleted;
    
  } catch (error) {
    console.error('[SW] Error clearing cache:', error);
    return false;
  }
}

/**
 * Actualizar cache completo
 */
async function updateCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // Actualizar todos los recursos de aplicación
    const updatePromises = ALL_CACHE_URLS.map(async url => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          console.log(`[SW] ✓ Updated: ${url}`);
          return true;
        }
        return false;
      } catch (error) {
        console.warn(`[SW] ✗ Failed to update: ${url}`, error);
        return false;
      }
    });
    
    const results = await Promise.allSettled(updatePromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    
    console.log(`[SW] Cache update completed: ${successCount}/${ALL_CACHE_URLS.length} resources updated`);
    return successCount > 0;
    
  } catch (error) {
    console.error('[SW] Error updating cache:', error);
    return false;
  }
}

/**
 * Pre-cache recursos externos
 */
async function precacheExternals() {
  try {
    const cache = await caches.open(CACHE_NAME);
    
    const promises = EXTERNAL_URLS.map(async url => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          console.log(`[SW] ✓ Pre-cached external: ${url}`);
          return true;
        }
        return false;
      } catch (error) {
        console.warn(`[SW] ✗ Failed to pre-cache external: ${url}`, error);
        return false;
      }
    });
    
    const results = await Promise.allSettled(promises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    
    console.log(`[SW] External pre-cache completed: ${successCount}/${EXTERNAL_URLS.length} resources cached`);
    return successCount > 0;
    
  } catch (error) {
    console.error('[SW] Error pre-caching externals:', error);
    return false;
  }
}

// ============================================================================
// MANEJO DE ERRORES GLOBALES
// ============================================================================

self.addEventListener('error', event => {
  console.error('[SW] Global error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

// ============================================================================
// NOTIFICACIONES PUSH (PREPARADO PARA FUTURO)
// ============================================================================

self.addEventListener('push', event => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: 'Nuevo evento del sensor CTIM3',
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    tag: 'huella-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'view',
        title: 'Ver datos'
      },
      {
        action: 'dismiss', 
        title: 'Descartar'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('HUELLA BLE', options)
  );
});

console.log(`[SW] HUELLA BLE Service Worker v${CACHE_VERSION} loaded successfully`);
