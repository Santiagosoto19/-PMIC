import pool from './db.js';

export async function runMigrations() {
  console.log('Ejecutando migraciones...');

  try {

    // ── Tabla jobs ──
    // Una fila por cada solicitud POST /procesar que recibe la API.
    // Guarda la configuración recibida y las métricas acumuladas
    // de cada etapa que se van actualizando conforme workers terminan.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS jobs (

        job_id       TEXT PRIMARY KEY,
        estado       TEXT NOT NULL DEFAULT 'EN_PROCESO',
        fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        fecha_fin    TIMESTAMPTZ,

        urls_totales        INTEGER NOT NULL DEFAULT 0,
        workers_descarga    INTEGER NOT NULL DEFAULT 1,
        workers_redimension INTEGER NOT NULL DEFAULT 1,
        workers_conversion  INTEGER NOT NULL DEFAULT 1,
        workers_marca_agua  INTEGER NOT NULL DEFAULT 1,

        -- Métricas etapa Descarga
        desc_procesados   INTEGER NOT NULL DEFAULT 0,
        desc_fallidos     INTEGER NOT NULL DEFAULT 0,
        desc_tiempo_total NUMERIC NOT NULL DEFAULT 0,

        -- Métricas etapa Redimensión
        redi_procesados   INTEGER NOT NULL DEFAULT 0,
        redi_fallidos     INTEGER NOT NULL DEFAULT 0,
        redi_tiempo_total NUMERIC NOT NULL DEFAULT 0,

        -- Métricas etapa Conversión
        conv_procesados   INTEGER NOT NULL DEFAULT 0,
        conv_fallidos     INTEGER NOT NULL DEFAULT 0,
        conv_tiempo_total NUMERIC NOT NULL DEFAULT 0,

        -- Métricas etapa Marca de Agua
        agua_procesados   INTEGER NOT NULL DEFAULT 0,
        agua_fallidos     INTEGER NOT NULL DEFAULT 0,
        agua_tiempo_total NUMERIC NOT NULL DEFAULT 0,

        CONSTRAINT jobs_estado_valido CHECK (estado IN (
          'EN_PROCESO',
          'COMPLETADO',
          'COMPLETADO_CON_ERRORES',
          'FALLIDO'
        ))
      )
    `);

    // ── Tabla imagenes ──
    // Una fila por cada imagen dentro de un job.
    // Las columnas se van llenando etapa por etapa.
    // Las columnas de error (error_descarga, error_redimension, etc.)
    // son el registro del Error Manager — si un worker falla,
    // guarda el mensaje aquí y el estado cambia a ERROR_*.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS imagenes (

        imagen_id    TEXT PRIMARY KEY,
        job_id       TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
        url_original TEXT NOT NULL,
        estado       TEXT NOT NULL DEFAULT 'PENDIENTE',

        -- Etapa 1: Descarga
        fecha_descarga      TIMESTAMPTZ,
        tamano_mb           NUMERIC,
        tiempo_descarga_seg NUMERIC,
        worker_descarga     TEXT,
        ruta_descargada     TEXT,
        error_descarga      TEXT,      -- ← Error Manager: guarda qué falló

        -- Etapa 2: Redimensión
        ancho_original         INTEGER,
        alto_original          INTEGER,
        ancho_final            INTEGER,
        alto_final             INTEGER,
        tiempo_redimension_seg NUMERIC,
        worker_redimension     TEXT,
        ruta_redimensionada    TEXT,
        error_redimension      TEXT,   -- ← Error Manager

        -- Etapa 3: Conversión
        formato_original      TEXT,
        tiempo_conversion_seg NUMERIC,
        worker_conversion     TEXT,
        ruta_convertida       TEXT,
        error_conversion      TEXT,    -- ← Error Manager

        -- Etapa 4: Marca de Agua
        tiempo_marca_agua_seg NUMERIC,
        worker_marca_agua     TEXT,
        ruta_marca_agua       TEXT,
        error_marca_agua      TEXT,    -- ← Error Manager

        CONSTRAINT imagenes_estado_valido CHECK (estado IN (
          'PENDIENTE',
          'EN_DESCARGA',     'DESCARGADA',
          'EN_REDIMENSION',  'REDIMENSIONADA',
          'EN_CONVERSION',   'CONVERTIDA',
          'EN_MARCA_AGUA',   'COMPLETADA',
          'ERROR_DESCARGA',  'ERROR_REDIMENSION',
          'ERROR_CONVERSION','ERROR_MARCA_AGUA'
        ))
      )
    `);

    // Índices para acelerar las consultas más frecuentes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_imagenes_job_id
      ON imagenes(job_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_imagenes_estado
      ON imagenes(job_id, estado)
    `);

    console.log('✓ Migraciones completadas');

  } catch (error) {
    console.error('✗ Error en migraciones:', error.message);
    process.exit(1);
  }
}