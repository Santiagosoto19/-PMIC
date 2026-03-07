// Schema reutilizable para las métricas de cada etapa
const metricaEtapaSchema = {
  type: 'object',
  properties: {
    nombreEtapa:        { type: 'string' },
    totalProcesados:    { type: 'integer' },
    totalFallidos:      { type: 'integer' },
    tiempoAcumuladoSeg: { type: 'number' },
    tiempoPromedioSeg:  { type: 'number' }
  }
};

// Schema de la RESPUESTA del GET /estado/:jobId
export const estadoResponseSchema = {
  200: {
    type: 'object',
    properties: {
      jobId:          { type: 'string' },
      estado: {
        type: 'string',
        enum: ['EN_PROCESO', 'COMPLETADO', 'COMPLETADO_CON_ERRORES', 'FALLIDO']
      },
      fechaInicio:    { type: 'string' },
      fechaFin:       { type: ['string', 'null'] },
      tiempoTotalSeg: { type: 'number' },

      metricasDescarga:    metricaEtapaSchema,
      metricasRedimension: metricaEtapaSchema,
      metricasConversion:  metricaEtapaSchema,
      metricasMarcaAgua:   metricaEtapaSchema,

      resumenGlobal: {
        type: 'object',
        properties: {
          totalRecibidos:   { type: 'integer' },
          totalConError:    { type: 'integer' },
          porcentajeExito:  { type: 'number' },
          porcentajeFallo:  { type: 'number' }
        }
      }
    }
  },

  404: {
    type: 'object',
    properties: {
      error:   { type: 'string' },
      mensaje: { type: 'string' }
    }
  }
};