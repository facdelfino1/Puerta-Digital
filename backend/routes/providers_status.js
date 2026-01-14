const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireSupervisor } = require('../middleware/auth');
const { db } = require("../lib/database");
const { addMonths, differenceInDays } = require('date-fns');

const router = express.Router();

const PROVIDER_UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'providers');
fs.mkdirSync(PROVIDER_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PROVIDER_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    const base = path.basename(file.originalname, path.extname(file.originalname))
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-_]/g, '') || 'document';
    cb(null, `${Date.now()}-${base}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

async function ensureProvider({ name, dni, area, supervisor_id }) {
  const existing = await db.query('SELECT id FROM providers WHERE dni=@dni', { dni });
  let providerId;
  if (existing.recordset[0]) {
    providerId = existing.recordset[0].id;
    await db.query(
      `UPDATE providers SET name=@name, area=@area, supervisor_id=@supervisor_id, updated_at=GETDATE()
       WHERE id=@id`,
      { id: providerId, name, area, supervisor_id }
    );
  } else {
    const insert = await db.query(
      `INSERT INTO providers (name, dni, area, supervisor_id, vehicle_access)
       VALUES (@name, @dni, @area, @supervisor_id, 0);
       SELECT SCOPE_IDENTITY() AS id`,
      { name, dni, area, supervisor_id }
    );
    providerId = insert.recordset[0].id;
  }
  return providerId;
}

router.post(
  '/',
  authenticateToken,
  requireSupervisor,
  upload.single('pdf'),
  async (req, res) => {
    const { name, dni, area, supervisor_id, doc_type = 'general', allows_vehicle = 'false' } = req.body;
    const supervisorId = supervisor_id ? Number(supervisor_id) : null;
    if (!name || !dni) {
      if (req.file) fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ success: false, message: 'Nombre y DNI son requeridos' });
    }

    const upload_date = new Date();
    const expiration_date = addMonths(upload_date, 1);
    const dias_restantes = differenceInDays(expiration_date, upload_date);
    const estado = dias_restantes > 0 ? 'vigente' : 'vencido';

    try {
      const providerId = await ensureProvider({ name, dni, area, supervisor_id: supervisorId });
      const pdf_path = req.file ? `/uploads/providers/${req.file.filename}` : null;

      if (pdf_path) {
        await db.query(
          `INSERT INTO provider_docs (provider_id, doc_type, pdf_path, allows_vehicle, upload_date, expiration_date, uploaded_by, estado, dias_restantes)
           VALUES (@provider_id, @doc_type, @pdf_path, @allows_vehicle, @upload_date, @expiration_date, @uploaded_by, @estado, @dias_restantes)`,
          {
            provider_id: providerId,
            doc_type: doc_type === 'vehicle' ? 'vehicle' : 'general',
            pdf_path,
            allows_vehicle: doc_type === 'vehicle' && (allows_vehicle === 'true' || allows_vehicle === true) ? 1 : 0,
            upload_date,
            expiration_date,
            uploaded_by: req.user?.id || supervisorId,
            estado,
            dias_restantes,
          }
        );

        if (doc_type === 'vehicle') {
          await db.query(
            'UPDATE providers SET vehicle_access=@access, updated_at=GETDATE() WHERE id=@id',
            { id: providerId, access: allows_vehicle === 'true' ? 1 : 0 }
          );
        }
      }

      return res.json({
        success: true,
        data: {
          provider_id: providerId,
          name,
          dni,
          area,
          pdf_path,
          expiration_date,
          estado,
          dias_restantes
        }
      });
    } catch (err) {
      console.error('Error en POST /providers/status:', err);
      if (req.file) fs.promises.unlink(req.file.path).catch(() => {});
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /providers/status/resumen
 * Devuelve totales de proveedores por estado
 */
router.get(
  "/resumen",
  authenticateToken,
  requireSupervisor,
  async (_req, res) => {
    try {
      // <<< CORREGIDO: La consulta ahora está envuelta en backticks (` `)
      const result = await db.query(`
        WITH latest AS (
          SELECT p.id, p.is_active, d.expiration_date
          FROM providers p
          OUTER APPLY (
            SELECT TOP 1 expiration_date
            FROM provider_docs
            WHERE provider_id = p.id
            ORDER BY upload_date DESC
          ) d
        )
        SELECT
          SUM(CASE WHEN latest.expiration_date IS NOT NULL AND latest.expiration_date < SYSDATETIME() THEN 1 ELSE 0 END) AS total_vencidos,
          SUM(CASE WHEN latest.expiration_date IS NOT NULL AND DATEDIFF(DAY, SYSDATETIME(), latest.expiration_date) BETWEEN 0 AND 10 THEN 1 ELSE 0 END) AS total_por_vencer,
          SUM(CASE WHEN latest.expiration_date IS NOT NULL AND latest.expiration_date > DATEADD(DAY, 10, SYSDATETIME()) THEN 1 ELSE 0 END) AS total_vigentes
        FROM latest
        WHERE is_active = 1;
      `);

      res.json({
        success: true,
        // <<< CORREGIDO: Aseguramos que `resumen` sea un objeto aunque no haya resultados
        resumen: result.recordset[0] || { total_vencidos: 0, total_por_vencer: 0, total_vigentes: 0 },
      });
    } catch (err) {
      console.error("Error al obtener resumen de proveedores:", err);
      res
        .status(500)
        .json({ error: "Error interno al obtener resumen de proveedores" });
    }
  }
);

// <<< ELIMINADO: module.exports = router; de aquí

// GET /providers/status?dni=XXXX
router.get('/', authenticateToken, async (req, res) => {
  const { dni } = req.query;
  if (!dni || typeof dni !== 'string') {
    return res.status(400).json({ error: 'dni is required' });
  }

  try {
    const personRes = await db.query(
      `SELECT TOP 1 p.id, p.name, p.type, a.name AS areaName
       FROM people p
       LEFT JOIN areas a ON a.id = p.area_id
       WHERE p.dni = @dni`,
      { dni }
    );

    if (!personRes.recordset[0]) {
      return res.json({ exists: false });
    }

    const person = personRes.recordset[0];

    const insideRes = await db.query(
      `SELECT TOP 1 id FROM access_logs WHERE person_id=@pid AND exit_time IS NULL`,
      { pid: person.id }
    );

    const vehiclesRes = await db.query(
      `SELECT id, license_plate AS licensePlate, brand, model
       FROM vehicles
       WHERE person_id=@pid`,
      { pid: person.id }
    );

    return res.json({
      exists: true,
      name: person.name,
      type: person.type,
      area: person.areaName || null,
      isInside: !!insideRes.recordset[0],
      vehicles: vehiclesRes.recordset || []
    });
  } catch (err) {
    console.error('Error en GET /providers/status:', err);
    return res.status(500).json({ error: 'Error consultando DNI' });
  }
});

// <<< CORREGIDO: Solo hay una exportación al final del archivo
module.exports = router;