const trusted = (process.env.TRUSTED_EMAILS || "admin@empresa.com,supervisor@empresa.com,guardia@empresa.com")
  .split(/[,\s]+/)
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

const trustedSet = new Set(trusted)

function isTrustedEmail(email) {
  return trustedSet.has((email || "").toLowerCase())
}

module.exports = { isTrustedEmail }
