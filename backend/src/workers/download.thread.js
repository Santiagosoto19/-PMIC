// ═══════════════════════════════════════════════════════════════
// HILO REAL DE DESCARGA — Se ejecuta en un thread del SO
// ═══════════════════════════════════════════════════════════════
import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import { pipeline as streamPipeline } from 'stream/promises';
import { config } from '../config/config.js';

const { workerNombre } = workerData;

console.log(`  [HILO] ${workerNombre} creado (threadId: ${(await import('worker_threads')).threadId})`);

parentPort.on('message', async ({ item }) => {
    const inicio = Date.now();

    try {
        const response = await fetch(item.urlOriginal, {
            signal: AbortSignal.timeout(30000),
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PMIC/1.0)' }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const extension = obtenerExtension(item.urlOriginal, response.headers.get('content-type'));
        const nombreArchivo = `${item.imagenId}${extension}`;
        const rutaDestino = path.join(config.storage.downloads, nombreArchivo);

        await streamPipeline(
            response.body,
            fs.createWriteStream(rutaDestino)
        );

        const tamanoMb = fs.statSync(rutaDestino).size / (1024 * 1024);
        const tiempoSeg = (Date.now() - inicio) / 1000;

        console.log(`  [${workerNombre}] ✓ ${nombreArchivo} (${tamanoMb.toFixed(2)} MB) en ${tiempoSeg.toFixed(2)}s`);

        parentPort.postMessage({
            tipo: 'completado',
            item: {
                ...item,
                rutaActual: rutaDestino,
                nombreBase: item.imagenId,
                extension,
            },
            resultado: {
                estado: 'DESCARGADA',
                workerNombre,
                tiempoSeg,
                ruta: rutaDestino,
                tamanoMb: parseFloat(tamanoMb.toFixed(4)),
                error: null,
            }
        });
    } catch (error) {
        const tiempoSeg = (Date.now() - inicio) / 1000;
        console.error(`  [${workerNombre}] ✗ Error: ${error.message}`);
        parentPort.postMessage({
            tipo: 'error',
            item,
            error: error.message,
            tiempoSeg,
        });
    }
});

function obtenerExtension(url, contentType) {
    try {
        const ext = path.extname(new URL(url).pathname).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) return ext;
    } catch (_) { }

    const mapa = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/bmp': '.bmp',
    };
    return mapa[contentType?.split(';')[0]] || '.jpg';
}
