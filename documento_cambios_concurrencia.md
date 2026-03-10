# 📋 Documento de Cambios: Pipeline Secuencial → Pipeline Concurrente con Hilos Reales

## 1. ¿Qué cambió?

Se migró de un sistema con **callbacks en un solo hilo** (EventEmitter) a un sistema con **hilos reales del sistema operativo** (`worker_threads`) donde las **4 etapas corren en paralelo**.

---

## 2. Arquitectura ANTES (Pipeline Secuencial)

### ¿Cómo funcionaba?

```
Descarga → Redimensión → Conversión → Marca de Agua
   ↓            ↓             ↓              ↓
 (esperar    (esperar       (esperar       (esperar
  TODAS)      TODAS)         TODAS)         TODAS)
```

- Los "workers" eran **funciones callback** registradas con `cola.on('itemDisponible')`.
- Todos corrían en el **mismo hilo** del event loop de Node.js.
- Las etapas se ejecutaban **una después de otra**: primero se descargaban TODAS las imágenes, luego se redimensionaban TODAS, luego se convertían TODAS, luego se marcaban TODAS.
- No había paralelismo real en CPU — solo concurrencia simulada por el event loop.

### Código del pipeline ANTES:

```javascript
// pipeline.js — ANTES
lanzarWorkersDescarga(n, jobId, qm);
lanzarWorkersRedimension(n, jobId, qm);
lanzarWorkersConversion(n, jobId, qm);
lanzarWorkersMarcaAgua(n, jobId, qm);

qm.descarga.pushMuchos(workItems);

await qm.descarga.esperarVacia();    // Esperar TODAS las descargas
await qm.redimension.esperarVacia(); // LUEGO esperar TODOS los resizes
await qm.conversion.esperarVacia();  // LUEGO esperar TODAS las conversiones
await qm.marcaAgua.esperarVacia();   // LUEGO esperar TODAS las marcas
```

### Código de un worker ANTES:

```javascript
// download.worker.js — ANTES (callback en el event loop)
function escucharCola(workerNombre, jobId, qm) {
  const cola = qm.descarga;

  cola.on('itemDisponible', async () => {  // ← Callback, NO es un hilo
    const item = cola.pop();
    if (!item) return;
    await procesarDescarga(item, qm);      // ← Se ejecuta en el event loop
    cola.terminarItem();
  });
}
```

### Problema:

- `cola.on(...)` registra un callback — **NO crea un hilo**.
- Todas las funciones `async` se ejecutan en el **mismo hilo** (event loop).
- No hay paralelismo real: si un worker está procesando, los demás esperan su turno en la cola del event loop.
- Las etapas eran secuenciales: la redimensión no empezaba hasta que TODAS las descargas terminaran.

---

## 3. Arquitectura DESPUÉS (Pipeline Concurrente con Hilos Reales)

### ¿Cómo funciona ahora?

```
                         ┌→ Cola Resize    → Hilo R1, R2 → Disco
Descarga (Hilos D1-D3)  ├→ Cola Convert   → Hilo C1, C2 → Disco  ← AL MISMO TIEMPO
                         └→ Cola Watermark → Hilo M1, M2 → Disco

Promise.all([descarga, resize, convert, watermark]) → Las 4 en paralelo
```

- Cada worker es un **hilo real del SO** creado con `new Worker()` de `worker_threads`.
- Cada hilo tiene su propio **V8 engine**, su propio **event loop** y su propio **threadId**.
- Las 4 etapas corren **al mismo tiempo** con `Promise.all`.
- Cuando una imagen se descarga, se empuja a las **3 colas de procesamiento simultáneamente**.
- Resize, Convert y Watermark trabajan sobre el **archivo descargado original** de forma independiente.

### Código del pipeline DESPUÉS:

```javascript
// pipeline.js — DESPUÉS
// Decirle a cada cola cuántos items esperar
qm.redimension.setEsperados(total);
qm.conversion.setEsperados(total);
qm.marcaAgua.setEsperados(total);

// Lanzar TODOS los hilos de las 4 etapas
const hilosDescarga    = lanzarWorkersDescarga(n, jobId, qm);
const hilosRedimension = lanzarWorkersRedimension(n, jobId, qm);
const hilosConversion  = lanzarWorkersConversion(n, jobId, qm);
const hilosMarcaAgua   = lanzarWorkersMarcaAgua(n, jobId, qm);

qm.descarga.pushMuchos(workItems);

// ⭐ Las 4 etapas corren EN PARALELO
await Promise.all([
  qm.descarga.esperarVacia(),
  qm.redimension.esperarVacia(),
  qm.conversion.esperarVacia(),
  qm.marcaAgua.esperarVacia(),
]);

// Terminar todos los hilos
[...hilosDescarga, ...hilosRedimension, ...hilosConversion, ...hilosMarcaAgua]
  .forEach(t => t.terminate());
```

---

## 4. ¿Qué son los archivos `.thread.js`? (Lo más importante)

Cada archivo `.thread.js` es el **código que se ejecuta DENTRO de un hilo real del sistema operativo**.

### Estructura de cada hilo:

```
┌──────────────────────────────────────────┐
│          HILO DEL SO (thread)            │
│                                          │
│  - Tiene su propio V8 engine             │
│  - Tiene su propio event loop            │
│  - Tiene su propio threadId              │
│  - Se comunica vía postMessage()         │
│                                          │
│  parentPort.on('message', (msg) => {     │
│    // Recibe trabajo del hilo principal  │
│    // Procesa la imagen con Sharp        │
│    // Envía resultado de vuelta          │
│    parentPort.postMessage(resultado);    │
│  });                                     │
│                                          │
└──────────────────────────────────────────┘
```

### Archivos creados:

| Archivo | Función | Qué hace dentro del hilo |
|---------|---------|--------------------------|
| `download.thread.js` | Hilo de descarga | `fetch()` + `stream` → guarda imagen en disco |
| `resize.thread.js` | Hilo de redimensión | `sharp().resize()` → guarda imagen redimensionada |
| `convert.thread.js` | Hilo de conversión | `sharp().png()` → guarda imagen en PNG |
| `watermark.thread.js` | Hilo de marca de agua | `sharp().composite()` → aplica marca de agua SVG |

### Ejemplo: `resize.thread.js`

```javascript
import { parentPort, workerData, threadId } from 'worker_threads';
import sharp from 'sharp';

const { workerNombre } = workerData;
console.log(`[HILO] ${workerNombre} creado (threadId: ${threadId})`);

parentPort.on('message', async ({ item }) => {
  const inicio = Date.now();
  try {
    // Leer metadata, calcular nuevas dimensiones
    const metadata = await sharp(item.rutaActual).metadata();
    const ratio = Math.min(maxDim / metadata.width, maxDim / metadata.height);

    // Redimensionar con Sharp (usa threads C++ internos)
    await sharp(item.rutaActual)
      .resize(anchoFinal, altoFinal)
      .toFile(rutaSalida);

    // Enviar resultado al hilo principal
    parentPort.postMessage({ tipo: 'completado', item: {...}, resultado: {...} });
  } catch (error) {
    parentPort.postMessage({ tipo: 'error', item, error: error.message });
  }
});
```

---

## 5. ¿Qué cambió en los archivos `.worker.js`?

Los archivos `.worker.js` pasaron de ser **la lógica de procesamiento** a ser **gestores de hilos**.

### ANTES (worker.js = lógica de procesamiento):

```javascript
// resize.worker.js ANTES — Todo en el event loop
export function lanzarWorkersRedimension(n, jobId, qm) {
  for (let i = 1; i <= n; i++) {
    escucharCola(`Redimension-W${i}`, jobId, qm);  // ← Registra callback
  }
}

function escucharCola(workerNombre, jobId, qm) {
  cola.on('itemDisponible', async () => {           // ← Callback, NO hilo
    const item = cola.pop();
    await procesarRedimension(item, qm);            // ← Procesa en event loop
    cola.terminarItem();
  });
}

async function procesarRedimension(item, qm) {
  await sharp(item.rutaActual).resize(...);         // ← Corre aquí mismo
  qm.conversion.push(item);                        // ← Empuja a siguiente cola
}
```

### DESPUÉS (worker.js = gestor de hilos reales):

```javascript
// resize.worker.js DESPUÉS — Crea hilos reales del SO
import { Worker } from 'worker_threads';

export function lanzarWorkersRedimension(n, jobId, qm) {
  const threads = [];
  for (let i = 1; i <= n; i++) {
    // ⭐ Crear HILO REAL del sistema operativo
    const thread = new Worker('./resize.thread.js', {
      workerData: { workerNombre: `Redimension-W${i}` }
    });

    let ocupado = false;

    cola.on('itemDisponible', () => {
      if (ocupado) return;
      const item = cola.pop();
      ocupado = true;
      thread.postMessage({ item });     // ← Envía trabajo AL HILO
    });

    thread.on('message', async (msg) => {
      ocupado = false;
      // Actualizar estado en BD
      await stateStore.registrarResultado(...);
      // NO empuja a siguiente cola — etapa independiente
      cola.terminarItem();
    });

    threads.push(thread);
  }
  return threads;                       // ← Retorna referencias para terminarlos
}
```

---

## 6. Cambios en la Cola (`queueManager.js`)

### ¿Qué cambió?

Se agregó `setEsperados(n)` para que las colas de procesamiento no resuelvan prematuramente.

### ¿Por qué?

Con el pipeline secuencial, cada cola se llenaba ANTES de que los workers empezaran. Con el pipeline paralelo, las colas de resize/convert/watermark empiezan **vacías** y reciben items a medida que las descargas terminan. Sin `setEsperados`, `esperarVacia()` resolvería inmediatamente porque la cola está vacía al inicio.

```javascript
// ANTES: La cola resolvía si pendientes == 0 && activos == 0
// DESPUÉS: La cola espera hasta que se procesen TODOS los items esperados

setEsperados(n) {
  this._esperados = n;     // "Espera N items antes de resolver"
}

terminarItem() {
  this._fin += 1;
  if (this._items.length === 0 && this._activos === 0) {
    if (this._esperados === 0 || this._fin >= this._esperados) {
      this.emit('colaVacia');  // Solo resuelve si ya procesó todos
    }
  }
}
```

---

## 7. Cambios en la Base de Datos (`imagen.repository.js`)

### ¿Qué cambió?

Las 3 etapas paralelas ya **NO sobreescriben** el campo `estado` entre sí.

### ANTES:
```sql
-- Cada etapa sobreescribía el estado
UPDATE imagenes SET estado = 'REDIMENSIONADA', ...  -- Resize
UPDATE imagenes SET estado = 'CONVERTIDA', ...      -- Convert (sobreescribe)
UPDATE imagenes SET estado = 'COMPLETADA', ...      -- Watermark (sobreescribe)
```

### DESPUÉS:
```sql
-- Cada etapa solo actualiza SUS columnas, NO el estado
UPDATE imagenes SET ancho_final = $1, ruta_redimensionada = $2, ... -- Resize
UPDATE imagenes SET ruta_convertida = $1, formato_original = $2, ... -- Convert
UPDATE imagenes SET ruta_marca_agua = $1, ...                        -- Watermark
```

Después de cada actualización, se llama `verificarImagenCompleta()`:
```sql
-- ¿Las 3 rutas están llenas? → COMPLETADA
SELECT
  (ruta_redimensionada IS NOT NULL OR error_redimension IS NOT NULL) AS resize_done,
  (ruta_convertida     IS NOT NULL OR error_conversion  IS NOT NULL) AS convert_done,
  (ruta_marca_agua     IS NOT NULL OR error_marca_agua  IS NOT NULL) AS watermark_done
FROM imagenes WHERE imagen_id = $1
```

Si las 3 están hechas → `UPDATE imagenes SET estado = 'COMPLETADA'`.

---

## 8. Cambios en `download.worker.js` (El cambio más importante)

### ANTES: Empujaba a UNA sola cola
```javascript
qm.redimension.push(item);  // Solo a resize → luego resize empuja a convert → etc.
```

### DESPUÉS: Empuja a las 3 colas AL MISMO TIEMPO
```javascript
// Cada cola recibe una COPIA del item
qm.redimension.push({ ...msg.item });  // → Resize (hilo real)
qm.conversion.push({ ...msg.item });   // → Convert (hilo real)  AL MISMO TIEMPO
qm.marcaAgua.push({ ...msg.item });    // → Watermark (hilo real)
```

---

## 9. Diagrama Comparativo de Ejecución

### ANTES (Secuencial):
```
Tiempo →  0s    2s    4s    6s    8s    10s   12s

img1:  [DESC] . . . [RESIZE] . . [CONVERT] . [WATERMARK]
img2:  [DESC] . . . . . . . . [RESIZE] . . . [CONVERT] . [WATERMARK]
img3:  . [DESC] . . . . . . . . . . . [RESIZE] . . . . [CONVERT]...

→ Cada etapa espera a que la anterior termine para TODAS las imágenes
→ Tiempo total: ~12 segundos
```

### DESPUÉS (Paralelo con hilos reales):
```
Tiempo →  0s    1s    2s    3s    4s    5s

img1:  [DESC] → [RESIZE]   ← hilo R1
       [DESC] → [CONVERT]  ← hilo C1    ← AL MISMO TIEMPO
       [DESC] → [WATERMARK]← hilo M1

img2:  . [DESC] → [RESIZE]    ← hilo R2
       . [DESC] → [CONVERT]   ← hilo C2  ← AL MISMO TIEMPO
       . [DESC] → [WATERMARK] ← hilo M1

→ Las 4 etapas corren en paralelo con hilos reales del SO
→ Tiempo total: ~5 segundos
```

---

## 10. Resumen de Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `pipeline.js` | `Promise.all` para las 4 etapas + `setEsperados` + terminación de hilos |
| `download.worker.js` | Crea hilos reales + empuja a 3 colas simultáneamente |
| `resize.worker.js` | Crea hilos reales + ya no empuja a cola de conversión |
| `convert.worker.js` | Crea hilos reales + ya no empuja a cola de watermark |
| `watermark.worker.js` | Crea hilos reales |
| `queueManager.js` | Agregado `setEsperados(n)` para evitar resolución prematura |
| `imagen.repository.js` | Etapas no sobreescriben estado + `verificarImagenCompleta()` |
| `stateStore.js` | Conteo de errores incluye las 4 etapas |
| `job.repository.js` | `determinarEstadoFinal` cuenta errores de las 4 etapas |

## 11. Archivos Nuevos (Hilos del SO)

| Archivo | Descripción |
|---------|-------------|
| `download.thread.js` | Código que corre DENTRO del hilo de descarga |
| `resize.thread.js` | Código que corre DENTRO del hilo de redimensión |
| `convert.thread.js` | Código que corre DENTRO del hilo de conversión |
| `watermark.thread.js` | Código que corre DENTRO del hilo de marca de agua |

Cada `.thread.js` usa:
- `parentPort` → para recibir/enviar mensajes al hilo principal
- `workerData` → para recibir configuración (nombre del worker)
- `threadId` → identificador único del hilo en el SO
