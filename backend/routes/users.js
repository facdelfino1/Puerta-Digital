const express = require("express")
const bcrypt = require("bcryptjs")
const path = require("path")
const fs = require("fs")
const multer = require("multer")
const { db } = require("../lib/database")
const { sendVerificationEmail } = require("../lib/emailVerification")
const { isTrustedEmail } = require("../constants/trustedEmails")
const { authenticateToken, requireAnyRole } = require("../middleware/auth")
const { validate } = require("../middleware/validate")
const { userCreateSchema, userUpdateSchema } = require("../validation/schemas")

const router = express.Router()

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "public", "uploads", "users")
fs.mkdirSync(UPLOAD_ROOT, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg"
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "") || "avatar"
    cb(null, `${Date.now()}-${base}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("INVALID_IMAGE"))
    }
    cb(null, true)
  },
})

const SELECT_BASE = `
  SELECT
    u.id,
    u.email,
    u.role,
    u.is_active AS isActive,
    u.email_verified AS emailVerified,
    u.created_at AS createdAt,
    u.updated_at AS updatedAt,
    p.id AS personId,
    p.name,
    p.dni,
    p.type,
    p.area_id AS areaId,
    p.sucursal AS branch,
    a.name AS areaName,
    p.photo_url AS photoUrl
  FROM users u
  LEFT JOIN people p ON u.person_id = p.id
  LEFT JOIN areas a ON p.area_id = a.id
`

router.get("/", authenticateToken, requireAnyRole(["supervisor", "administrador"]), async (_req, res) => {
  try {
    const result = await db.query(`${SELECT_BASE}`)
    res.json(result.recordset)
  } catch (err) {
    console.error("USERS LIST ERROR", err)
    res.status(500).json({ error: "Error listando usuarios" })
  }
})

router.get("/:id", authenticateToken, requireAnyRole(["supervisor", "administrador"]), async (req, res) => {
  try {
    const result = await db.query(`${SELECT_BASE} WHERE u.id=@id`, { id: Number(req.params.id) })
    const user = result.recordset[0]
    if (!user) return res.status(404).json({ error: "No encontrado" })
    res.json(user)
  } catch (err) {
    console.error("USERS GET ERROR", err)
    res.status(500).json({ error: "Error obteniendo usuario" })
  }
})

router.post("/", authenticateToken, requireAnyRole(["supervisor", "administrador"]), validate(userCreateSchema), async (req, res) => {
  const { name, dni, email, type, areaId, branch, photoUrl, role, isActive, password } = req.validated
  const trusted = isTrustedEmail(email)
  let areaName = null

  try {
    const existingPerson = await db.query(
      "SELECT id FROM people WHERE dni=@dni",
      { dni }
    )

    let personId = existingPerson.recordset[0]?.id
    const normalizedPhoto = photoUrl ?? null
    const personActive = isActive ? 1 : 0

    if (personId) {
      await db.query(
        `UPDATE people
         SET name=@name,
             dni=@dni,
             email=@email,
             type=@type,
             area_id=@areaId,
             sucursal=@branch,
             photo_url=@photoUrl,
             is_active=@personActive,
             updated_at=GETDATE()
         WHERE id=@personId`,
        { name, dni, email, type, areaId, branch, photoUrl: normalizedPhoto, personActive, personId }
      )
    } else {
      const insertPerson = await db.query(
        `DECLARE @NewPeople TABLE(id INT);
         INSERT INTO people (name, dni, email, type, area_id, sucursal, photo_url, is_active, created_at, updated_at)
         OUTPUT INSERTED.id INTO @NewPeople
         VALUES (@name, @dni, @email, @type, @areaId, @branch, @photoUrl, @personActive, GETDATE(), GETDATE());
         SELECT id FROM @NewPeople;`,
        { name, dni, email, type, areaId, branch, photoUrl: normalizedPhoto, personActive }
      )
      personId = insertPerson.recordset[0]?.id
    }

    if (areaId) {
      const areaResult = await db.query("SELECT TOP 1 name FROM areas WHERE id=@areaId", { areaId })
      areaName = areaResult.recordset[0]?.name || null
    }

    if (type === "proveedor") {
      await db.query(
        `MERGE providers WITH (HOLDLOCK) AS tgt
         USING (SELECT @dni AS dni) AS src
         ON tgt.dni = src.dni
         WHEN MATCHED THEN
           UPDATE SET
             name = @name,
             area = @areaName,
             is_active = @isActive,
             updated_at = GETDATE()
         WHEN NOT MATCHED THEN
           INSERT (name, dni, area, is_active, created_at, updated_at)
           VALUES (@name, @dni, @areaName, @isActive, GETDATE(), GETDATE());`,
        {
          name,
          dni,
          areaName,
          isActive: isActive ? 1 : 0,
        }
      )
    }

    const hash = await bcrypt.hash(password, 10)

    const insertUser = await db.query(
      `INSERT INTO users (email, role, password_hash, is_active, email_verified, person_id, created_at, updated_at)
       OUTPUT INSERTED.id
       VALUES (@email, @role, @hash, @isActive, @verified, @personId, GETDATE(), GETDATE())`,
      {
        email,
        role,
        hash,
        isActive: isActive ? 1 : 0,
        verified: trusted ? 1 : 0,
        personId,
      }
    )

    const userId = insertUser.recordset[0]?.id

    if (userId && !trusted) {
      try {
        await sendVerificationEmail(userId, email, name, true)
      } catch (err) {
        console.error("Error enviando verificacion", err)
      }
    }

    res.status(201).json({ success: true, userId })
  } catch (err) {
    console.error("USER CREATION ERROR", err)
    res.status(500).json({ error: "Error creando usuario" })
  }
})

router.put("/:id", authenticateToken, requireAnyRole(["supervisor", "administrador"]), validate(userUpdateSchema), async (req, res) => {
  const userId = Number(req.params.id)
  if (Number.isNaN(userId)) return res.status(400).json({ error: "Identificador invalido" })

  const { name, dni, email, type, areaId, branch, photoUrl, role, isActive, password } = req.validated
  const trusted = isTrustedEmail(email)
  let areaName = null

  try {
    const existingUserResult = await db.query(
      "SELECT TOP 1 id, email, email_verified AS emailVerified, person_id AS personId FROM users WHERE id=@id",
      { id: userId }
    )
    const existingUser = existingUserResult.recordset[0]
    if (!existingUser) return res.status(404).json({ error: "No encontrado" })

    let personId = existingUser.personId

    if (!personId) {
      const lookup = await db.query("SELECT TOP 1 id FROM people WHERE dni=@dni", { dni })
      if (lookup.recordset[0]) {
        personId = lookup.recordset[0].id
      } else {
        const insertPerson = await db.query(
          `DECLARE @NewPeople TABLE(id INT);
           INSERT INTO people (name, dni, email, type, area_id, sucursal, photo_url, is_active, created_at, updated_at)
           OUTPUT INSERTED.id INTO @NewPeople
           VALUES (@name, @dni, @email, @type, @areaId, @branch, @photoUrl, @personActive, GETDATE(), GETDATE());
           SELECT id FROM @NewPeople;`,
          {
            name,
            dni,
            email,
            type,
            areaId,
            branch,
            photoUrl: photoUrl ?? null,
            personActive: isActive ? 1 : 0,
          }
        )
        personId = insertPerson.recordset[0]?.id
      }

      await db.query("UPDATE users SET person_id=@personId WHERE id=@id", {
        personId,
        id: userId,
      })
    }

    const dniConflict = await db.query(
      "SELECT id FROM people WHERE dni=@dni AND id<>@personId",
      { dni, personId }
    )
    if (dniConflict.recordset.length > 0) {
      return res.status(409).json({ error: "DNI ya esta asociado a otra persona" })
    }

    const normalizedPhoto = photoUrl ?? null
    const personActive = isActive ? 1 : 0

    await db.query(
      `UPDATE people
       SET name=@name,
           dni=@dni,
           email=@email,
           type=@type,
           area_id=@areaId,
           sucursal=@branch,
           photo_url=@photoUrl,
           is_active=@personActive,
           updated_at=GETDATE()
       WHERE id=@personId`,
      { name, dni, email, type, areaId, branch, photoUrl: normalizedPhoto, personActive, personId }
    )

    if (areaId) {
      const areaResult = await db.query("SELECT TOP 1 name FROM areas WHERE id=@areaId", { areaId })
      areaName = areaResult.recordset[0]?.name || null
    }

    if (type === "proveedor" && personId) {
      await db.query(
        `MERGE providers WITH (HOLDLOCK) AS tgt
         USING (SELECT @dni AS dni) AS src
         ON tgt.dni = src.dni
         WHEN MATCHED THEN
           UPDATE SET
             name = @name,
             area = @areaName,
             is_active = @isActive,
             updated_at = GETDATE()
         WHEN NOT MATCHED THEN
           INSERT (name, dni, area, is_active, created_at, updated_at)
           VALUES (@name, @dni, @areaName, @isActive, GETDATE(), GETDATE());`,
        {
          name,
          dni,
          areaName,
          isActive: isActive ? 1 : 0,
        }
      )
    }

    const emailChanged = existingUser.email.toLowerCase() !== email.toLowerCase()
    let emailVerified = existingUser.emailVerified ? 1 : 0
    if (trusted) {
      emailVerified = 1
    } else if (emailChanged) {
      emailVerified = 0
    }

    await db.query(
      `UPDATE users
       SET email=@email,
           role=@role,
           is_active=@isActive,
           email_verified=@verified,
           updated_at=GETDATE()
       WHERE id=@id`,
      {
        email,
        role,
        isActive: isActive ? 1 : 0,
        verified: emailVerified,
        id: userId,
      }
    )

    if (password) {
      const hash = await bcrypt.hash(password, 10)
      await db.query(
        "UPDATE users SET password_hash=@hash, updated_at=GETDATE() WHERE id=@id",
        { hash, id: userId }
      )
    }

    if (emailChanged && !trusted) {
      try {
        await sendVerificationEmail(userId, email, name, true)
      } catch (err) {
        console.error("Error reenviando verificacion", err)
      }
    }

    res.status(204).end()
  } catch (err) {
    console.error("USER UPDATE ERROR", err)
    res.status(500).json({ error: "Error actualizando usuario" })
  }
})

router.delete("/:id", authenticateToken, requireAnyRole(["supervisor", "administrador"]), async (req, res) => {
  const userId = Number(req.params.id)
  if (Number.isNaN(userId)) return res.status(400).json({ error: "Identificador invalido" })

  try {
    await db.query("DELETE FROM users WHERE id=@id", { id: userId })
    res.status(204).end()
  } catch (err) {
    console.error("USER DELETE ERROR", err)
    res.status(500).json({ error: "Error eliminando usuario" })
  }
})

router.post("/photo", authenticateToken, requireAnyRole(["supervisor", "administrador"]), upload.single("photo"), async (req, res) => {
  const file = req.file
  if (!file) {
    return res.status(400).json({ error: "Archivo requerido" })
  }
  try {
    const relativePath = `/uploads/users/${file.filename}`
    res.json({ success: true, photoUrl: relativePath })
  } catch (err) {
    console.error("USER PHOTO UPLOAD ERROR", err)
    res.status(500).json({ error: "Error subiendo foto" })
  }
})

router.post("/:id/resend-verification", authenticateToken, requireAnyRole(["supervisor", "administrador"]), async (req, res) => {
  const userId = Number(req.params.id)
  if (Number.isNaN(userId)) return res.status(400).json({ error: "Identificador invalido" })

  try {
    const result = await db.query(
      `${SELECT_BASE} WHERE u.id=@id`,
      { id: userId }
    )
    const user = result.recordset[0]
    if (!user) return res.status(404).json({ error: "No encontrado" })
    if (user.emailVerified) return res.status(400).json({ error: "EMAIL_ALREADY_VERIFIED" })

    try {
      await sendVerificationEmail(userId, user.email, user.name, true)
    } catch (err) {
      console.error("RESEND VERIFICATION ERROR", err)
      return res.status(500).json({ error: "Error reenviando verificacion" })
    }

    res.json({ success: true })
  } catch (err) {
    console.error("RESEND VERIFICATION FETCH ERROR", err)
    res.status(500).json({ error: "Error procesando solicitud" })
  }
})

module.exports = router
