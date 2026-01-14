const express = require("express")
const { db } = require("../lib/database");
const router = express.Router()
const { authenticateToken, requireAdmin } = require("../middleware/auth")
const { validate } = require("../middleware/validate")
const { settingsUpdateSchema } = require("../validation/schemas")

const DEFAULTS = {
  companyName: "",
  timezone: "America/Argentina/Buenos_Aires",
  sessionTimeout: 24,
  autoLogout: 1,
  emailNotifications: 1,
  smsNotifications: 0,
  requirePhotoUpload: 1,
  allowBulkImport: 1,
  maxLoginAttempts: 3,
  passwordMinLength: 8,
}

// Ensure settings table exists (first-run)
async function ensureSettingsTable() {
  const sql = `
    IF NOT EXISTS (
      SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.settings') AND type in (N'U')
    )
    BEGIN
      CREATE TABLE dbo.settings (
        [key] NVARCHAR(100) NOT NULL PRIMARY KEY,
        [value] NVARCHAR(255) NULL
      );
    END
  `
  try {
    await db.query(sql)
  } catch (e) {
    // log and continue; GET handler can still return defaults
    console.warn("ensureSettingsTable failed:", e?.message || e)
  }
}

async function loadSettings() {
  await ensureSettingsTable()
  const r = await db.query("SELECT [key],[value] FROM settings", {})
  const map = { ...DEFAULTS }
  r.recordset.forEach(row => {
    const k = row.key
    let v = row.value
    if (["sessionTimeout","maxLoginAttempts","passwordMinLength"].includes(k)) v = Number(v)
    if (["autoLogout","emailNotifications","smsNotifications","requirePhotoUpload","allowBulkImport"].includes(k)) v = !!Number(v)
    map[k] = v
  })
  return map
}

// Asume tabla [settings] con columna [key],[value] (key nvarchar, value sql_variant / nvarchar)
router.get("/", authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const map = await loadSettings()
    res.json(map)
  } catch {
    // Si no existe tabla devolvemos defaults
    res.json(DEFAULTS)
  }
})

router.get("/public", authenticateToken, async (_req, res) => {
  try {
    const settings = await loadSettings()
    res.json({
      companyName: settings.companyName || "",
      timezone: settings.timezone || DEFAULTS.timezone,
    })
  } catch {
    res.json({
      companyName: DEFAULTS.companyName,
      timezone: DEFAULTS.timezone,
    })
  }
})

router.put("/", authenticateToken, requireAdmin, validate(settingsUpdateSchema), async (req, res) => {
  const body = req.validated
  try {
    await ensureSettingsTable()
    // Upsert simple
    for (const [k, v] of Object.entries(body)) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULTS, k)) continue
      await db.query(
        `MERGE settings WITH (HOLDLOCK) AS tgt
         USING (SELECT @k AS [key], @v AS [value]) AS src
         ON tgt.[key]=src.[key]
         WHEN MATCHED THEN UPDATE SET [value]=src.[value]
         WHEN NOT MATCHED THEN INSERT([key],[value]) VALUES(src.[key],src.[value]);`,
        { k, v: v === true ? 1 : v === false ? 0 : v }
      )
    }
    res.status(204).end()
  } catch (e) {
    console.error("SETTINGS PUT ERROR", e)
    res.status(500).json({ error: "No se pudo guardar configuración" })
  }
})

module.exports = router
