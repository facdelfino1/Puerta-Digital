const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const { db } = require("../lib/database");
const { getLocalizedCurrentTimestamp } = require("../lib/timezone")

const router = express.Router();

/**
 * POST /access_logs
 * Registra una entrada o salida de una persona/proveedor
 * Body: { dni, action: "entry" | "exit", vehicle_id?, notes? }
 */
router.post("/", authenticateToken, async (req, res) => {
  const { dni, action, vehicle_id = null, notes = null } = req.body;
  const guard_user_id = req.user.id; // obtenido del token

  try {
    // 1. Buscar persona
    const personRes = await db.query(
      "SELECT TOP 1 id, name, type, is_active AS isActive FROM people WHERE dni=@dni",
      { dni: dni }
    );

    if (!personRes.recordset[0]) {
      return res.status(404).json({ error: "Persona no encontrada" });
    }

    const personId = personRes.recordset[0].id;
    const personType = personRes.recordset[0].type;
    const personActive = personRes.recordset[0].isActive;

    if (!personActive && action === "entry") {
      return res.status(403).json({ error: "Persona inactiva. Ingreso no permitido." });
    }

    if (personType === "proveedor" && action === "entry") {
      const providerStatusRes = await db.query(
        `SELECT TOP 1
                CASE
                  WHEN p.is_active = 0 THEN 'inactivo'
                  WHEN COALESCE(latest.has_doc, 0) = 0 THEN 'vencido'
                  WHEN latest.expiration_date IS NULL THEN 'vencido'
                  WHEN latest.expiration_date < SYSDATETIME() THEN 'vencido'
                  WHEN DATEDIFF(DAY, SYSDATETIME(), latest.expiration_date) BETWEEN 0 AND 10 THEN 'por_vencer'
                  ELSE 'vigente'
                END AS status
         FROM providers p
         OUTER APPLY (
           SELECT TOP 1 expiration_date, 1 AS has_doc
           FROM provider_docs
           WHERE provider_id = p.id
           ORDER BY upload_date DESC
         ) latest
         WHERE p.dni = @dni`,
        { dni }
      );

      const providerStatus = providerStatusRes.recordset[0];
      if (!providerStatus) {
        return res.status(403).json({ error: "Proveedor sin registro. Ingreso no permitido." });
      }

      if (providerStatus.status === "vencido") {
        return res.status(403).json({ error: "Proveedor con documentacion vencida. Ingreso no permitido." });
      }

      if (providerStatus.status === "inactivo") {
        return res.status(403).json({ error: "Proveedor inactivo. Ingreso no permitido." });
      }
    }

    // 2. Registrar entrada o salida
    if (action === "entry") {
      const timestamp = await getLocalizedCurrentTimestamp()
      await db.query(
        `INSERT INTO access_logs (person_id, vehicle_id, entry_time, notes, guard_user_id, created_at)
         VALUES (@personId, @vehicleId, CONVERT(DATETIME2, @ts, 120), @notes, @guard_user_id, CONVERT(DATETIME2, @ts, 120))`,
        { personId, vehicleId: vehicle_id, notes, guard_user_id, ts: timestamp }
      );
    } else if (action === "exit") {
      const timestamp = await getLocalizedCurrentTimestamp()
      const updateRes = await db.query(
        `UPDATE access_logs
         SET exit_time = CONVERT(DATETIME2, @ts, 120), notes = @notes
         WHERE person_id=@personId AND exit_time IS NULL`,
        { personId, notes, ts: timestamp }
      );

      if (updateRes.rowsAffected[0] === 0) {
        return res.status(400).json({ error: "No hay registro de entrada abierto para esta persona" });
      }
    } else {
      return res.status(400).json({ error: "Acción inválida, debe ser 'entry' o 'exit'" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("ACCESS_LOG POST ERROR", err);
    res.status(500).json({ error: "Error registrando acceso" });
  }
});

/**
 * GET /access_logs
 * Lista los últimos accesos registrados (personas + vehículos + guardia)
 * Query params: ?limit=50
 */
function formatDbDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const pad = (num) => num.toString().padStart(2, "0")
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
}

router.get("/", authenticateToken, async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;

  try {
    const r = await db.query(
      `SELECT TOP (${limit})
              l.id,
              l.entry_time,
              l.exit_time,
              l.notes,
              p.name AS personName,
              p.dni AS personDni,
              p.type AS personType,
              v.license_plate AS vehiclePlate,
              v.brand AS vehicleBrand,
              v.model AS vehicleModel,
              COALESCE(gp.name, u.email) AS guardName
       FROM access_logs l
       JOIN people p ON p.id = l.person_id
       LEFT JOIN vehicles v ON v.id = l.vehicle_id
       JOIN users u ON u.id = l.guard_user_id
       LEFT JOIN people gp ON gp.id = u.person_id
       ORDER BY l.entry_time DESC`,
      {}
    );

    const records = r.recordset.map((row) => ({
      ...row,
      entry_time: formatDbDate(row.entry_time),
      exit_time: formatDbDate(row.exit_time),
      entryTime: formatDbDate(row.entry_time),
      exitTime: formatDbDate(row.exit_time),
      guardName: row.guardName,
    }))

    res.json({ accessLogs: records });
  } catch (err) {
    console.error("ACCESS_LOG GET ERROR", err);
    res.status(500).json({ error: "Error obteniendo registros de acceso" });
  }
});

module.exports = router;
 
