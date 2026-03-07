import fs from 'fs';
import path from 'path';
import { pipeline as streamPipeline } from 'stream/promises';
import { stateStore } from '../core/stateStore.js';
import { errorManager } from '../core/errorManager.js';
import { config } from '../config/config.js';

export function lanzarWorkersDescarga(n, jobId, qm) {
  console.log(`[DESCARGA] Lanzando ${n} workers para job ${jobId.slice(0, 8)}...`);
  for (let i = 1; i <= n; i++) {
    escucharCola(`Descarga-W${i}`, jobId, qm);
  }
}

function escucharCola(workerNombre, jobId, qm) {
  const cola = qm.descarga;

  cola.on('itemDisponible', async () => {
    const item = cola.pop();
    if (!item) return;

    item.workerNombre = workerNombre;
    await procesarDescarga(item, qm);
    cola.terminarItem();
  });
}

async function procesarDescarga(item, qm) {
  const inicio = Date.now();

  try {
    console.log(`[${item.workerNombre}] Descargando: ${item.urlOriginal}`);

    const response = await fetch(item.urlOriginal, {
      signal: AbortSignal.timeout(30000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PMIC/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const extension     = obtenerExtension(item.urlOriginal, response.headers.get('content-type'));
    const nombreArchivo = `${item.imagenId}${extension}`;
    const rutaDestino   = path.join(config.storage.downloads, nombreArchivo);

    await streamPipeline(
      response.body,
      fs.createWriteStream(rutaDestino)
    );

    const tamanoMb  = fs.statSync(rutaDestino).size / (1024 * 1024);
    const tiempoSeg = (Date.now() - inicio) / 1000;

    item.rutaActual = rutaDestino;
    item.nombreBase = item.imagenId;
    item.extension  = extension;

    await stateStore.registrarResultado('descarga', item.imagenId, item.jobId, true, tiempoSeg, {
      estado:       'DESCARGADA',
      workerNombre: item.workerNombre,
      tiempoSeg,
      ruta:         rutaDestino,
      tamanoMb:     parseFloat(tamanoMb.toFixed(4)),
      error:        null,
    });

    console.log(`[${item.workerNombre}] ✓ ${nombreArchivo} (${tamanoMb.toFixed(2)} MB) en ${tiempoSeg.toFixed(2)}s`);

    qm.redimension.push(item);

  } catch (error) {
    const tiempoSeg = (Date.now() - inicio) / 1000;
    await errorManager.registrarError('descarga', item, error, tiempoSeg);
  }
}

function obtenerExtension(url, contentType) {
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) {
      return ext;
    }
  } catch (_) {}

  const mapa = {
    'image/jpeg': '.jpg',
    'image/png':  '.png',
    'image/gif':  '.gif',
    'image/webp': '.webp',
    'image/bmp':  '.bmp',
  };
  return mapa[contentType?.split(';')[0]] || '.jpg';
}