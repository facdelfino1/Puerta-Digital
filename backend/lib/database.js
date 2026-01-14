// backend/lib/database.js
const sql = require("mssql");

// 🔍 Detectar modo de autenticación
const hasSqlAuth = !!process.env.DB_USER && !!process.env.DB_PASSWORD;

// 🔧 Configuración base
const baseConfig = {
  server: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME || "access_control_db",
  options: {
    encrypt: true,
    trustServerCertificate: true, // para entornos locales
  },
};

// 🔐 Modo SQL Auth
const sqlAuthConfig = {
  ...baseConfig,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

// 🪟 Modo Windows Auth
const windowsAuthConfig = {
  ...baseConfig,
  options: {
    ...baseConfig.options,
    trustedConnection: true,
  },
};

// 🔁 Configuración final
const config = hasSqlAuth ? sqlAuthConfig : windowsAuthConfig;

// 🧱 Pool persistente
let poolPromise = null;

/**
 * Obtiene o crea una conexión SQL reutilizable
 */
async function getPool() {
  if (poolPromise) {
    try {
      await poolPromise.connect(); // verifica si sigue activa
      return poolPromise;
    } catch {
      console.warn("♻️ Reintentando conexión SQL...");
    }
  }

  try {
    poolPromise = await sql.connect(config);
    return poolPromise;
  } catch (err) {
    throw err;
  }
}

/**
 * Ejecuta una query SQL con parámetros seguros
 */
async function query(sqlText, params = {}) {
  const pool = await getPool();
  const request = pool.request();

  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }

  try {
    const result = await request.query(sqlText);
    return result;
  } catch (err) {
    console.error("❌ Error ejecutando query:", err.message);
    throw err;
  }
}

module.exports = { db: { query } };
