const { db } = require("./database")

const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires"
const CACHE_TTL_MS = 5 * 60 * 1000

let cachedTimezone = null
let lastFetch = 0

async function fetchTimezoneFromSettings() {
  try {
    const result = await db.query(
      "SELECT value FROM settings WHERE [key] = @key",
      { key: "timezone" }
    )
    const value = result.recordset[0]?.value
    if (typeof value === "string" && value.trim().length > 0) {
      cachedTimezone = value.trim()
    } else if (!cachedTimezone) {
      cachedTimezone = DEFAULT_TIMEZONE
    }
  } catch {
    if (!cachedTimezone) {
      cachedTimezone = DEFAULT_TIMEZONE
    }
  } finally {
    lastFetch = Date.now()
  }
  return cachedTimezone
}

async function getSystemTimezone() {
  const now = Date.now()
  if (!cachedTimezone || now - lastFetch > CACHE_TTL_MS) {
    await fetchTimezoneFromSettings()
  }
  return cachedTimezone || DEFAULT_TIMEZONE
}

function pad2(value) {
  return value.toString().padStart(2, "0")
}

function formatTimestampInTimezone(timezone) {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    const parts = formatter.formatToParts(now)
    const map = {}
    parts.forEach((part) => {
      if (part.type !== "literal") {
        map[part.type] = part.value
      }
    })
    return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`
  } catch {
    const now = new Date()
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`
  }
}

async function getLocalizedCurrentTimestamp() {
  const timezone = await getSystemTimezone()
  return formatTimestampInTimezone(timezone)
}

module.exports = {
  getSystemTimezone,
  getLocalizedCurrentTimestamp,
}
