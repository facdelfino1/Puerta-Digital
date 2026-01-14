const express = require("express")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const QRCode = require("qrcode")
const { db } = require("../lib/database")
const { authenticateToken, requireAnyRole } = require("../middleware/auth")
const { personCreateSchema, personUpdateSchema } = require("../validation/schemas")

const router = express.Router()

const ROOT_UPLOADS_DIR = path.join(__dirname, "..", "..", "public", "uploads")
const TEMP_DIR = path.join(ROOT_UPLOADS_DIR, "tmp")
fs.mkdirSync(TEMP_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, TEMP_DIR)
  },
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || ".jpg").toLowerCase()
    const base = path.basename(file.originalname, path.extname(file.originalname))
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "")
      || "photo"
    cb(null, `${Date.now()}-${base}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("INVALID_IMAGE_TYPE"))
    }
    cb(null, true)
  }
})

async function moveUploadedPhoto(file, personType) {
  if (!file) return null
  const subfolder = personType === "proveedor" ? "providers" : "people"
  const targetDir = path.join(ROOT_UPLOADS_DIR, subfolder)
  await fs.promises.mkdir(targetDir, { recursive: true })
  const targetPath = path.join(targetDir, file.filename)
  await fs.promises.rename(file.path, targetPath)
  return `/uploads/${subfolder}/${file.filename}`
}

async function removeTempFile(file) {
  if (!file) return
  try {
    await fs.promises.unlink(file.path)
  } catch {}
}

async function removeStoredFile(urlPath) {
  if (!urlPath || !urlPath.startsWith("/uploads/")) return
  const relative = urlPath.replace("/uploads/", "")
  const absolutePath = path.join(ROOT_UPLOADS_DIR, relative)
  try {
    await fs.promises.unlink(absolutePath)
  } catch {}
}

let supervisorColumnCache = null

async function hasSupervisorColumn() {
  if (supervisorColumnCache !== null) return supervisorColumnCache
  try {
    const result = await db.query(
      "SELECT COL_LENGTH('dbo.people', 'supervisor_user_id') AS colLength"
    )
    const colLength = result.recordset?.[0]?.colLength
    supervisorColumnCache = Boolean(colLength)
  } catch (err) {
    console.warn("Unable to inspect supervisor_user_id column, assuming absent:", err.message)
    supervisorColumnCache = false
  }
  return supervisorColumnCache
}

function parsePersonPayload(body) {
  const resolveSupervisorId = () => {
    const raw = body.supervisorId ?? body.supervisor_id
    if (raw === undefined || raw === null) return null
    if (typeof raw === "string") {
      const trimmed = raw.trim()
      if (!trimmed.length) return null
      return Number(trimmed)
    }
    return Number(raw)
  }

  return {
    dni: body.dni,
    name: body.name,
    email: body.email === "" ? null : body.email,
    type: body.type,
    areaId: Number(body.areaId),
    branch: body.branch,
    photoUrl: body.photoUrl || null,
    supervisorId: resolveSupervisorId(),
    isActive:
      typeof body.isActive === "string"
        ? body.isActive === "true"
        : Boolean(body.isActive ?? true),
  }
}

router.get("/", authenticateToken, requireAnyRole(["guardia","supervisor","administrador"]), async (_req, res) => {
  try {
    const includeSupervisor = await hasSupervisorColumn()
    const queryText = includeSupervisor
      ? `SELECT 
         p.id,
         p.dni,
         p.name,
         p.email,
         p.type,
         p.area_id AS areaId,
         p.sucursal AS branch,
         p.is_active AS isActive,
         p.photo_url AS photoUrl,
         p.supervisor_user_id AS supervisorUserId,
         COALESCE(supPerson.name, sup.email) AS supervisorName,
         a.name AS areaName
       FROM people p
       LEFT JOIN areas a ON a.id = p.area_id
       LEFT JOIN users sup ON sup.id = p.supervisor_user_id
       LEFT JOIN people supPerson ON sup.person_id = supPerson.id`
      : `SELECT 
         p.id,
         p.dni,
         p.name,
         p.email,
         p.type,
         p.area_id AS areaId,
         p.sucursal AS branch,
         p.is_active AS isActive,
         p.photo_url AS photoUrl,
         CAST(NULL AS INT) AS supervisorUserId,
         CAST(NULL AS NVARCHAR(255)) AS supervisorName,
         a.name AS areaName
       FROM people p
       LEFT JOIN areas a ON a.id = p.area_id`

    const r = await db.query(
      queryText,
      {}
    )
    res.json(r.recordset)
  } catch {
    res.status(500).json({ error: "Error listando personas" })
  }
})

router.get("/:id", authenticateToken, requireAnyRole(["guardia","supervisor","administrador"]), async (req, res) => {
  try {
    const includeSupervisor = await hasSupervisorColumn()
    const queryText = includeSupervisor
      ? `SELECT 
         p.id,
         p.dni,
         p.name,
         p.email,
         p.type,
         p.area_id AS areaId,
         p.sucursal AS branch,
         p.is_active AS isActive,
         p.photo_url AS photoUrl,
         p.supervisor_user_id AS supervisorUserId,
         COALESCE(supPerson.name, sup.email) AS supervisorName,
         a.name AS areaName
       FROM people p
       LEFT JOIN areas a ON a.id = p.area_id
       LEFT JOIN users sup ON sup.id = p.supervisor_user_id
       LEFT JOIN people supPerson ON sup.person_id = supPerson.id
       WHERE p.id=@id`
      : `SELECT 
         p.id,
         p.dni,
         p.name,
         p.email,
         p.type,
         p.area_id AS areaId,
         p.sucursal AS branch,
         p.is_active AS isActive,
         p.photo_url AS photoUrl,
         CAST(NULL AS INT) AS supervisorUserId,
         CAST(NULL AS NVARCHAR(255)) AS supervisorName,
         a.name AS areaName
       FROM people p
       LEFT JOIN areas a ON a.id = p.area_id
       WHERE p.id=@id`

    const r = await db.query(
      queryText,
      { id: Number(req.params.id) }
    )
    if (!r.recordset[0]) return res.status(404).json({ error: "No encontrado" })
    res.json(r.recordset[0])
  } catch {
    res.status(500).json({ error: "Error obteniendo persona" })
  }
})

router.get("/:id/qr", authenticateToken, requireAnyRole(["guardia","supervisor","administrador"]), async (req, res) => {
  const personId = Number(req.params.id)
  if (Number.isNaN(personId)) {
    return res.status(400).json({ error: "Identificador invalido" })
  }

  try {
    const result = await db.query(
      "SELECT dni, name FROM people WHERE id=@id",
      { id: personId }
    )
    const person = result.recordset[0]
    if (!person) {
      return res.status(404).json({ error: "No encontrado" })
    }

    const qrText = String(person.dni || "").trim()
    if (!qrText) {
      return res.status(400).json({ error: "DNI no registrado" })
    }

    const qrBuffer = await QRCode.toBuffer(qrText, {
      type: "png",
      width: 400,
      margin: 2,
      errorCorrectionLevel: "M",
    })

    res.setHeader("Content-Type", "image/png")
    res.setHeader("Content-Disposition", `inline; filename="dni-${qrText}.png"`)
    res.setHeader("Cache-Control", "private, max-age=300")
    return res.send(qrBuffer)
  } catch (err) {
    console.error("QR generation error", err)
    return res.status(500).json({ error: "Error generando QR" })
  }
})

router.post("/", authenticateToken, requireAnyRole(["supervisor","administrador"]), upload.single("photo"), async (req, res) => {
  let savedPhotoUrl = null
  try {
    const includeSupervisor = await hasSupervisorColumn()
    const raw = parsePersonPayload(req.body)
    const validated = await personCreateSchema.parseAsync(raw)
    const supervisorUserId = validated.supervisorId ?? null

    if (req.file) {
      savedPhotoUrl = await moveUploadedPhoto(req.file, validated.type)
    }

    const insertQuery = includeSupervisor
      ? "INSERT INTO people (dni,name,email,type,area_id,sucursal,supervisor_user_id,is_active,photo_url,created_at,updated_at) VALUES (@dni,@name,@email,@type,@area,@branch,@supervisor,@act,@photo,@createdAt,@updatedAt)"
      : "INSERT INTO people (dni,name,email,type,area_id,sucursal,is_active,photo_url,created_at,updated_at) VALUES (@dni,@name,@email,@type,@area,@branch,@act,@photo,@createdAt,@updatedAt)"

    await db.query(
      insertQuery,
      {
        dni: validated.dni,
        name: validated.name,
        email: validated.email,
        type: validated.type,
        area: validated.areaId,
        branch: validated.branch,
        supervisor: supervisorUserId,
        act: validated.isActive ? 1 : 0,
        photo: savedPhotoUrl || validated.photoUrl,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    )
    res.status(201).json({ success: true, photoUrl: savedPhotoUrl || validated.photoUrl })
  } catch (err) {
    if (req.file && !savedPhotoUrl) {
      await removeTempFile(req.file)
    }
    if (err.name === "ZodError") {
      return res.status(422).json({ error: "VALIDATION_ERROR", issues: err.issues })
    }
    if (err.message === "INVALID_IMAGE_TYPE") {
      return res.status(400).json({ error: "El archivo debe ser una imagen" })
    }
    res.status(500).json({ error: "Error creando persona" })
  }
})

router.put("/:id", authenticateToken, requireAnyRole(["supervisor","administrador"]), upload.single("photo"), async (req, res) => {
  let savedPhotoUrl = null
  try {
    const includeSupervisor = await hasSupervisorColumn()
    const existing = await db.query(
      "SELECT id, type, photo_url as photoUrl FROM people WHERE id=@id",
      { id: Number(req.params.id) }
    )
    if (!existing.recordset[0]) return res.status(404).json({ error: "No encontrado" })

    const raw = parsePersonPayload(req.body)
    if (!raw.photoUrl && existing.recordset[0].photoUrl) {
      raw.photoUrl = existing.recordset[0].photoUrl
    }

    const validated = await personUpdateSchema.parseAsync(raw)
    const supervisorUserId = validated.supervisorId ?? null

    if (req.file) {
      savedPhotoUrl = await moveUploadedPhoto(req.file, validated.type)
    }

    const finalPhoto = savedPhotoUrl || validated.photoUrl || null
    const prevPhoto = existing.recordset[0].photoUrl

    const updateQuery = includeSupervisor
      ? "UPDATE people SET dni=@dni,name=@name,email=@email,type=@type,area_id=@area,sucursal=@branch,supervisor_user_id=@supervisor,is_active=@act,photo_url=@photo WHERE id=@id"
      : "UPDATE people SET dni=@dni,name=@name,email=@email,type=@type,area_id=@area,sucursal=@branch,is_active=@act,photo_url=@photo WHERE id=@id"

    await db.query(
      updateQuery,
      {
        id: Number(req.params.id),
        dni: validated.dni,
        name: validated.name,
        email: validated.email,
        type: validated.type,
        area: validated.areaId,
        branch: validated.branch,
        supervisor: supervisorUserId,
        act: validated.isActive ? 1 : 0,
        photo: finalPhoto
      }
    )

    if (savedPhotoUrl && prevPhoto && prevPhoto !== finalPhoto) {
      await removeStoredFile(prevPhoto)
    }

    res.status(204).end()
  } catch (err) {
    if (req.file && !savedPhotoUrl) {
      await removeTempFile(req.file)
    }
    if (err.name === "ZodError") {
      return res.status(422).json({ error: "VALIDATION_ERROR", issues: err.issues })
    }
    if (err.message === "INVALID_IMAGE_TYPE") {
      return res.status(400).json({ error: "El archivo debe ser una imagen" })
    }
    res.status(500).json({ error: "Error actualizando persona" })
  }
})

router.delete("/:id", authenticateToken, requireAnyRole(["supervisor","administrador"]), async (req, res) => {
  const personId = Number(req.params.id)
  if (Number.isNaN(personId)) {
    return res.status(400).json({ error: "Identificador invalido" })
  }

  try {
    const personResult = await db.query(
      "SELECT dni, photo_url AS photoUrl FROM people WHERE id=@id",
      { id: personId }
    )
    const person = personResult.recordset[0]
    if (!person) {
      return res.status(404).json({ error: "No encontrado" })
    }

    const providerIdsResult = await db.query(
      "SELECT id FROM providers WHERE dni=@dni",
      { dni: person.dni }
    )
    const providerIds = providerIdsResult.recordset.map(row => row.id)

    if (providerIds.length > 0) {
      const placeholders = providerIds.map((_, idx) => `@pid${idx}`).join(",")
      const params = providerIds.reduce((acc, id, idx) => {
        acc[`pid${idx}`] = id
        return acc
      }, {})

      const docsResult = await db.query(
        `SELECT pdf_path AS pdfPath FROM provider_docs WHERE provider_id IN (${placeholders})`,
        params
      )

      await Promise.all(docsResult.recordset.map(doc => removeStoredFile(doc.pdfPath)))

      await db.query(
        `DELETE FROM provider_docs WHERE provider_id IN (${placeholders})`,
        params
      )
      await db.query(
        `DELETE FROM providers WHERE id IN (${placeholders})`,
        params
      )
    }

    await db.query("DELETE FROM access_logs WHERE person_id=@id", { id: personId })
    await db.query("DELETE FROM vehicles WHERE person_id=@id", { id: personId })

    await db.query("DELETE FROM people WHERE id=@id", { id: personId })
    await removeStoredFile(person.photoUrl)

    res.status(204).end()
  } catch {
    res.status(500).json({ error: "Error eliminando persona" })
  }
})

module.exports = router
