const crypto = require("crypto")
const { db } = require("../lib/database")
const { sendMail } = require("../lib/mailer")

const APP_BASE_URL = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")
const TOKEN_TTL_HOURS = Number(process.env.EMAIL_VERIFICATION_TTL_HOURS || 24)

function generateToken() {
  return crypto.randomBytes(32).toString("hex")
}

async function upsertToken(userId, forceNew = false) {
  const existing = await db.query(
    `SELECT verification_token AS token, verification_token_expires AS expires
     FROM users WHERE id=@id`,
    { id: userId }
  )
  const record = existing.recordset[0]
  const now = new Date()
  if (!forceNew && record && record.token && record.expires && record.expires > now) {
    return { token: record.token, createdNew: false }
  }
  const token = generateToken()
  const expires = new Date(now.getTime() + TOKEN_TTL_HOURS * 60 * 60 * 1000)
  await db.query(
    `UPDATE users SET verification_token=@token, verification_token_expires=@expires WHERE id=@id`,
    { id: userId, token, expires }
  )
  return { token, createdNew: true }
}

async function sendVerificationEmail(userId, email, name, forceNew = false) {
  const { token, createdNew } = await upsertToken(userId, forceNew)
  if (!forceNew && !createdNew) {
    return
  }

  const verifyUrl = `${APP_BASE_URL}/verify-email?token=${encodeURIComponent(token)}`

  await sendMail({
    to: email,
    subject: "Verifica tu correo",
    html: `
      <p>Hola ${name || ""},</p>
      <p>Para completar el registro y acceder al sistema debes verificar tu correo electrónico.</p>
      <p><a href="${verifyUrl}">Haz clic aquí para verificar tu correo</a>.</p>
      <p>Si el enlace no funciona, copia y pega esta URL en tu navegador:</p>
      <p>${verifyUrl}</p>
      <p>Este enlace caduca en ${TOKEN_TTL_HOURS} horas.</p>
    `,
  })
}

async function verifyToken(token) {
  const now = new Date()
  const result = await db.query(
    `SELECT TOP 1
         u.id,
         u.email,
         COALESCE(p.name, u.email) AS name
     FROM users u
     LEFT JOIN people p ON p.id = u.person_id
     WHERE u.verification_token=@token AND u.verification_token_expires > @now`,
    { token, now }
  )
  const user = result.recordset[0]
  if (!user) return null

  await db.query(
    `UPDATE users
     SET email_verified=1,
         verification_token=NULL,
         verification_token_expires=NULL,
         updated_at=GETDATE()
     WHERE id=@id`,
    { id: user.id }
  )
  return user
}

module.exports = {
  sendVerificationEmail,
  verifyToken,
  upsertToken,
}
