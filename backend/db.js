// ============================================================
// ITAMS - MySQL Connection Pool
// ============================================================

const mysql = require('mysql2/promise');

// ------------------------------------------------------------
// Required environment variables
// ------------------------------------------------------------

const requiredEnvVariables = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME'
];

for (const variable of requiredEnvVariables) {
  if (!process.env[variable]) {
    throw new Error(
      `[DB] Missing required environment variable: ${variable}`
    );
  }
}

// ------------------------------------------------------------
// MySQL connection pool
// ------------------------------------------------------------

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  charset: 'utf8mb4',

  connectTimeout: 10000
});

// ------------------------------------------------------------
// Test database connection
// ------------------------------------------------------------

async function testDatabaseConnection() {
  let connection;

  try {
    connection = await pool.getConnection();

    await connection.ping();

    console.log(
      `[DB] MySQL connected successfully to ${process.env.DB_HOST}:${process.env.DB_PORT}`
    );

  } catch (error) {

    console.error('\n============================================');
    console.error('[DB] MySQL connection FAILED');
    console.error('============================================');

    console.error('Error message :', error.message);
    console.error('Error code    :', error.code);
    console.error('Error errno   :', error.errno);
    console.error('Error sqlState :', error.sqlState);
    console.error('Error syscall  :', error.syscall);
    console.error('Full error    :', error);

    console.error('============================================\n');

    throw error;

  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// ------------------------------------------------------------
// Close database connection pool
// ------------------------------------------------------------

async function closeDatabaseConnection() {
  try {
    await pool.end();

    console.log('[DB] MySQL connection pool closed');

  } catch (error) {

    console.error(
      '[DB] Failed to close MySQL connection pool:',
      error
    );
  }
}

// ------------------------------------------------------------
// Export
// ------------------------------------------------------------

module.exports = pool;

module.exports.testDatabaseConnection =
  testDatabaseConnection;

module.exports.closeDatabaseConnection =
  closeDatabaseConnection;