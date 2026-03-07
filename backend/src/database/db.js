import pg from 'pg';
import { config } from '../config/config.js';

const { Pool } = pg;

const pool = new Pool({
  host:     config.database.host,
  port:     config.database.port,
  database: config.database.database,
  user:     config.database.user,
  password: config.database.password,
  max:      config.database.max,
});

// Se dispara cada vez que el pool abre una conexión nueva
pool.on('connect', () => {
  console.log('✓ Conexión establecida con PostgreSQL');
});

// Se dispara si una conexión inactiva tiene un error de red.
// Sin esto, ese error podría tumbar toda la app.
pool.on('error', (err) => {
  console.error('✗ Error en el pool de PostgreSQL:', err.message);
});

// Verifica que la BD esté accesible al arrancar.
// Si no lo está, el proceso termina inmediatamente con un mensaje claro.
export async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() AS tiempo');
    console.log(`✓ PostgreSQL listo. Hora servidor: ${result.rows[0].tiempo}`);
  } catch (error) {
    console.error('✗ No se pudo conectar a PostgreSQL:', error.message);
    console.error('  Verifica los datos en tu archivo .env');
    process.exit(1);
  }
}

export default pool;