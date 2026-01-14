const { z } = require("zod")

// Helpers
const trim = (schema) => schema.transform((value) => (typeof value === "string" ? value.trim() : value))
const toUpper = (schema) => schema.transform((value) => (typeof value === "string" ? value.toUpperCase() : value))
const toLower = (schema) => schema.transform((value) => (typeof value === "string" ? value.toLowerCase() : value))

// Base patterns
const dniPattern = /^[0-9]{6,15}$/
const licensePlatePattern = /^[A-Z0-9-]{4,12}$/
const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/

// Shared enums
const PERSON_TYPES = ["empleado", "proveedor", "guardia", "supervisor", "administrador"]
const ROLE_TYPES = ["guardia", "supervisor", "administrador"]
const BRANCH_TYPES = ["PHQ Cordoba", "Buenos Aires", "Rosario", "Santa Fe", "Buenos Aires Dds"]

const photoUrlSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  })
  .refine(
    (value) => value === null || /^https?:\/\//i.test(value) || value.startsWith("/"),
    { message: "La URL de la foto debe iniciar con http(s):// o /." }
  )

const createEnumSchema = (values, label) =>
  z.enum(values, {
    errorMap: (issue, ctx) => {
      if (issue.code === z.ZodIssueCode.invalid_enum_value) {
        return { message: `${label} debe ser uno de: ${values.join(", ")}.` }
      }
      if (issue.code === z.ZodIssueCode.invalid_type) {
        if (issue.received === "undefined") {
          return { message: `${label} es obligatorio.` }
        }
        if (issue.received === "null") {
          return { message: `${label} no puede ser nulo.` }
        }
        return { message: `${label} tiene un formato invalido.` }
      }
      return { message: ctx.defaultError }
    },
  })

const nameSchema = trim(
  z
    .string({
      required_error: "El nombre es obligatorio.",
      invalid_type_error: "El nombre debe ser una cadena de texto.",
    })
    .min(2, { message: "El nombre debe tener al menos 2 caracteres." })
    .max(100, { message: "El nombre no puede superar los 100 caracteres." })
)

const dniSchema = z.preprocess(
  (value) => {
    if (typeof value === "string" || typeof value === "number") {
      return String(value).trim().replace(/\D+/g, "")
    }
    return value
  },
  z
    .string({
      required_error: "El DNI es obligatorio.",
      invalid_type_error: "El DNI debe ser texto o numero.",
    })
    .min(6, { message: "El DNI debe tener al menos 6 digitos." })
    .max(15, { message: "El DNI no puede superar los 15 digitos." })
    .refine((value) => dniPattern.test(value), {
      message: "El DNI debe contener solo numeros y tener entre 6 y 15 digitos.",
    })
)

const emailSchema = toLower(
  trim(
    z
      .string({
        required_error: "El email es obligatorio.",
        invalid_type_error: "El email debe ser una cadena de texto.",
      })
      .email({ message: "El email no tiene un formato valido." })
  )
)

const personTypeSchema = createEnumSchema(PERSON_TYPES, "El tipo de persona")
const roleSchema = createEnumSchema(ROLE_TYPES, "El rol")
const branchSchema = createEnumSchema(BRANCH_TYPES, "La sucursal")

const areaIdSchema = z
  .number({
    required_error: "El area es obligatoria.",
    invalid_type_error: "El area debe ser un numero.",
  })
  .int({ message: "El area debe ser un numero entero." })
  .positive({ message: "El area debe ser mayor que 0." })

const isActiveSchema = z.boolean({ invalid_type_error: "El estado activo debe ser verdadero o falso." }).optional().default(true)
const supervisorIdSchema = z
  .number({
    invalid_type_error: "El supervisor debe ser un numero.",
  })
  .int({ message: "El supervisor debe ser un numero entero." })
  .positive({ message: "El supervisor debe ser mayor que 0." })
  .nullable()
  .optional()

const passwordSchema = z
  .string({
    required_error: "La contrasena es obligatoria.",
    invalid_type_error: "La contrasena debe ser una cadena de texto.",
  })
  .regex(strongPasswordPattern, {
    message: "La contrasena debe incluir al menos una mayuscula, una minuscula y un numero (8+ caracteres).",
  })

const passwordResetRequestSchema = z.object({
  email: emailSchema,
})

const passwordResetVerifySchema = z.object({
  email: emailSchema,
  code: trim(z.string().regex(/^\d{6}$/, { message: "El codigo debe tener 6 digitos." })),
})

const passwordResetConfirmSchema = z.object({
  email: emailSchema,
  token: trim(z.string().regex(/^[a-f0-9]{64}$/i, { message: "Token invalido." })),
  password: passwordSchema,
})

// Users
const baseUserFields = {
  name: nameSchema,
  dni: dniSchema,
  email: emailSchema,
  type: personTypeSchema,
  areaId: areaIdSchema,
  branch: branchSchema,
  photoUrl: photoUrlSchema,
  role: roleSchema,
  isActive: isActiveSchema,
}

const userCreateSchema = z.object({
  ...baseUserFields,
  password: passwordSchema,
})

const userUpdateSchema = z.object({
  ...baseUserFields,
  password: passwordSchema.optional(),
})

// People
const personCreateSchema = z.object({
  dni: dniSchema,
  name: trim(z.string().min(2).max(100)),
  email: toLower(trim(z.string().email().nullable().optional())),
  type: z.enum(PERSON_TYPES),
  areaId: z.number().int().positive(),
  branch: branchSchema,
  photoUrl: photoUrlSchema,
  isActive: z.boolean().default(true),
  supervisorId: supervisorIdSchema,
})

const personUpdateSchema = z.object({
  dni: dniSchema,
  name: trim(z.string().min(2).max(100)),
  email: toLower(trim(z.string().email().nullable().optional())),
  type: z.enum(PERSON_TYPES),
  areaId: z.number().int().positive(),
  branch: branchSchema,
  photoUrl: photoUrlSchema,
  isActive: z.boolean().default(true),
  supervisorId: supervisorIdSchema,
})

// Areas
const areaCreateSchema = z.object({
  name: trim(z.string().min(2).max(60)),
  description: trim(z.string().max(300).optional().default("")),
  isActive: z.boolean().optional().default(true),
})

const areaUpdateSchema = areaCreateSchema

// Vehicles
const vehicleCreateSchema = z.object({
  licensePlate: toUpper(trim(z.string().regex(licensePlatePattern, "Patente invalida"))),
  personId: z.number().int().positive(),
  brand: trim(z.string().min(2).max(40)),
  model: trim(z.string().min(1).max(40)),
  color: trim(z.string().max(30).optional().default("")),
  isActive: z.boolean().optional().default(true),
})

const vehicleUpdateSchema = vehicleCreateSchema

// Settings
const settingsUpdateSchema = z
  .object({
    companyName: trim(z.string().max(120)).optional(),
    timezone: trim(z.string().min(3)).optional(),
    sessionTimeout: z.number().int().min(1).max(168).optional(),
    autoLogout: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
    smsNotifications: z.boolean().optional(),
    requirePhotoUpload: z.boolean().optional(),
    allowBulkImport: z.boolean().optional(),
    maxLoginAttempts: z.number().int().min(1).max(20).optional(),
    passwordMinLength: z.number().int().min(6).max(128).optional(),
  })
  .partial()

// Reports
const reportGenerateSchema = z
  .object({
    type: z.enum(["daily", "weekly", "monthly", "custom"]),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    areas: z.array(z.number().int().positive()).optional().default([]),
    includeVehicles: z.boolean().optional().default(false),
    format: z.enum(["excel", "csv", "pdf"]),
  })
  .superRefine((data, ctx) => {
    if (data.type === "custom") {
      if (!data.startDate || !data.endDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "startDate y endDate requeridos en tipo custom" })
      } else if (new Date(data.startDate) > new Date(data.endDate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "startDate no puede ser mayor que endDate" })
      }
    }
  })

// Access logs
const accessLogCreateSchema = z.object({
  personId: z.number().int().positive(),
  vehicleId: z.number().int().positive().nullable().optional(),
  action: z.enum(["entry", "exit"]),
  guardUserId: z.number().int().positive(),
  notes: trim(z.string().max(250).nullable().optional()),
})

module.exports = {
  BRANCH_TYPES,
  userCreateSchema,
  userUpdateSchema,
  passwordResetRequestSchema,
  passwordResetVerifySchema,
  passwordResetConfirmSchema,
  personCreateSchema,
  personUpdateSchema,
  areaCreateSchema,
  areaUpdateSchema,
  vehicleCreateSchema,
  vehicleUpdateSchema,
  settingsUpdateSchema,
  reportGenerateSchema,
  accessLogCreateSchema,
}
