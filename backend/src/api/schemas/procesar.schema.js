// Schema que valida el BODY del POST /procesar
export const procesarBodySchema = {
  type: 'object',
  required: ['urls', 'workers'],
  properties: {

    urls: {
      type: 'array',
      minItems: 1,
      maxItems: 500,
      items: {
        type:   'string',
        format: 'uri'       // Fastify valida que cada item sea una URL válida
      },
      description: 'Lista de URLs de imágenes a procesar'
    },

    workers: {
      type: 'object',
      required: ['descarga', 'redimension', 'conversion', 'marcaAgua'],
      properties: {
        descarga: {
          type: 'integer', minimum: 1,
          description: 'Número de workers para descarga'
        },
        redimension: {
          type: 'integer', minimum: 1,
          description: 'Número de workers para redimensionamiento'
        },
        conversion: {
          type: 'integer', minimum: 1,
          description: 'Número de workers para conversión de formato'
        },
        marcaAgua: {
          type: 'integer', minimum: 1,
          description: 'Número de workers para marca de agua'
        }
      }
    }
  }
};

// Schema de la RESPUESTA del POST /procesar
export const procesarResponseSchema = {
  202: {
    type: 'object',
    properties: {
      jobId:         { type: 'string' },
      mensaje:       { type: 'string' },
      totalImagenes: { type: 'integer' },
      estado:        { type: 'string' },
      fechaInicio:   { type: 'string' }
    }
  }
};