const express = require("express");
const { authenticateToken, requireAnyRole } = require("../middleware/auth");
const { db } = require("../lib/database");

const router = express.Router();

router.get("/summary", async (_req, res) => {
  try {
    const totalPeopleQuery = await db.query(
      "SELECT COUNT(1) AS total FROM people",
      {}
    );

    const currentlyInsideQuery = await db.query(
      `SELECT COUNT(1) AS total
       FROM access_logs
       WHERE exit_time IS NULL`,
      {}
    );

    const todayEntriesQuery = await db.query(
      `SELECT COUNT(1) AS total
       FROM access_logs
       WHERE entry_time IS NOT NULL
         AND CAST(entry_time AS DATE) = CAST(GETDATE() AS DATE)`,
      {}
    );

    const todayExitsQuery = await db.query(
      `SELECT COUNT(1) AS total
       FROM access_logs
       WHERE exit_time IS NOT NULL
         AND CAST(exit_time AS DATE) = CAST(GETDATE() AS DATE)`,
      {}
    );

    res.json({
      totalPeople: totalPeopleQuery.recordset[0]?.total || 0,
      currentlyInside: currentlyInsideQuery.recordset[0]?.total || 0,
      todayEntries: todayEntriesQuery.recordset[0]?.total || 0,
      todayExits: todayExitsQuery.recordset[0]?.total || 0,
    });
  } catch (err) {
    console.error("DASHBOARD SUMMARY ERROR", err);
    res.json({
      totalPeople: 0,
      currentlyInside: 0,
      todayEntries: 0,
      todayExits: 0,
    });
  }
});

router.get(
  "/details",
  authenticateToken,
  requireAnyRole(["guardia", "supervisor", "administrador"]),
  async (req, res) => {
    const type = (req.query.type || "").toString();
    const search = (req.query.q || "").toString().trim();
    const like = search ? `%${search}%` : null;

    try {
      if (type === "people") {
        const result = await db.query(
          `SELECT p.id,
                  p.name,
                  p.dni,
                  p.email,
                  p.type,
                  p.created_at AS createdAt,
                  a.name AS area
           FROM people p
           LEFT JOIN areas a ON a.id = p.area_id
           ${like ? "WHERE p.name LIKE @term OR p.dni LIKE @term" : ""}
           ORDER BY p.created_at DESC`,
          like ? { term: like } : {}
        );

        return res.json({ type, records: result.recordset });
      }

      if (type === "inside") {
        const result = await db.query(
          `SELECT l.id AS logId,
                  p.name AS personName,
                  p.dni,
                  p.type,
                  a.name AS area,
                  l.entry_time AS entryTime,
                  COALESCE(guardPerson.name, u.email) AS guardName
           FROM access_logs l
           JOIN people p ON p.id = l.person_id
           LEFT JOIN areas a ON a.id = p.area_id
           LEFT JOIN users u ON u.id = l.guard_user_id
           LEFT JOIN people guardPerson ON guardPerson.id = u.person_id
           WHERE l.exit_time IS NULL
           ${like ? "AND (p.name LIKE @term OR p.dni LIKE @term)" : ""}
           ORDER BY l.entry_time DESC`,
          like ? { term: like } : {}
        );

        const records = result.recordset.map((row) => ({
          ...row,
          entryTime: formatDbDate(row.entryTime),
        }))

        return res.json({ type, records });
      }

      if (type === "entriesToday") {
        const result = await db.query(
          `SELECT l.id AS logId,
                  p.name AS personName,
                  p.dni,
                  p.type,
                  a.name AS area,
                  l.entry_time AS entryTime,
                  l.notes,
                  COALESCE(guardPerson.name, u.email) AS guardName
           FROM access_logs l
           JOIN people p ON p.id = l.person_id
           LEFT JOIN areas a ON a.id = p.area_id
           LEFT JOIN users u ON u.id = l.guard_user_id
           LEFT JOIN people guardPerson ON guardPerson.id = u.person_id
           WHERE l.entry_time IS NOT NULL
             AND CAST(l.entry_time AS DATE) = CAST(GETDATE() AS DATE)
             ${like ? "AND (p.name LIKE @term OR p.dni LIKE @term)" : ""}
           ORDER BY l.entry_time DESC`,
          like ? { term: like } : {}
        );

        const records = result.recordset.map((row) => ({
          ...row,
          entryTime: formatDbDate(row.entryTime),
        }))

        return res.json({ type, records });
      }

      if (type === "exitsToday") {
        const result = await db.query(
          `SELECT l.id AS logId,
                  p.name AS personName,
                  p.dni,
                  p.type,
                  a.name AS area,
                  l.exit_time AS exitTime,
                  l.notes,
                  COALESCE(guardPerson.name, u.email) AS guardName
           FROM access_logs l
           JOIN people p ON p.id = l.person_id
           LEFT JOIN areas a ON a.id = p.area_id
           LEFT JOIN users u ON u.id = l.guard_user_id
           LEFT JOIN people guardPerson ON guardPerson.id = u.person_id
           WHERE l.exit_time IS NOT NULL
             AND CAST(l.exit_time AS DATE) = CAST(GETDATE() AS DATE)
             ${like ? "AND (p.name LIKE @term OR p.dni LIKE @term)" : ""}
           ORDER BY l.exit_time DESC`,
          like ? { term: like } : {}
        );

        const records = result.recordset.map((row) => ({
          ...row,
          exitTime: formatDbDate(row.exitTime),
        }))

        return res.json({ type, records });
      }

      if (
        type === "providers" ||
        type === "providersExpiring" ||
        type === "providersExpired"
      ) {
        const result = await db.query(
          `SELECT p.id,
                  p.name,
                  p.dni,
                  p.area,
                  p.vehicle_access AS vehicleAccess,
                  latest.pdf_path AS pdfPath,
                  latest.expiration_date AS expirationDate,
                  COALESCE(latest.has_doc, 0) AS hasDocs,
                  CASE
                    WHEN COALESCE(latest.has_doc, 0) = 0 THEN 'vencido'
                    WHEN latest.expiration_date IS NULL THEN 'vencido'
                    WHEN latest.expiration_date < SYSDATETIME() THEN 'vencido'
                    WHEN DATEDIFF(day, SYSDATETIME(), latest.expiration_date) BETWEEN 0 AND 10 THEN 'por_vencer'
                    ELSE 'vigente'
                  END AS status,
                  DATEDIFF(day, SYSDATETIME(), latest.expiration_date) AS daysRemaining
           FROM providers p
           OUTER APPLY (
             SELECT TOP 1 d.pdf_path, d.expiration_date, 1 AS has_doc
             FROM provider_docs d
             WHERE d.provider_id = p.id
             ORDER BY d.upload_date DESC
           ) latest
           WHERE p.is_active = 1
             ${like ? "AND (p.name LIKE @term OR p.dni LIKE @term)" : ""}
           ORDER BY p.name ASC`,
          like ? { term: like } : {}
        );

        let records = result.recordset.map((row) => ({
          ...row,
          nearExpiry: row.status === "por_vencer",
        }));

        if (type === "providersExpiring") {
          records = records.filter((row) => row.status === "por_vencer");
        }

        if (type === "providersExpired") {
          records = records.filter((row) => row.status === "vencido");
        }

        return res.json({ type, records });
      }

      return res.status(400).json({ error: "Tipo de detalle invalido" });
    } catch (err) {
      console.error("DASHBOARD DETAILS ERROR", err);
      res.status(500).json({ error: "Error obteniendo detalle" });
    }
  }
);

module.exports = router;
function formatDbDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const pad = (num) => num.toString().padStart(2, "0")
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
}
