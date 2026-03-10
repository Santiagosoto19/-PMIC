# 🖼️ Análisis Completo del Sistema PMIC

## Plataforma de Procesamiento Masivo de Imágenes Concurrente

> [!IMPORTANT]
> Este sistema es un **taller de sistemas distribuidos** enfocado en **hilos y procesos concurrentes**. Demuestra cómo procesar cientos de imágenes en paralelo usando un patrón **Pipeline + Colas + Workers**.

---

## 📌 ¿Qué hace este sistema en una frase?

**Recibe una lista de URLs de imágenes, las descarga, redimensiona, convierte a PNG y les pone marca de agua — todo DE FORMA CONCURRENTE usando múltiples workers que trabajan en paralelo a través de colas.**

---

## 🏗️ Arquitectura General

```mermaid
graph TB
    subgraph Frontend["🖥️ Frontend (HTML/CSS/JS)"]
        A["index.html<br/>Formulario de URLs + Workers"]
        B["status.html<br/>Dashboard en tiempo real"]
        C["historial.html<br/>Historial de jobs"]
    end
    
    subgraph Backend["⚙️ Backend (Node.js + Fastify)"]
        D["API REST<br/>POST /procesar<br/>GET /estado/:jobId<br/>GET /jobs"]
        E["JobManager<br/>Crea y lanza jobs"]
        F["Pipeline<br/>Orquesta las 4 etapas"]
        G["QueueManager<br/>4 colas encadenadas"]
        H["StateStore<br/>Estado en memoria + BD"]
        I["ErrorManager<br/>Manejo centralizado de errores"]
    end
    
    subgraph Workers["🔧 Workers Concurrentes"]
        W1["Workers Descarga<br/>(1-10 instancias)"]
        W2["Workers Redimensión<br/>(1-8 instancias)"]
        W3["Workers Conversión<br/>(1-8 instancias)"]
        W4["Workers Marca de Agua<br/>(1-8 instancias)"]
    end
    
    subgraph Storage["💾 Almacenamiento"]
        S1["storage/downloads"]
        S2["storage/resized"]
        S3["storage/converted"]
        S4["storage/watermarked"]
    end
    
    subgraph DB["🗄️ PostgreSQL"]
        T1["Tabla jobs"]
        T2["Tabla imagenes"]
    end
    
    A -->|POST /procesar| D
    B -->|GET /estado/:jobId| D
    C -->|GET /jobs| D
    D --> E --> F --> G
    G --> W1
    W1 -->|"empuja a 3 colas"| W2
    W1 -->|"al mismo tiempo"| W3
    W1 -->|"en paralelo"| W4
    W1 --> S1
    W2 --> S2
    W3 --> S3
    W4 --> S4
    H --> T1
    H --> T2
```

---

## 🔄 Flujo Completo del Sistema (Paso a Paso)

```mermaid
sequenceDiagram
    participant U as Usuario (Frontend)
    participant API as API REST (Fastify)
    participant JM as JobManager
    participant SS as StateStore
    participant P as Pipeline
    participant QM as QueueManager
    participant WD as Workers Descarga
    participant WR as Workers Redimensión
    participant WC as Workers Conversión
    participant WM as Workers Marca Agua
    participant BD as PostgreSQL

    U->>API: POST /procesar {urls, workers}
    API->>JM: crearYLanzarJob(urls, workers)
    JM->>SS: crearJob(jobId, urls, workers)
    SS->>BD: INSERT INTO jobs (...)
    SS->>BD: INSERT INTO imagenes (N registros)
    SS-->>JM: workItems[]
    
    Note over JM: ⚡ Sin await — retorna inmediatamente
    JM->>P: ejecutarPipeline(jobId, workItems, config)
    JM-->>API: jobId
    API-->>U: 202 {jobId, estado: "EN_PROCESO"}
    
    Note over P: Pipeline corre en segundo plano
    P->>QM: Crear 4 colas nuevas
    P->>WD: Lanzar N workers descarga
    P->>WR: Lanzar N workers redimensión
    P->>WC: Lanzar N workers conversión
    P->>WM: Lanzar N workers marca agua
    P->>QM: cola.descarga.pushMuchos(workItems)
    
    loop Para cada imagen
        QM-->>WD: itemDisponible (evento)
        WD->>WD: Descargar imagen de URL
        WD->>SS: registrarResultado("descarga", ...)
        SS->>BD: UPDATE imagenes, UPDATE jobs
        WD->>QM: cola.redimension.push(item)
        
        QM-->>WR: itemDisponible (evento)
        WR->>WR: Redimensionar con Sharp
        WR->>SS: registrarResultado("redimension", ...)
        WR->>QM: cola.conversion.push(item)
        
        QM-->>WC: itemDisponible (evento)
        WC->>WC: Convertir a PNG con Sharp
        WC->>SS: registrarResultado("conversion", ...)
        WC->>QM: cola.marcaAgua.push(item)
        
        QM-->>WM: itemDisponible (evento)
        WM->>WM: Aplicar marca de agua SVG
        WM->>SS: registrarResultado("marcaAgua", ...)
    end
    
    P->>P: Esperar todas las colas vacías
    SS->>BD: Verificar si job completado → UPDATE estado final
    
    U->>API: GET /estado/:jobId (polling cada 2s)
    API->>SS: construirRespuestaEstado(jobId)
    SS-->>API: métricas + resumen
    API-->>U: {estado, métricas por etapa, resumen}
```

---

## 📂 Estructura del Proyecto

```
-PMIC/
├── backend/
│   ├── .env                          ← Variables de entorno
│   ├── package.json                  ← Dependencias (Fastify, Sharp, pg, etc.)
│   └── src/
│       ├── app.js                    ← 🚀 Punto de entrada: arranca todo
│       ├── server.js                 ← Configura Fastify (CORS, Swagger, rutas)
│       ├── config/
│       │   └── config.js             ← Lee variables de .env
│       ├── api/
│       │   ├── routes/
│       │   │   ├── index.js          ← Registra todas las rutas
│       │   │   ├── procesar.route.js ← POST /api/v1/procesar
│       │   │   ├── estado.route.js   ← GET  /api/v1/estado/:jobId
│       │   │   └── historial.route.js← GET  /api/v1/jobs
│       │   ├── controllers/
│       │   │   ├── procesar.controller.js  ← Lanzar nuevo job
│       │   │   ├── estado.controller.js    ← Consultar estado
│       │   │   └── historial.controller.js ← Listar historial
│       │   └── schemas/
│       │       ├── procesar.schema.js ← Validación del body
│       │       └── estado.schema.js   ← Validación de respuesta
│       ├── core/                      ← 🧠 CEREBRO DEL SISTEMA
│       │   ├── jobManager.js          ← Crea jobs y lanza pipeline
│       │   ├── pipeline.js            ← Orquesta las 4 etapas
│       │   ├── stateStore.js          ← Estado en memoria + BD
│       │   └── errorManager.js        ← Manejo centralizado de errores
│       ├── queues/
│       │   └── queueManager.js        ← 📬 Colas con eventos (CLAVE)
│       ├── workers/                   ← 👷 HILOS REALES DEL SO
│       │   ├── download.worker.js     ← Gestor de hilos de descarga
│       │   ├── download.thread.js     ← Código que corre DENTRO del hilo de descarga
│       │   ├── resize.worker.js       ← Gestor de hilos de redimensión
│       │   ├── resize.thread.js       ← Código que corre DENTRO del hilo de resize
│       │   ├── convert.worker.js      ← Gestor de hilos de conversión
│       │   ├── convert.thread.js      ← Código que corre DENTRO del hilo de convert
│       │   ├── watermark.worker.js    ← Gestor de hilos de marca de agua
│       │   └── watermark.thread.js    ← Código que corre DENTRO del hilo de watermark
│       ├── database/
│       │   ├── db.js                  ← Pool de conexiones PostgreSQL
│       │   ├── migrations.js          ← Crea tablas jobs + imagenes
│       │   └── repositories/
│       │       ├── job.repository.js     ← CRUD sobre tabla jobs
│       │       └── imagen.repository.js  ← CRUD sobre tabla imagenes
│       └── utils/
│           ├── file.utils.js          ← (vacío, reservado)
│           └── image.utils.js         ← (vacío, reservado)
│
└── frontend/
    ├── index.html         ← Formulario para enviar URLs
    ├── status.html        ← Dashboard de métricas en tiempo real
    ├── historial.html     ← Historial de todos los jobs
    ├── css/
    │   ├── styles.css     ← Estilos principales
    │   └── historial.css  ← Estilos del historial
    └── js/
        ├── api.js         ← Funciones fetch hacia la API
        ├── app.js         ← Lógica del formulario
        ├── metrics.js     ← Polling cada 2s para actualizar métricas
        └── historial.js   ← Carga y filtra historial de jobs
```

---

## 🧠 Componentes del Backend — Desmenuzados

### 1. `app.js` — Punto de Entrada

```javascript
async function start() {
  // 1. Crear carpetas de storage
  // 2. Conectar PostgreSQL (si falla → process.exit(1))
  // 3. Crear tablas (migraciones)
  // 4. Construir y arrancar servidor Fastify
}
```

**¿Qué hace?** Es el `main()` del sistema. Arranca en orden:
1. Crea las 4 carpetas de almacenamiento (`downloads`, `resized`, `converted`, `watermarked`)
2. Verifica que PostgreSQL esté accesible
3. Ejecuta las migraciones para crear las tablas
4. Levanta el servidor HTTP en el puerto 3000

---

### 2. `server.js` — Configuración de Fastify

**¿Qué hace?** Configura el framework web:
- **CORS** → Permite que el frontend (que corre en otro puerto/archivo) llame a la API
- **Swagger** → Documentación automática en `http://localhost:3000/docs`
- **Rutas** → Registra los 3 endpoints de la API
- **Error Handler** → Manejo global de errores de validación

---

### 3. `jobManager.js` — El Lanzador de Jobs

```javascript
class JobManager {
  async crearYLanzarJob(urls, workersConfig) {
    const jobId = uuidv4();                    // ID único
    const workItems = await stateStore.crearJob(jobId, urls, workersConfig);  // Persistir en BD
    
    // ⚡ CLAVE: Sin await → el pipeline corre en SEGUNDO PLANO
    ejecutarPipeline(jobId, workItems, workersConfig)
      .catch(error => { /* log error */ });
    
    return jobId;  // Retorna inmediatamente
  }
}
```

> [!TIP]
> **Concepto clave de concurrencia:** La línea `ejecutarPipeline(...)` se ejecuta **SIN `await`**. Esto significa que la API responde **inmediatamente** al usuario con el `jobId`, mientras el procesamiento pesado corre en segundo plano. Esto es el patrón **fire-and-forget** o **async job processing**.

---

### 4. `pipeline.js` — El Orquestador del Pipeline

```javascript
export async function ejecutarPipeline(jobId, workItems, workersConfig) {
  const qm    = new QueueManager();
  const total = workItems.length;

  // Decirle a cada cola cuántos items esperar
  qm.redimension.setEsperados(total);
  qm.conversion.setEsperados(total);
  qm.marcaAgua.setEsperados(total);

  // ⭐ Lanzar HILOS REALES del SO para las 4 etapas
  const hilosDescarga    = lanzarWorkersDescarga(n, jobId, qm);    // Retorna Worker[]
  const hilosRedimension = lanzarWorkersRedimension(n, jobId, qm);
  const hilosConversion  = lanzarWorkersConversion(n, jobId, qm);
  const hilosMarcaAgua   = lanzarWorkersMarcaAgua(n, jobId, qm);

  qm.descarga.pushMuchos(workItems);

  // ⭐⭐ LAS 4 ETAPAS CORREN EN PARALELO ⭐⭐
  await Promise.all([
    qm.descarga.esperarVacia(),
    qm.redimension.esperarVacia(),
    qm.conversion.esperarVacia(),
    qm.marcaAgua.esperarVacia(),
  ]);

  // Terminar TODOS los hilos del SO
  [...hilosDescarga, ...hilosRedimension, ...hilosConversion, ...hilosMarcaAgua]
    .forEach(t => t.terminate());
}
```

> [!IMPORTANT]
> **Esto es el CORAZÓN del sistema de concurrencia real.** Fíjate que:
> 1. Se crean **N hilos reales del SO** por etapa con `new Worker()` de `worker_threads`
> 2. Cada hilo tiene su propio **V8 engine**, **event loop** y **threadId**
> 3. Cuando un hilo de descarga termina, empuja a las **3 colas al mismo tiempo**
> 4. Resize, Convert y Watermark procesan sobre el **archivo descargado original en paralelo**
> 5. `Promise.all` espera las 4 etapas **simultáneamente** → paralelismo real

---

### 5. `queueManager.js` — Las Colas con Eventos (⭐ Pieza Central)

```mermaid
graph LR
    subgraph QueueManager
        Q1["Cola DESCARGA<br/>📥"]
        Q2["Cola REDIMENSIÓN<br/>📐"]
        Q3["Cola CONVERSIÓN<br/>🔄"]
        Q4["Cola MARCA AGUA<br/>💧"]
    end
    
    Q1 -->|"Al completar, push al siguiente"| Q2
    Q2 -->|"Al completar, push al siguiente"| Q3
    Q3 -->|"Al completar, push al siguiente"| Q4
    
    W1A["Worker D-1"] -.->|escucha| Q1
    W1B["Worker D-2"] -.->|escucha| Q1
    W1C["Worker D-3"] -.->|escucha| Q1
    
    W2A["Worker R-1"] -.->|escucha| Q2
    W2B["Worker R-2"] -.->|escucha| Q2
    
    W3A["Worker C-1"] -.->|escucha| Q3
    W3B["Worker C-2"] -.->|escucha| Q3
    
    W4A["Worker M-1"] -.->|escucha| Q4
    W4B["Worker M-2"] -.->|escucha| Q4
```

La clase `Queue` extiende `EventEmitter` y usa **dos eventos clave**:

| Evento | ¿Cuándo se emite? | ¿Quién escucha? |
|--------|-------------------|-----------------|
| `itemDisponible` | Cuando se hace `push()` o `pushMuchos()` | Los workers de esa etapa |
| `colaVacia` | Cuando no hay items pendientes ni activos | El pipeline, para saber que la etapa terminó |

```javascript
class Queue extends EventEmitter {
  push(item) {
    this._items.push(item);   // Agregar a la cola
    this._total += 1;
    this.emit('itemDisponible');  // ¡Despertar a un worker!
  }

  pop() {
    if (this._items.length === 0) return null;
    this._activos += 1;  // Marcar como "en procesamiento"
    return this._items.shift();  // FIFO
  }

  terminarItem() {
    this._activos -= 1;
    if (this._items.length === 0 && this._activos === 0) {
      this.emit('colaVacia');  // ¡Todos terminaron!
    }
  }

  esperarVacia() {
    return new Promise(resolve => {
      if (this.estaVacia) resolve();
      else this.once('colaVacia', resolve);
    });
  }
}
```

> [!NOTE]
> **Concepto de Sistemas Distribuidos:** Esto implementa el patrón **Producer-Consumer con colas de mensajes**. La cola desacopla a los productores (workers de la etapa anterior) de los consumidores (workers de la etapa actual). Los `EventEmitter` actúan como el mecanismo de **señalización/wake-up** para los "hilos".

---

### 6. Workers — Hilos REALES del Sistema Operativo

Cada worker es un **hilo real del SO** creado con `worker_threads` de Node.js. Hay 2 archivos por etapa:
- `.worker.js` → **Gestor** (crea hilos, conecta colas, maneja resultados)
- `.thread.js` → **Hilo** (el código que corre DENTRO del thread real del SO)

```javascript
// resize.worker.js — GESTOR: crea hilos reales
import { Worker } from 'worker_threads';

export function lanzarWorkersRedimension(n, jobId, qm) {
  const threads = [];
  for (let i = 1; i <= n; i++) {
    // ⭐ Crear HILO REAL del sistema operativo
    const thread = new Worker('./resize.thread.js', {
      workerData: { workerNombre: `Redimension-W${i}` }
    });

    thread.on('message', async (msg) => {
      await stateStore.registrarResultado(...);
      cola.terminarItem();
    });

    threads.push(thread);
  }
  return threads;  // ← Para poder terminarlos después
}
```

```javascript
// resize.thread.js — HILO: corre en un thread real del SO
import { parentPort, workerData, threadId } from 'worker_threads';
import sharp from 'sharp';

console.log(`[HILO] ${workerData.workerNombre} creado (threadId: ${threadId})`);

parentPort.on('message', async ({ item }) => {
  await sharp(item.rutaActual).resize(...).toFile(rutaSalida);
  parentPort.postMessage({ tipo: 'completado', item, resultado });
});
```

#### Las 4 Etapas (todas con hilos reales):

| Etapa | Gestor | Hilo | ¿Qué hace? | Tipo |
|-------|--------|------|------------|------|
| **Descarga** | `download.worker.js` | `download.thread.js` | `fetch()` + stream | **I/O-bound** |
| **Redimensión** | `resize.worker.js` | `resize.thread.js` | `sharp.resize()` | **CPU-bound** |
| **Conversión** | `convert.worker.js` | `convert.thread.js` | `sharp.png()` | **CPU-bound** |
| **Marca de agua** | `watermark.worker.js` | `watermark.thread.js` | `sharp.composite()` | **CPU-bound** |

> [!TIP]
> **Cada hilo tiene su propio V8 engine, event loop y threadId.** Se comunican con el hilo principal vía `postMessage()` / `parentPort`. Esto es paralelismo REAL a nivel del sistema operativo.

---

### 7. `stateStore.js` — Estado Dual (Memoria + BD)

```mermaid
graph LR
    subgraph Memoria["💨 Memoria (Map)"]
        M["this._jobs.get(jobId)<br/>→ Acceso ultra-rápido<br/>→ Se pierde si se reinicia"]
    end
    
    subgraph BD["🗄️ PostgreSQL"]
        B["Tabla jobs + imagenes<br/>→ Persistente<br/>→ Historial completo"]
    end
    
    W["Worker termina"] -->|registrarResultado| M
    W -->|registrarResultado| B
    
    API["API consulta estado"] -->|1. Buscar en memoria| M
    API -->|2. Si no está, buscar en BD| B
```

**¿Por qué doble?**
- **Memoria:** Para consultas rápidas del dashboard en tiempo real (polling cada 2 segundos)
- **BD:** Para persistencia, historial, y consultas cuando la app se reinicia

---

### 8. `errorManager.js` — Manejo de Errores Centralizado

```javascript
class ErrorManager {
  async registrarError(etapa, workItem, error, tiempoSeg) {
    // 1. Log en consola con contexto (etapa, jobId, imagenId, error)
    // 2. Registrar en stateStore (actualiza BD + memoria con estado ERROR_*)
    // 3. ¡El pipeline NO se detiene! → continúa con las demás imágenes
  }
}
```

> [!IMPORTANT]
> **Diseño resiliente:** Si una imagen falla en cualquier etapa, el error se registra pero el sistema **CONTINÚA procesando las demás imágenes**. No se detiene todo por un fallo individual. Esto es fundamental en sistemas distribuidos: **tolerancia a fallos parciales**.

---

## 🗄️ Base de Datos — Modelo de Datos

### Tabla `jobs`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `job_id` | TEXT PK | UUID del job |
| `estado` | TEXT | `EN_PROCESO`, `COMPLETADO`, `COMPLETADO_CON_ERRORES`, `FALLIDO` |
| `fecha_inicio` | TIMESTAMPTZ | Cuándo empezó |
| `fecha_fin` | TIMESTAMPTZ | Cuándo terminó |
| `urls_totales` | INTEGER | Cuántas URLs se recibieron |
| `workers_descarga` | INTEGER | N workers configurados para descarga |
| `workers_redimension` | INTEGER | N workers para redimensión |
| `workers_conversion` | INTEGER | N workers para conversión |
| `workers_marca_agua` | INTEGER | N workers para marca de agua |
| `desc_procesados/fallidos/tiempo_total` | - | Métricas acumuladas etapa 1 |
| `redi_procesados/fallidos/tiempo_total` | - | Métricas acumuladas etapa 2 |
| `conv_procesados/fallidos/tiempo_total` | - | Métricas acumuladas etapa 3 |
| `agua_procesados/fallidos/tiempo_total` | - | Métricas acumuladas etapa 4 |

### Tabla `imagenes`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `imagen_id` | TEXT PK | UUID de la imagen |
| `job_id` | TEXT FK → jobs | A qué job pertenece |
| `url_original` | TEXT | La URL de donde se descarga |
| `estado` | TEXT | `PENDIENTE` → `DESCARGADA` → `COMPLETADA` (cuando las 3 etapas paralelas terminan) |
| `ruta_descargada` | TEXT | Ruta del archivo descargado |
| `ruta_redimensionada` | TEXT | Ruta del archivo redimensionado |
| `ruta_convertida` | TEXT | Ruta del archivo convertido |
| `ruta_marca_agua` | TEXT | Ruta del archivo final |
| `error_*` | TEXT | Mensaje de error si falló en esa etapa |
| `worker_*` | TEXT | Nombre del worker que la procesó |
| `tiempo_*_seg` | NUMERIC | Cuánto tardó cada etapa |

---

## 🌐 API REST — Los 3 Endpoints

### `POST /api/v1/procesar`

**Propósito:** Iniciar un nuevo job de procesamiento

```json
// Request Body
{
  "urls": [
    "https://ejemplo.com/imagen1.jpg",
    "https://ejemplo.com/imagen2.png"
  ],
  "workers": {
    "descarga": 3,
    "redimension": 2,
    "conversion": 2,
    "marcaAgua": 2
  }
}

// Response 202 (Accepted)
{
  "jobId": "a1b2c3d4-...",
  "mensaje": "Pipeline iniciado correctamente",
  "totalImagenes": 2,
  "estado": "EN_PROCESO",
  "fechaInicio": "2026-03-09T..."
}
```

> Retorna **202 Accepted** (no 200 OK) porque el trabajo AÚN NO terminó, solo fue aceptado.

### `GET /api/v1/estado/:jobId`

**Propósito:** Consultar métricas en tiempo real de un job

```json
// Response 200
{
  "jobId": "a1b2c3d4-...",
  "estado": "EN_PROCESO",
  "tiempoTotalSeg": 12.45,
  "metricasDescarga": {
    "nombreEtapa": "DESCARGA",
    "totalProcesados": 15,
    "totalFallidos": 1,
    "tiempoAcumuladoSeg": 8.23,
    "tiempoPromedioSeg": 0.59
  },
  // ... métricas de las otras 3 etapas ...
  "resumenGlobal": {
    "totalRecibidos": 20,
    "totalConError": 2,
    "porcentajeExito": 90.0,
    "porcentajeFallo": 10.0
  }
}
```

### `GET /api/v1/jobs`

**Propósito:** Listar historial de todos los jobs procesados

---

## 🖥️ Frontend — Las 3 Páginas

### `index.html` — Formulario de envío
- TextArea para pegar URLs (una por línea)
- Contadores de workers ajustables con botones `+` / `−`
- Validaciones del lado del cliente (URLs válidas, máximo 500)
- Al enviar → guarda `jobId` en `sessionStorage` y redirige a `status.html`

### `status.html` — Dashboard en tiempo real
- Hace **polling** al endpoint `GET /estado/:jobId` **cada 2 segundos**
- Muestra barras de progreso por etapa
- Badge de estado: `EN PROCESO`, `COMPLETADO`, `CON ERRORES`, `FALLIDO`
- Resumen global: total, completadas, con error, % éxito, % fallo
- **Deja de hacer polling** cuando el estado es final

### `historial.html` — Historial de jobs
- Lista todos los jobs anteriores
- Filtros por texto (Job ID o URL) y por estado
- Acordeón para ver las URLs de cada job con indicador de estado (✓ OK / ✗ Error)
- Botón para ir al detalle de cualquier job

---

## 🔑 Conceptos de Sistemas Distribuidos Implementados

### 1. Patrón Pipeline con Fan-Out Paralelo

```
                         ┌→ [Cola RESIZE]    → Hilos R1, R2 → Disco
URL → [Cola DESCARGA] → ├→ [Cola CONVERT]   → Hilos C1, C2 → Disco  ← AL MISMO TIEMPO
       Hilos D1-D3       └→ [Cola WATERMARK] → Hilos M1, M2 → Disco
```

Después de descargar, la imagen se empuja a **3 colas simultáneamente**. Las 3 etapas de procesamiento corren **en paralelo real** sobre el archivo descargado.

### 2. Patrón Producer-Consumer con Colas

Las colas desacoplan las etapas. La descarga produce items y los 3 consumidores (resize, convert, watermark) los toman independientemente.

### 3. Hilos Reales del SO (worker_threads)

Cada worker es un **hilo real del sistema operativo** creado con `new Worker()` de `worker_threads`:
- Cada hilo tiene su propio **V8 engine** y **event loop**
- Cada hilo tiene un **threadId** único del SO
- Se comunican vía `postMessage()` / `parentPort`
- **Paralelismo REAL** — los hilos corren en diferentes CPUs

### 4. Fire-and-Forget (Procesamiento asíncrono)

La API responde **inmediatamente** con un `jobId`. El procesamiento con hilos reales ocurre en segundo plano. El cliente hace **polling** para consultar el progreso.

### 5. Estado Dual (Cache en memoria + Persistencia)

- Memoria (`Map`) → Alta velocidad para polling del dashboard
- PostgreSQL → Persistencia, historial

### 6. Tolerancia a Fallos Parciales

Si una imagen falla en cualquier etapa, el error se registra pero las demás **continúan**.

### 7. Pool de Conexiones

Pool de conexiones PostgreSQL para queries concurrentes desde múltiples hilos.

---

## ⚙️ Tecnologías Usadas

| Tecnología | Propósito |
|-----------|-----------|
| **Node.js** | Runtime del backend |
| **worker_threads** | **Hilos reales del SO** para paralelismo real |
| **Fastify** | Framework HTTP rápido |
| **Sharp** | Procesamiento de imágenes (usa C++ threads internamente) |
| **PostgreSQL** | Base de datos relacional |
| **Docker** | Contenedor para PostgreSQL |
| **ngrok** | Túnel para exponer a internet |
| **EventEmitter** | Señalización entre colas y gestores de hilos |
| **UUID** | IDs únicos para jobs e imágenes |

---

## 🔬 ¿Dónde están los "Hilos y Procesos"?

| Concepto del taller | Implementación en el código |
|--------------------|-----------------------------|
| **Hilos (threads)** | `new Worker()` de `worker_threads` — cada worker es un **hilo real del SO** con su propio threadId |
| **Paralelismo real** | 4 etapas con N hilos cada una corriendo en **CPUs diferentes** simultáneamente |
| **Concurrencia** | Múltiples hilos procesan imágenes al mismo tiempo via `Promise.all` |
| **Sincronización** | `esperarVacia()` es como un **barrier/join**. `setEsperados()` previene resolución prematura |
| **Comunicación entre hilos** | `postMessage()` (hilo principal → worker) y `parentPort` (worker → hilo principal) |
| **Productor-Consumidor** | Descarga produce para 3 colas. Resize, Convert, Watermark consumen independientemente |
| **Exclusión mutua** | El `pop()` retorna `null` si otro hilo ya tomó el item (race condition safe) |
| **Pipeline** | Las 4 etapas corren en paralelo con `Promise.all` |
| **Fan-Out** | Cada descarga empuja a 3 colas simultáneamente |

---

## 📊 Ejemplo de Ejecución Paralela

Si envías **5 URLs** con `descarga: 3, redimension: 2, conversion: 2, marcaAgua: 2`:

```
Tiempo →  0s      1s      2s      3s      4s      5s

Hilo D-1: [img1]------[img4]------
Hilo D-2: [img2]----------[img5]--         ← DESCARGA
Hilo D-3: [img3]------------------
              ↓  ↓  ↓
Hilo R-1: ----[img1]--[img3]--[img5]        ← RESIZE
Hilo R-2: ------[img2]--[img4]----         (al mismo tiempo)
              ↓  ↓  ↓
Hilo C-1: ----[img1]--[img3]--[img5]        ← CONVERT
Hilo C-2: ------[img2]--[img4]----         (al mismo tiempo)
              ↓  ↓  ↓
Hilo M-1: ----[img1]--[img3]--[img5]        ← WATERMARK
Hilo M-2: ------[img2]--[img4]----         (al mismo tiempo)
```

**Las 4 etapas corren EN PARALELO:** cuando img1 se descarga, inmediatamente se empuja a resize + convert + watermark. Mientras tanto, img2 y img3 se siguen descargando. **Todo al mismo tiempo con hilos reales del SO.**

---
---

# 👷 SECCIÓN PROFUNDA: LOS WORKERS (HILOS Y PROCESOS)

> Esta sección desglosa **TODO** sobre cómo funcionan los workers en el sistema, línea por línea, y cómo se conectan con la teoría de **hilos y procesos** de sistemas distribuidos.

---

## 1. ¿Qué es un Worker en este sistema?

Un **worker** es una función que se registra como **listener de eventos** en una cola. Simula el comportamiento de un **hilo (thread)** del sistema operativo:

| Hilo del SO | Worker en PMIC |
|-------------|----------------|
| Se crea con `pthread_create()` | Se crea con `escucharCola()` |
| Espera en un `condition_variable.wait()` | Espera el evento `itemDisponible` |
| Se despierta con `condition_variable.notify()` | Se despierta con `emit('itemDisponible')` |
| Lee de un buffer compartido | Lee de `cola.pop()` |
| Usa un `mutex` para exclusión mutua | El event loop de Node.js serializa los accesos |
| Termina con `pthread_join()` | La cola emite `colaVacia` (como un barrier/join) |

---

## 2. Ciclo de Vida Completo de un Worker

```mermaid
stateDiagram-v2
    [*] --> CREADO: lanzarWorkers(n)
    CREADO --> DORMIDO: cola.on('itemDisponible')
    DORMIDO --> DESPERTADO: emit('itemDisponible')
    DESPERTADO --> VERIFICANDO: cola.pop()
    VERIFICANDO --> DORMIDO: pop() retornó null (otro worker lo tomó)
    VERIFICANDO --> PROCESANDO: pop() retornó un item
    PROCESANDO --> REGISTRANDO: Tarea completada o falló
    REGISTRANDO --> ENTREGANDO: stateStore.registrarResultado()
    ENTREGANDO --> DORMIDO: colaSiguiente.push(item) + cola.terminarItem()
    
    note right of DORMIDO
        El worker NO consume CPU
        mientras está dormido.
        Solo ocupa memoria (su closure).
    end note
    
    note right of VERIFICANDO
        Si 3 workers escuchan la misma cola
        y llega 1 item, los 3 se despiertan,
        pero solo 1 obtiene el item.
        Los otros 2 reciben null y vuelven a dormir.
    end note
    
    note right of PROCESANDO
        Aquí es donde ocurre el trabajo real:
        - Descarga: fetch() + stream (I/O)
        - Redimensión: sharp.resize() (CPU)
        - Conversión: sharp.png() (CPU)
        - Marca agua: sharp.composite() (CPU)
    end note
```

### Las 6 fases explicadas:

### Fase 1: CREACIÓN (nacimiento del "hilo")

```javascript
// pipeline.js — Se lanzan N workers por etapa
lanzarWorkersDescarga(workersConfig.descarga, jobId, qm);
//                     ↑ por ejemplo: 3
```

```javascript
// download.worker.js
export function lanzarWorkersDescarga(n, jobId, qm) {
  console.log(`[DESCARGA] Lanzando ${n} workers...`);
  for (let i = 1; i <= n; i++) {
    escucharCola(`Descarga-W${i}`, jobId, qm);
    //           ↑ nombre único: "Descarga-W1", "Descarga-W2", "Descarga-W3"
  }
}
```

**¿Qué pasa aquí?** Se ejecuta un `for` que crea N "escuchadores". Cada iteración es como hacer `pthread_create()` — crea un nuevo "hilo" que va a vivir escuchando la cola.

**Analogía SO:** Es exactamente como cuando haces:
```c
// En C con pthreads (teoría):
for (int i = 0; i < n; i++) {
    pthread_create(&threads[i], NULL, worker_function, &args);
}
```

---

### Fase 2: DORMIDO (esperando trabajo)

```javascript
function escucharCola(workerNombre, jobId, qm) {
  const cola = qm.descarga;

  // ⭐ ESTE .on() es el equivalente a condition_variable.wait()
  cola.on('itemDisponible', async () => {
    // ... este código se ejecuta SOLO cuando alguien hace push() a la cola
  });
}
```

**¿Qué pasa aquí?** El worker se "duerme" esperando el evento `itemDisponible`. No consume CPU, no bloquea nada. Es un **callback registrado** que se activará cuando la cola emita ese evento.

**Analogía SO:**
```c
// En C con pthreads (teoría):
pthread_mutex_lock(&mutex);
while (cola_vacia()) {
    pthread_cond_wait(&cond, &mutex);  // ← Se duerme aquí
}
// Se despierta cuando otro hilo hace pthread_cond_signal()
```

**Diferencia clave:** En un SO real, el hilo se bloquea y el scheduler del kernel lo pone a dormir. En Node.js, el "hilo" no existe realmente — es solo un callback en memoria que el event loop ejecutará cuando llegue el evento.

---

### Fase 3: DESPERTAR (llega trabajo)

Cuando otro componente hace `push()` a la cola:

```javascript
// Esto ocurre en algún otro sitio:
qm.descarga.push(item);  // O pushMuchos()
```

Internamente, `push()` ejecuta:
```javascript
push(item) {
  this._items.push(item);
  this._total += 1;
  this.emit('itemDisponible');  // ← ¡DESPIERTA A TODOS LOS WORKERS!
}
```

**TODOS** los workers registrados con `.on('itemDisponible')` se despiertan. Pero como Node.js es single-threaded, se ejecutan **uno por uno**, no simultáneamente.

**Analogía SO:**
```c
// En C — despertar a TODOS los hilos que esperan:
pthread_cond_broadcast(&cond);  // ← broadcast = despertar a todos
// (distinto de pthread_cond_signal que despierta solo a 1)
```

---

### Fase 4: VERIFICAR (¿hay algo para mí?)

```javascript
cola.on('itemDisponible', async () => {
  const item = cola.pop();  // ← Intentar tomar un item
  if (!item) return;         // ← ¡Otro worker ya lo tomó! Volver a dormir.
  // ...
});
```

```javascript
pop() {
  if (this._items.length === 0) return null;  // Cola vacía
  this._activos += 1;         // Marcar que hay un worker procesando
  return this._items.shift();  // FIFO: sacar el primer item
}
```

**¿Por qué `pop()` puede retornar `null`?** Porque si llega 1 item y hay 3 workers escuchando, los 3 se despiertan. El primero hace `pop()` y obtiene el item. Los otros 2 hacen `pop()` y obtienen `null` → vuelven a dormir.

**Analogía SO — Sección Crítica:**
```c
pthread_mutex_lock(&mutex);           // ← En Node.js: el event loop serializa
item = buffer[read_index++];          // ← En Node.js: this._items.shift()
pthread_mutex_unlock(&mutex);
```

> **¿Por qué no hay race condition?** Porque Node.js ejecuta todo el JavaScript en UN SOLO HILO. Aunque haya 3 workers, sus callbacks se ejecutan uno tras otro, NUNCA simultáneamente. El event loop de Node.js actúa como un **mutex implícito**. Esto es una ventaja sobre los hilos reales donde necesitas locks explícitos.

---

### Fase 5: PROCESAMIENTO (el trabajo pesado)

Aquí es donde cada worker hace su tarea específica:

#### Worker de Descarga (`download.worker.js`) — I/O-BOUND

```javascript
async function procesarDescarga(item, qm) {
  const inicio = Date.now();  // ← Cronómetro

  try {
    // 1. Descargar la imagen de internet
    const response = await fetch(item.urlOriginal, {
      signal: AbortSignal.timeout(30000),  // ← Timeout de 30 segundos
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PMIC/1.0)' }
    });
    // ⚡ MIENTRAS ESPERA LA RED, NODE.JS ATIENDE A OTROS WORKERS
    // Esto es lo que hace al worker "concurrente" sin ser un hilo real

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // 2. Determinar la extensión del archivo
    const extension = obtenerExtension(item.urlOriginal, response.headers.get('content-type'));
    const nombreArchivo = `${item.imagenId}${extension}`;
    const rutaDestino = path.join(config.storage.downloads, nombreArchivo);

    // 3. Guardar en disco usando STREAMS (eficiente en memoria)
    await streamPipeline(
      response.body,                    // ← Stream de lectura (red)
      fs.createWriteStream(rutaDestino) // ← Stream de escritura (disco)
    );
    // ⚡ DURANTE ESTA ESCRITURA, NODE.JS TAMBIÉN ATIENDE OTROS WORKERS

    // 4. Obtener el tamaño del archivo
    const tamanoMb = fs.statSync(rutaDestino).size / (1024 * 1024);
    const tiempoSeg = (Date.now() - inicio) / 1000;

    // 5. Actualizar el "workItem" para la siguiente etapa
    item.rutaActual = rutaDestino;    // ← La ruta donde quedó el archivo
    item.nombreBase = item.imagenId;
    item.extension = extension;

    // 6. Registrar éxito en BD + memoria
    await stateStore.registrarResultado('descarga', item.imagenId, item.jobId, true, tiempoSeg, {
      estado:       'DESCARGADA',
      workerNombre: item.workerNombre,   // ← "Descarga-W2" (para saber quién lo hizo)
      tiempoSeg,
      ruta:         rutaDestino,
      tamanoMb:     parseFloat(tamanoMb.toFixed(4)),
      error:        null,
    });

    // 7. ⭐ PASAR A LA SIGUIENTE ETAPA
    qm.redimension.push(item);  // ← Empujar a la cola de redimensión

  } catch (error) {
    const tiempoSeg = (Date.now() - inicio) / 1000;
    // Si falla → ErrorManager registra el error y el pipeline CONTINÚA
    await errorManager.registrarError('descarga', item, error, tiempoSeg);
    // ⚠️ NO se hace qm.redimension.push(item) → la imagen NO pasa a la siguiente etapa
  }
}
```

**Puntos clave para el taller:**
- El `await fetch()` es **I/O-bound**: el worker "suelta" el event loop mientras espera la red
- Mientras Worker-D1 espera datos de internet, Worker-D2 puede estar escribiendo en disco
- **3 workers de descarga** pueden descargar 3 imágenes "al mismo tiempo" porque las esperas de red se solapan
- Se usa `streamPipeline` en vez de `response.buffer()` para no cargar toda la imagen en RAM

---

#### Worker de Redimensión (`resize.worker.js`) — CPU-BOUND

```javascript
async function procesarRedimension(item, qm) {
  const inicio = Date.now();

  try {
    // 1. Leer metadatos de la imagen (ancho × alto)
    const metadata = await sharp(item.rutaActual).metadata();
    const anchoOriginal = metadata.width;   // ej: 4000
    const altoOriginal  = metadata.height;  // ej: 3000

    // 2. Calcular nuevas dimensiones (máximo 800px)
    const maxDim = config.pipeline.maxDimension;  // 800
    let anchoFinal = anchoOriginal;
    let altoFinal  = altoOriginal;

    if (anchoOriginal > maxDim || altoOriginal > maxDim) {
      const ratio = Math.min(maxDim / anchoOriginal, maxDim / altoOriginal);
      anchoFinal = Math.round(anchoOriginal * ratio);  // ej: 800
      altoFinal  = Math.round(altoOriginal  * ratio);  // ej: 600
    }

    // 3. Redimensionar con Sharp
    const rutaSalida = path.join(config.storage.resized, `${item.nombreBase}_redimensionado${item.extension}`);
    await sharp(item.rutaActual)
      .resize(anchoFinal, altoFinal, { fit: 'inside', withoutEnlargement: true })
      .toFile(rutaSalida);
    // ⚡ sharp.resize() se ejecuta en el THREAD POOL de libuv (C++)
    // Es PARALELISMO REAL en CPU, no solo concurrencia del event loop

    // 4. Actualizar item para siguiente etapa
    item.rutaActual = rutaSalida;
    item.nombreBase = `${item.nombreBase}_redimensionado`;

    // 5. Registrar resultado + pasar a conversión
    await stateStore.registrarResultado('redimension', item.imagenId, item.jobId, true, tiempoSeg, { ... });
    qm.conversion.push(item);  // ← Siguiente etapa

  } catch (error) {
    await errorManager.registrarError('redimension', item, error, tiempoSeg);
  }
}
```

**Puntos clave para el taller:**
- `sharp()` es una librería de C++ (libvips) que usa el **libuv thread pool**
- Cuando llamas `await sharp().resize().toFile()`, eso se ejecuta en un **hilo nativo real del SO**
- Por defecto libuv tiene **4 threads** → hasta 4 redimensiones pueden ocurrir **en paralelo real** en CPU
- Esto es **verdadero paralelismo**, no solo concurrencia

---

#### Worker de Conversión (`convert.worker.js`) — CPU-BOUND

```javascript
async function procesarConversion(item, qm) {
  const formatoOriginal = item.extension.replace('.', '').toUpperCase(); // "JPG"

  try {
    const rutaSalida = path.join(config.storage.converted, `${item.nombreBase}_formato_cambiado.png`);

    await sharp(item.rutaActual)
      .png({ quality: 90, compressionLevel: 6 })  // ← Convertir a PNG
      .toFile(rutaSalida);

    item.rutaActual = rutaSalida;
    item.extension  = '.png';

    await stateStore.registrarResultado('conversion', ...);
    qm.marcaAgua.push(item);  // ← Siguiente etapa

  } catch (error) {
    await errorManager.registrarError('conversion', item, error, tiempoSeg);
  }
}
```

**Punto clave:** Convierte CUALQUIER formato (JPG, GIF, WebP, BMP) a PNG estandarizado. Misma mecánica de thread pool que redimensión.

---

#### Worker de Marca de Agua (`watermark.worker.js`) — CPU-BOUND

```javascript
async function procesarMarcaAgua(item) {
  try {
    const metadata = await sharp(item.rutaActual).metadata();
    const ancho = metadata.width;
    const alto  = metadata.height;

    // 1. Calcular tamaño de fuente proporcional a la imagen
    const tamanoFuente = Math.max(16, Math.round(ancho / 15));

    // 2. Crear la marca de agua como SVG (texto con sombra)
    const svgMarcaAgua = Buffer.from(`
      <svg width="${ancho}" height="${alto}">
        <text x="${ancho - 20}" y="${alto - 18}" class="sombra">PMIC © 2024</text>
        <text x="${ancho - 22}" y="${alto - 20}" class="marca">PMIC © 2024</text>
      </svg>
    `);

    // 3. Componer la imagen original + la marca de agua
    await sharp(item.rutaActual)
      .composite([{ input: svgMarcaAgua, blend: 'over' }])  // ← Superponer
      .png()
      .toFile(rutaSalida);

    // 4. Registrar como COMPLETADA (última etapa)
    await stateStore.registrarResultado('marcaAgua', item.imagenId, item.jobId, true, tiempoSeg, {
      estado: 'COMPLETADA',  // ← ¡Estado final!
      // ...
    });

    // ⚠️ NO hay qm.siguiente.push(item) — esta es la ÚLTIMA etapa

  } catch (error) {
    await errorManager.registrarError('marcaAgua', item, error, tiempoSeg);
  }
}
```

**Punto clave:** Es la **última etapa** del pipeline. Cuando termina, NO empuja a ninguna cola siguiente. En vez de eso, el `stateStore.registrarResultado()` verifica si TODAS las imágenes del job terminaron y, si es así, marca el job como `COMPLETADO`.

---

### Fase 6: ENTREGA Y VUELTA A DORMIR

```javascript
cola.on('itemDisponible', async () => {
  const item = cola.pop();
  if (!item) return;

  item.workerNombre = workerNombre;
  await procesarDescarga(item, qm);  // ← Fase 5 (procesamiento)
  cola.terminarItem();                // ← ¡Terminé! Decrementar contador
  // El worker "vuelve a dormir" automáticamente — esperará el próximo evento
});
```

```javascript
terminarItem() {
  this._activos -= 1;   // Un worker menos activo
  this._fin += 1;        // Un item más terminado

  // ¿Ya no hay nada pendiente NI nadie procesando?
  if (this._items.length === 0 && this._activos === 0) {
    this.emit('colaVacia');  // ← Señal de que la etapa terminó
    // El pipeline.js está esperando esto con esperarVacia()
  }
}
```

**Analogía SO:**
```c
// En C — el equivalente de terminarItem() + colaVacia:
pthread_mutex_lock(&mutex);
items_activos--;
if (items_activos == 0 && cola_size == 0) {
    pthread_cond_signal(&barrier_cond);  // ← Despertar al pipeline
}
pthread_mutex_unlock(&mutex);
```

---

## 3. El Patron Completo: Cómo los Workers Fluyen entre Colas

```
                        COLA DESCARGA          COLA REDIMENSION       COLA CONVERSION        COLA MARCA AGUA
                     ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
Items ingresan →     │ img1 img2 img3  │    │                 │    │                 │    │                 │
                     └────────┬────────┘    └────────┬────────┘    └────────┬────────┘    └────────┬────────┘
                              │                      │                      │                      │
                     ┌────────┴────────┐    ┌────────┴────────┐    ┌────────┴────────┐    ┌────────┴────────┐
Workers:             │ D-W1   D-W2    │    │ R-W1   R-W2    │    │ C-W1   C-W2    │    │ M-W1   M-W2    │
                     │ D-W3           │    │                 │    │                 │    │                 │
                     └─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘

Paso 1: D-W1 toma img1, D-W2 toma img2, D-W3 toma img3 (CONCURRENTES)
Paso 2: D-W1 termina img1 → push a cola redimensión → R-W1 despierta y toma img1
Paso 3: D-W2 termina img2 → push a cola redimensión → R-W2 despierta y toma img2
        MIENTRAS D-W1 ya está descargando img4 (volvió a la cola de descarga)
Paso 4: R-W1 termina img1 → push a cola conversión → C-W1 despierta y toma img1
        R-W2 aún procesando img2, D-W3 terminó img3 y fue a la cola de redimensión
...y así sucesivamente. TODAS LAS ETAPAS TRABAJAN EN PARALELO.
```

---

## 4. ¿Por qué Workers y no Worker Threads reales de Node.js?

Node.js tiene `worker_threads` (hilos reales). ¿Por qué este sistema NO los usa?

| Aspecto | Worker Threads (hilos reales) | Workers con EventEmitter (este sistema) |
|---------|------------------------------|----------------------------------------|
| **Memoria** | Cada thread consume ~10MB RAM | Cada "worker" es solo un callback (~1KB) |
| **Comunicación** | Necesita `postMessage()` (serializar datos) | Acceso directo a la misma memoria |
| **Complejidad** | Requiere manejo explícito de locks | El event loop serializa automáticamente |
| **I/O concurrente** | Eficiente pero innecesario (Node ya es async) | Naturalmente concurrente con `await` |
| **CPU real** | Paralelismo verdadero | Sharp ya usa threads C++ internamente |
| **Para este taller** | Over-engineering | **Suficiente para demostrar los conceptos** |

**Conclusión:** Este sistema logra **concurrencia efectiva** sin la complejidad de hilos reales, porque:
1. Las descargas son I/O → `await fetch()` ya es no-bloqueante
2. El procesamiento de imágenes usa Sharp → que internamente sí usa threads C++
3. Las colas + EventEmitter manejan la coordinación de forma elegante

---

## 5. Conceptos Académicos Mapeados al Código Worker

### 5.1 Exclusión Mutua (Mutex)

**Teoría:** Solo un hilo puede acceder a un recurso compartido a la vez.

**En el código:**
```javascript
// queueManager.js
pop() {
  if (this._items.length === 0) return null;  // ← Verificación atómica
  this._activos += 1;
  return this._items.shift();  // ← Solo 1 worker obtiene este item
}
```
Node.js garantiza que NO hay dos callbacks ejecutándose a la vez (el event loop es single-threaded), así que `pop()` nunca tiene race conditions. **El event loop ES el mutex.**

### 5.2 Variable de Condición (Condition Variable)

**Teoría:** Un hilo se duerme hasta que otro lo despierta con una señal.

**En el código:**
```javascript
// DORMIR (esperar un item):
cola.on('itemDisponible', async () => { ... });

// DESPERTAR (señal de que hay trabajo):
this.emit('itemDisponible');
```

### 5.3 Barrera (Barrier)

**Teoría:** Un punto de sincronización donde se espera a que TODOS los hilos terminen antes de continuar.

**En el código:**
```javascript
// pipeline.js — Esperar que TODA la etapa termine
await qm.descarga.esperarVacia();     // ← Barrera 1
await qm.redimension.esperarVacia();  // ← Barrera 2
await qm.conversion.esperarVacia();   // ← Barrera 3
await qm.marcaAgua.esperarVacia();    // ← Barrera 4
```

```javascript
// queueManager.js — Implementación de la barrera
esperarVacia() {
  return new Promise(resolve => {
    if (this.estaVacia) resolve();           // Ya todos terminaron
    else this.once('colaVacia', resolve);    // Esperar la señal
  });
}
```

### 5.4 Productor-Consumidor

**Teoría:** Productores generan datos que ponen en un buffer. Consumidores sacan datos del buffer.

**En el código:**
```
PRODUCTOR                    BUFFER (Cola)              CONSUMIDOR
download.worker.js    →    cola.redimension     →    resize.worker.js
resize.worker.js      →    cola.conversion      →    convert.worker.js
convert.worker.js     →    cola.marcaAgua       →    watermark.worker.js
```

Cada worker es **productor Y consumidor** al mismo tiempo:
- **Consume** de su propia cola (la de su etapa)
- **Produce** para la cola de la siguiente etapa

### 5.5 Pool de Hilos (Thread Pool)

**Teoría:** Se pre-crean N hilos que esperan trabajo, en vez de crear un hilo nuevo por cada tarea.

**En el código:**
```javascript
// Se crean 3 workers al inicio (como un pool de 3 "hilos")
for (let i = 1; i <= 3; i++) {
  escucharCola(`Descarga-W${i}`, jobId, qm);
}
// Estos 3 workers procesan TODAS las imágenes
// No se crea un worker nuevo por cada imagen
```

Además, Sharp usa el **libuv thread pool** internamente:
```
Node.js event loop (1 hilo JS)
    ├── libuv thread pool (4 hilos C++ por defecto)
    │   ├── Thread 1: sharp.resize() para imagen A
    │   ├── Thread 2: sharp.resize() para imagen B
    │   ├── Thread 3: sharp.png() para imagen C
    │   └── Thread 4: sharp.composite() para imagen D
    └── I/O async (delegado al SO)
        ├── fetch() descargando imagen E
        ├── fetch() descargando imagen F
        └── fs.write() guardando imagen G
```

### 5.6 Señalización entre Hilos

**Teoría:** Un hilo notifica a otros que algo ocurrió.

**En el código (3 señales diferentes):**

| Señal | ¿Quién la envía? | ¿Quién la recibe? | ¿Para qué? |
|-------|-------------------|--------------------|------------|
| `itemDisponible` | `push()` / `pushMuchos()` | Workers de esa etapa | Despertar workers para procesar |
| `colaVacia` | `terminarItem()` | `pipeline.js` (vía `esperarVacia()`) | Indicar que la etapa completó |
| `ninguna (error)` | `errorManager` | `stateStore` | Registrar fallo sin detener el sistema |

---

## 6. Ejemplo Detallado: 3 Imágenes con 2 Workers de Descarga

```
Tiempo →  0ms        100ms       200ms       300ms       400ms       500ms

EVENT LOOP DE NODE.JS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

pushMuchos([img1, img2, img3])
│
├── emit('itemDisponible') × 3  ← Se emite 3 veces (una por imagen)
│
├── D-W1 callback se ejecuta:
│     pop() → obtiene img1      ← D-W1 toma img1
│     await fetch(img1.url)     ← INICIA descarga (NO bloquea, devuelve al event loop)
│
├── D-W2 callback se ejecuta:
│     pop() → obtiene img2      ← D-W2 toma img2
│     await fetch(img2.url)     ← INICIA descarga (ambas corren "en paralelo")
│
├── D-W1 callback se ejecuta (3er emit):
│     ¡Pero D-W1 ya está ocupado!
│     Este emit se pierde... PERO no importa porque:
│     Cuando D-W1 o D-W2 terminen, verán que img3 aún está en la cola
│
│... (pasa tiempo, las descargas de red ocurren en paralelo) ...
│
├── [200ms] fetch(img1.url) se completó:
│     D-W1 continúa su await:
│       → streamPipeline (guardar en disco)
│       → registrarResultado en BD
│       → qm.redimension.push(img1)  ← img1 pasa a redimensión
│       → cola.terminarItem()
│       → D-W1 está libre... pero img3 sigue en la cola
│         El push de img1 a redimensión emitió 'itemDisponible' en cola redimensión
│         → R-W1 despierta y toma img1 para redimensionar
│
├── [250ms] Hay un item pendiente en cola descarga (img3)
│     Pero nadie lo sabe aún... D-W1 necesita recibir otro emit
│     → Esto se soluciona porque pushMuchos emitió 3 eventos
│       y el 3er evento despertará a algún worker
│     D-W1 pop() → obtiene img3
│     await fetch(img3.url) ← Tercera descarga inicia
│
├── [300ms] fetch(img2.url) se completó:
│     D-W2 → registrar → qm.redimension.push(img2)
│     R-W2 despierta y toma img2
│
│ MIENTRAS TANTO en redimensión:
│     R-W1 está redimensionando img1 con sharp (thread C++ real)
│     R-W2 está redimensionando img2 con sharp (otro thread C++ real)
│     ¡PARALELISMO REAL EN CPU!
│
└── [500ms] Todo terminado
```

---

## 7. Resumen Visual: Worker = Hilo en Este Sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│                    UN WORKER EN PMIC                                │
│                                                                     │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐  │
│  │ IDENTIDAD│     │ COLA     │     │ TAREA    │     │ SEÑALES  │  │
│  │          │     │          │     │          │     │          │  │
│  │ Nombre:  │     │ Escucha: │     │ Procesar:│     │ Recibe:  │  │
│  │ "D-W2"   │     │ cola     │     │ fetch()  │     │ itemDisp │  │
│  │          │     │ descarga │     │ sharp()  │     │          │  │
│  │ Job:     │     │          │     │ fs()     │     │ Envía:   │  │
│  │ a1b2c3.. │     │ pop()    │     │          │     │ push()   │  │
│  │          │     │ terminar │     │ try/catch│     │ terminar │  │
│  └──────────┘     └──────────┘     └──────────┘     └──────────┘  │
│                                                                     │
│  Thread real?  NO (callback en event loop)                         │
│  Concurrencia? SÍ (async/await + event loop)                      │
│  Paralelismo?  SÍ (vía Sharp → libuv threads)                     │
│  Memoria?      ~1KB (solo el closure del callback)                 │
│  Mutex?        Innecesario (event loop = serialización automática) │
└─────────────────────────────────────────────────────────────────────┘
```
