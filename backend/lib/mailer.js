const nodemailer = require("nodemailer")

let transporter = null

function getTransporter() {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    console.warn("SMTP credentials are not fully configured. Emails will not be sent.")
    return null
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    // --- LÍNEAS AÑADIDAS ---
    
  })

  return transporter
}

async function sendMail(options) {
  const transport = getTransporter()
  if (!transport) {
    console.warn("sendMail skipped because transporter is not configured", options.subject)
    return
  }

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      ...options,
    })
  } catch (error) {
    console.error("Error al enviar el correo:", error)
    // Relanza el error para que la función que lo llamó sepa que falló
    throw error
  }
}

module.exports = { sendMail }