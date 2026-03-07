import { testConnection }  from './database/db.js';
import { runMigrations }   from './database/migrations.js';
import { buildServer }     from './server.js';
import { config }          from './config/config.js';
import fs from 'fs';

async function start() {

  // 1. Crear carpetas de storage
  Object.values(config.storage).forEach(dir => {
    fs.mkdirSync(dir, { recursive: true });
  });
  console.log('✓ Directorios de storage listos');

  // 2. Conectar PostgreSQL
  await testConnection();

  // 3. Crear tablas
  await runMigrations();

  // 4. Construir y arrancar servidor
  const fastify = await buildServer();
  await fastify.listen({
    port: config.server.port,
    host: config.server.host,
  });

  console.log(`✓ Servidor en http://localhost:${config.server.port}`);
  console.log(`✓ Documentación en http://localhost:${config.server.port}/docs`);
}

start();
