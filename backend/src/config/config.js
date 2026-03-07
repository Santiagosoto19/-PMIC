import 'dotenv/config';

export const config = {

  server: {
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || '0.0.0.0',
  },

  // Datos de conexión a PostgreSQL
  database: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'pmic_db',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || '',
  
    max: 20,
  },

  pipeline: {
    maxUrls:      parseInt(process.env.MAX_URLS)      || 500,
    maxDimension: parseInt(process.env.MAX_DIMENSION) || 800,
  },

  storage: {
    downloads:   process.env.STORAGE_DOWNLOADS   || './storage/downloads',
    resized:     process.env.STORAGE_RESIZED     || './storage/resized',
    converted:   process.env.STORAGE_CONVERTED   || './storage/converted',
    watermarked: process.env.STORAGE_WATERMARKED || './storage/watermarked',
  },

};