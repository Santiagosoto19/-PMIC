import { jobRepository } from '../database/repositories/job.repository.js';
import { imagenRepository } from '../database/repositories/imagen.repository.js';
import { v4 as uuidv4 } from 'uuid';

class StateStore {
  constructor() {
    this._jobs = new Map();
  }

  async crearJob(jobId, urls, workersConfig) {

    // 1. Persistir el job en PostgreSQL
    await jobRepository.crear({
      jobId,
      urlsTotales: urls.length,
      workers: workersConfig,
    });

    // 2. Crear los registros de cada imagen en PostgreSQL
    const imagenesData = urls.map(url => ({
      imagenId: uuidv4(),
      jobId,
      urlOriginal: url,
    }));
    await imagenRepository.crearMuchas(imagenesData);

    // 3. Guardar estado inicial en memoria
    this._jobs.set(jobId, {
      jobId,
      estado: 'EN_PROCESO',
      fechaInicio: new Date().toISOString(),
      fechaFin: null,
      urls,
      workersConfig,
      metricas: {
        descarga: { procesados: 0, fallidos: 0, tiempoTotal: 0 },
        redimension: { procesados: 0, fallidos: 0, tiempoTotal: 0 },
        conversion: { procesados: 0, fallidos: 0, tiempoTotal: 0 },
        marcaAgua: { procesados: 0, fallidos: 0, tiempoTotal: 0 },
      },
    });

    // 4. Retornar los workItems para poblar la cola de descarga
    const workItems = imagenesData.map(img => ({
      jobId,
      imagenId: img.imagenId,
      urlOriginal: img.urlOriginal,
      rutaActual: null,
      nombreBase: '',
      extension: '',
    }));

    return workItems;
  }

  obtenerJob(jobId) {
    return this._jobs.get(jobId) || null;
  }

  async registrarResultado(etapa, imagenId, jobId, exito, tiempoSeg, datos = {}) {

    // 1. Actualizar métricas en PostgreSQL
    await jobRepository.incrementarMetrica(jobId, etapa, exito, tiempoSeg);

    // 2. Actualizar datos de la imagen en PostgreSQL
    const actualizadores = {
      descarga: () => imagenRepository.actualizarDescarga(imagenId, datos),
      redimension: () => imagenRepository.actualizarRedimension(imagenId, datos),
      conversion: () => imagenRepository.actualizarConversion(imagenId, datos),
      marcaAgua: () => imagenRepository.actualizarMarcaAgua(imagenId, datos),
    };
    await actualizadores[etapa]?.();

    // 3. Actualizar métricas en memoria
    const job = this._jobs.get(jobId);
    if (job) {
      const m = job.metricas[etapa];
      m.procesados += 1;
      m.tiempoTotal += tiempoSeg;
      if (!exito) m.fallidos += 1;
    }

    // 4. Verificar si el job terminó
    const completado = await jobRepository.verificarCompletado(jobId);
    if (completado) {
      const estadoFinal = await jobRepository.determinarEstadoFinal(jobId);
      if (job) {
        job.estado = estadoFinal;
        job.fechaFin = new Date().toISOString();
      }
      console.log(`✓ Job ${jobId.slice(0, 8)}... finalizado con estado: ${estadoFinal}`);
    }
  }

  async construirRespuestaEstado(jobId) {
    const jobMemoria = this._jobs.get(jobId);
    const jobBD = jobMemoria || await jobRepository.obtenerPorId(jobId);
    if (!jobBD) return null;

    const inicio = new Date(jobBD.fechaInicio || jobBD.fecha_inicio);
    const fin = (jobBD.fechaFin || jobBD.fecha_fin)
      ? new Date(jobBD.fechaFin || jobBD.fecha_fin)
      : new Date();
    const tiempoTotalSeg = parseFloat(((fin - inicio) / 1000).toFixed(2));

    const formatearMetrica = (m, nombre) => {
      const exitosos = m.procesados - m.fallidos;
      return {
        nombreEtapa: nombre,
        totalProcesados: m.procesados,
        totalFallidos: m.fallidos,
        tiempoAcumuladoSeg: parseFloat(m.tiempoTotal.toFixed(4)),
        tiempoPromedioSeg: exitosos > 0
          ? parseFloat((m.tiempoTotal / exitosos).toFixed(4))
          : 0,
      };
    };

    const metricas = jobMemoria?.metricas || {
      descarga: { procesados: jobBD.desc_procesados, fallidos: jobBD.desc_fallidos, tiempoTotal: parseFloat(jobBD.desc_tiempo_total) },
      redimension: { procesados: jobBD.redi_procesados, fallidos: jobBD.redi_fallidos, tiempoTotal: parseFloat(jobBD.redi_tiempo_total) },
      conversion: { procesados: jobBD.conv_procesados, fallidos: jobBD.conv_fallidos, tiempoTotal: parseFloat(jobBD.conv_tiempo_total) },
      marcaAgua: { procesados: jobBD.agua_procesados, fallidos: jobBD.agua_fallidos, tiempoTotal: parseFloat(jobBD.agua_tiempo_total) },
    };

    const totalRecibidos = jobBD.urls?.length || jobBD.urls_totales;
    const totalConError = metricas.descarga.fallidos + metricas.redimension.fallidos + metricas.conversion.fallidos + metricas.marcaAgua.fallidos;
    const pctExito = totalRecibidos > 0
      ? parseFloat(((totalRecibidos - totalConError) / totalRecibidos * 100).toFixed(2))
      : 0;

    return {
      jobId: jobBD.jobId || jobBD.job_id,
      estado: jobBD.estado,
      fechaInicio: inicio.toISOString(),
      fechaFin: (jobBD.fechaFin || jobBD.fecha_fin) || null,
      tiempoTotalSeg,

      metricasDescarga: formatearMetrica(metricas.descarga, 'DESCARGA'),
      metricasRedimension: formatearMetrica(metricas.redimension, 'REDIMENSION'),
      metricasConversion: formatearMetrica(metricas.conversion, 'CONVERSION'),
      metricasMarcaAgua: formatearMetrica(metricas.marcaAgua, 'MARCA_AGUA'),

      resumenGlobal: {
        totalRecibidos,
        totalConError,
        porcentajeExito: pctExito,
        porcentajeFallo: parseFloat((100 - pctExito).toFixed(2)),
      },
    };
  }
}

export const stateStore = new StateStore();