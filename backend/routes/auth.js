const express = require("express")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const crypto = require("crypto")
const { db } = require("../lib/database")
const { authenticateToken } = require("../middleware/auth")
const { validate } = require("../middleware/validate")
const { sendMail } = require("../lib/mailer")
const { sendVerificationEmail, verifyToken } = require("../lib/emailVerification")
const { isTrustedEmail } = require("../constants/trustedEmails")
const {
  passwordResetRequestSchema,
  passwordResetVerifySchema,
  passwordResetConfirmSchema,
} = require("../validation/schemas")

const router = express.Router()

const RESET_CODE_TTL_MINUTES = Number(process.env.PASSWORD_RESET_CODE_TTL_MINUTES || 15)
const RESET_TOKEN_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 30)

function generateResetCode() {
  return crypto.randomInt(100000, 1000000).toString()
}

function hashValue(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body

  try {
    const result = await db.query(
      `SELECT TOP 1 
         u.id,
         u.email,
         u.password_hash,
         u.role,
         u.is_active,
         u.email_verified AS emailVerified,
         p.name,
         p.photo_url AS photoUrl
       FROM users u
       LEFT JOIN people p ON p.id = u.person_id
       WHERE u.email=@email`,
      { email }
    )
    const user = result.recordset[0]

    if (!user || !user.is_active) {
      return res.status(401).json({ error: "Credenciales inv�lidas" })
    }

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return res.status(401).json({ error: "Credenciales inv�lidas" })

    if (!user.emailVerified && !isTrustedEmail(user.email)) {
      try {
        await sendVerificationEmail(user.id, user.email, user.name)
      } catch (err) {
        console.error("Error enviando email de verificaci�n", err.message)
      }
      return res.status(403).json({ error: "EMAIL_NOT_VERIFIED", requiresVerification: true })
    }

    const payload = {
      id: user.id,
      name: user.name || email,
      email: user.email,
      role: user.role,
      photoUrl: user.photoUrl ?? null,
      emailVerified: true,
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" })

    res.setHeader("Access-Control-Allow-Credentials", "true")

    const isLocal = req.hostname === "localhost" || req.hostname === "127.0.0.1"
    const cookieOptions = isLocal
      ? {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          path: "/",
          maxAge: 1000 * 60 * 60 * 8,
        }
      : {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          path: "/",
          maxAge: 1000 * 60 * 60 * 8,
        }

    res.cookie("token", token, cookieOptions)
    res.json({ user: payload })
  } catch (err) {
    console.error("LOGIN ERROR", err)
    res.status(500).json({ error: "Error de autenticaci�n" })
  }
})

router.post("/password-reset/request", validate(passwordResetRequestSchema), async (req, res) => {
  const { email } = req.validated
  try {
    const result = await db.query(
      `SELECT TOP 1
         u.id,
         u.email,
         u.is_active AS isActive,
         COALESCE(p.name, u.email) AS name
       FROM users u
       LEFT JOIN people p ON p.id = u.person_id
       WHERE u.email=@email`,
      { email }
    )
    const user = result.recordset[0]

    if (!user || !user.isActive) {
      return res.json({ success: true })
    }

    const code = generateResetCode()
    const codeHash = hashValue(code)
    const expires = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000)

    await db.query(
      `UPDATE users
       SET password_reset_code_hash=@codeHash,
           password_reset_code_expires=@expires,
           password_reset_token_hash=NULL,
           password_reset_token_expires=NULL,
           updated_at=GETDATE()
       WHERE id=@id`,
      { id: user.id, codeHash, expires }
    )

    await sendMail({
      to: user.email,
      subject: "Recuperacion de contrasena",
      html: `
        <p>Hola ${user.name || ""},</p>
        <p>Tu codigo de verificacion para restablecer tu contrasena es:</p>
        <p><strong>${code}</strong></p>
        <p>Este codigo caduca en ${RESET_CODE_TTL_MINUTES} minutos.</p>
      `,
    })

    res.json({ success: true })
  } catch (err) {
    console.error("PASSWORD RESET REQUEST ERROR", err)
    res.status(500).json({ error: "Error enviando codigo de recuperacion" })
  }
})

router.post("/password-reset/verify", validate(passwordResetVerifySchema), async (req, res) => {
  const { email, code } = req.validated
  try {
    const codeHash = hashValue(code)
    const now = new Date()
    const result = await db.query(
      `SELECT TOP 1 id
       FROM users
       WHERE email=@email
         AND is_active=1
         AND password_reset_code_hash=@codeHash
         AND password_reset_code_expires > @now`,
      { email, codeHash, now }
    )
    const user = result.recordset[0]
    if (!user) {
      return res.status(400).json({ error: "Codigo invalido o expirado" })
    }

    const resetToken = crypto.randomBytes(32).toString("hex")
    const tokenHash = hashValue(resetToken)
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000)

    await db.query(
      `UPDATE users
       SET password_reset_code_hash=NULL,
           password_reset_code_expires=NULL,
           password_reset_token_hash=@tokenHash,
           password_reset_token_expires=@expires,
           updated_at=GETDATE()
       WHERE id=@id`,
      { id: user.id, tokenHash, expires }
    )

    res.json({ resetToken })
  } catch (err) {
    console.error("PASSWORD RESET VERIFY ERROR", err)
    res.status(500).json({ error: "Error validando codigo de recuperacion" })
  }
})

router.post("/password-reset/confirm", validate(passwordResetConfirmSchema), async (req, res) => {
  const { email, token, password } = req.validated
  try {
    const tokenHash = hashValue(token)
    const now = new Date()
    const result = await db.query(
      `SELECT TOP 1 id
       FROM users
       WHERE email=@email
         AND is_active=1
         AND password_reset_token_hash=@tokenHash
         AND password_reset_token_expires > @now`,
      { email, tokenHash, now }
    )
    const user = result.recordset[0]
    if (!user) {
      return res.status(400).json({ error: "Token invalido o expirado" })
    }

    const hash = await bcrypt.hash(password, 10)
    await db.query(
      `UPDATE users
       SET password_hash=@hash,
           password_reset_token_hash=NULL,
           password_reset_token_expires=NULL,
           updated_at=GETDATE()
       WHERE id=@id`,
      { id: user.id, hash }
    )

    res.json({ success: true })
  } catch (err) {
    console.error("PASSWORD RESET CONFIRM ERROR", err)
    res.status(500).json({ error: "Error actualizando contrasena" })
  }
})

router.post("/resend-verification-email", async (req, res) => {
  const email = (req.body?.email || "").toString().trim()
  if (!email) {
    return res.status(400).json({ error: "Email requerido" })
  }

  try {
    const result = await db.query(
      `SELECT id, email, name, email_verified AS emailVerified FROM users WHERE email=@email`,
      { email }
    )
    const user = result.recordset[0]
    if (!user) {
      return res.json({ success: true })
    }
    if (user.emailVerified) {
      return res.json({ success: true, alreadyVerified: true })
    }
    await sendVerificationEmail(user.id, user.email, user.name, true)
    res.json({ success: true })
  } catch (err) {
    console.error("PUBLIC RESEND VERIFICATION ERROR", err)
    res.status(500).json({ error: "Error reenviando verificaci�n" })
  }
})

router.get("/verify-email", async (req, res) => {
  const token = req.query.token
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token requerido" })
  }
  try {
    const user = await verifyToken(token)
    if (!user) {
      return res.status(400).json({ error: "Link invalido o expirado" })
    }
    res.json({ success: true })
  } catch (err) {
    console.error("VERIFY EMAIL ERROR", err)
    res.status(500).json({ error: "Error verificando correo" })
  }
})

router.post("/resend-verification", authenticateToken, async (req, res) => {
  try {
    const userResult = await db.query(
      `SELECT id, email, name, email_verified AS emailVerified
       FROM users WHERE id=@id`,
      { id: req.user.id }
    )
    const user = userResult.recordset[0]
    if (!user) return res.status(404).json({ error: "No encontrado" })
    if (user.emailVerified) {
      return res.status(400).json({ error: "EMAIL_ALREADY_VERIFIED" })
    }
    await sendVerificationEmail(user.id, user.email, user.name, true)
    res.json({ success: true })
  } catch (err) {
    console.error("RESEND VERIFICATION ERROR", err)
    res.status(500).json({ error: "Error reenviando verificaci�n" })
  }
})

router.get("/me", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT TOP 1
         u.id,
         u.email,
         u.role,
         u.email_verified AS emailVerified,
         p.name,
         p.photo_url AS photoUrl
       FROM users u
       LEFT JOIN people p ON p.id = u.person_id
       WHERE u.id=@id`,
      { id: req.user.id }
    )
    const freshUser = result.recordset[0]
    if (!freshUser) {
      return res.status(404).json({ error: "Usuario no encontrado" })
    }
    res.json({
      user: {
        ...req.user,
        ...freshUser,
        name: freshUser.name || req.user.name,
        emailVerified: !!freshUser.emailVerified,
      },
    })
  } catch (err) {
    console.error("AUTH ME ERROR", err)
    res.status(500).json({ error: "Error obteniendo perfil" })
  }
})

router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  })
  return res.status(204).end()
})

module.exports = router
