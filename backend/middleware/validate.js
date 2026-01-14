const { ZodError } = require("zod")

function formatIssues(issues) {
  return issues.map(i => ({
    path: i.path.join("."),
    message: i.message,
    code: i.code,
  }))
}

function deepTrim(value) {
  if (Array.isArray(value)) return value.map(deepTrim)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, deepTrim(v)]))
  }
  return typeof value === "string" ? value.trim() : value
}

function validate(schema, { sanitize = true } = {}) {
  return async (req, res, next) => {
    try {
      if (sanitize && req.body && typeof req.body === "object") {
        req.body = deepTrim(req.body)
      }
      const parsed = await schema.parseAsync(req.body)
      req.validated = parsed
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        const formatted = formatIssues(err.issues)
        const passwordIssue = formatted.find((issue) => issue.path === "password")
        if (passwordIssue) {
          return res.status(422).json({
            error: passwordIssue.message,
            message: passwordIssue.message,
            field: passwordIssue.path || null,
            issues: formatted,
          })
        }
        const primaryIssue = formatted[0]
        return res.status(422).json({
          error: primaryIssue?.message || "Datos invalidos",
          message: primaryIssue?.message || "Datos invalidos",
          field: primaryIssue?.path || null,
          issues: formatted,
        })
      }
      return res.status(400).json({ error: "Datos invalidos" })
    }
  }
}

module.exports = { validate }
