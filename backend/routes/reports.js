const express = require("express")
const ExcelJS = require("exceljs")
const { authenticateToken, requireAnyRole } = require("../middleware/auth")
const { db } = require("../lib/database")

const router = express.Router()

router.get(
  "/stats",
  authenticateToken,
  requireAnyRole(["guardia", "supervisor", "administrador"]),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query

      const start = startDate ? new Date(startDate) : new Date()
      start.setHours(0, 0, 0, 0)

      const end = endDate ? new Date(endDate) : new Date()
      end.setHours(23, 59, 59, 999)

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        return res.status(400).json({ error: "Rango de fechas invalido" })
      }

      const ingresosHoyRes = await db.query(
        `SELECT COUNT(1) AS total
         FROM access_logs
         WHERE entry_time BETWEEN @start AND @end`,
        { start, end },
      )

      const personasDentroRes = await db.query(
        `SELECT COUNT(1) AS total
         FROM access_logs
         WHERE exit_time IS NULL`,
        {},
      )

      const areasActivasRes = await db.query(
        `SELECT COUNT(DISTINCT a.id) AS total
         FROM access_logs l
         JOIN people p ON p.id = l.person_id
         JOIN areas a ON a.id = p.area_id
         WHERE l.exit_time IS NULL`,
        {},
      )

      res.json({
        success: true,
        stats: {
          ingresosHoy: ingresosHoyRes.recordset[0]?.total ?? 0,
          personasDentro: personasDentroRes.recordset[0]?.total ?? 0,
          areasActivas: areasActivasRes.recordset[0]?.total ?? 0,
        },
      })
    } catch (err) {
      console.error("REPORTS /stats ERROR", err)
      res.status(500).json({ error: "Error generando estadisticas" })
    }
  },
)

router.get(
  "/area-entries",
  authenticateToken,
  requireAnyRole(["guardia", "supervisor", "administrador"]),
  async (_req, res) => {
    try {
      const totalsResult = await db.query(
        `SELECT
           p.area_id AS areaId,
           COALESCE(a.name, 'Sin area') AS areaName,
           COUNT(1) AS totalEntries
         FROM access_logs l
         LEFT JOIN people p ON p.id = l.person_id
         LEFT JOIN areas a ON a.id = p.area_id
         WHERE
           l.entry_time IS NOT NULL
           AND CAST(l.entry_time AS DATE) = CAST(GETDATE() AS DATE)
         GROUP BY p.area_id, a.name
         ORDER BY totalEntries DESC, areaName ASC`,
      )

      const insideResult = await db.query(
        `SELECT
           p.area_id AS areaId,
           COALESCE(a.name, 'Sin area') AS areaName,
           p.name AS personName,
           p.dni AS personDni,
           p.type AS personType,
           l.entry_time AS entryTime
         FROM access_logs l
         LEFT JOIN people p ON p.id = l.person_id
         LEFT JOIN areas a ON a.id = p.area_id
         WHERE l.exit_time IS NULL`,
      )

      const insideByArea = new Map()
      insideResult.recordset.forEach((row) => {
        const key = row.areaId ?? "null"
        if (!insideByArea.has(key)) {
          insideByArea.set(key, [])
        }
        insideByArea.get(key).push({
          name: row.personName,
          dni: row.personDni,
          type: row.personType,
          entryTime: row.entryTime,
          areaName: row.areaName,
        })
      })

      const areaMap = new Map()
      totalsResult.recordset.forEach((row) => {
        const key = row.areaId ?? "null"
        areaMap.set(key, {
          areaId: row.areaId,
          areaName: row.areaName,
          totalEntries: row.totalEntries,
          peopleInside: insideByArea.get(key) || [],
        })
      })

      insideByArea.forEach((people, key) => {
        if (!areaMap.has(key)) {
          const sample = people[0] || {}
          areaMap.set(key, {
            areaId: key === "null" ? null : Number(key),
            areaName: sample.areaName || "Sin area",
            totalEntries: 0,
            peopleInside: people,
          })
        }
      })

      const areas = Array.from(areaMap.values()).sort((a, b) => {
        if (b.totalEntries !== a.totalEntries) {
          return b.totalEntries - a.totalEntries
        }
        return a.areaName.localeCompare(b.areaName)
      })

      res.json({ areas })
    } catch (err) {
      console.error("REPORTS AREA ENTRIES ERROR", err)
      res.status(500).json({ error: "Error obteniendo datos por area" })
    }
  },
)

function buildBoundary(dateInput, boundary) {
  if (typeof dateInput === "string" && dateInput.trim().length > 0) {
    const parts = dateInput.split("-").map((value) => Number(value))
    if (parts.length === 3 && parts.every((value) => Number.isFinite(value))) {
      const [year, month, day] = parts
      const date = new Date(year, month - 1, day)
      if (boundary === "start") {
        date.setHours(0, 0, 0, 0)
      } else {
        date.setHours(23, 59, 59, 999)
      }
      return date
    }
  }
  const fallback = new Date()
  if (boundary === "start") {
    fallback.setHours(0, 0, 0, 0)
  } else {
    fallback.setHours(23, 59, 59, 999)
  }
  return fallback
}

router.post(
  "/",
  authenticateToken,
  requireAnyRole(["guardia", "supervisor", "administrador"]),
  async (req, res) => {
    const { startDate, endDate, areaId, personId, includeVehicles } = req.body
    const rawAreaIds = Array.isArray(req.body?.areaIds) ? req.body.areaIds : []
    const parsedAreaIds = rawAreaIds
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
    const uniqueAreaIds = Array.from(new Set(parsedAreaIds))

    try {
      const start = buildBoundary(startDate, "start")
      const end = buildBoundary(endDate, "end")

      let query = `SELECT
        l.id,
        p.name AS personName,
        p.dni AS personDni,
        p.type AS personType,
        a.name AS area,
        l.entry_time,
        l.exit_time,
        l.notes,
        COALESCE(gp.name, u.email) AS guardName`

      if (includeVehicles) {
        query += `,
        v.license_plate AS vehiclePlate,
        v.brand AS vehicleBrand,
        v.model AS vehicleModel`
      }

      query += `
        FROM access_logs l
        JOIN people p ON p.id = l.person_id
        LEFT JOIN areas a ON a.id = p.area_id
        JOIN users u ON u.id = l.guard_user_id
        LEFT JOIN people gp ON gp.id = u.person_id`

      if (includeVehicles) {
        query += ` LEFT JOIN vehicles v ON v.id = l.vehicle_id`
      }

      query += ` WHERE (l.entry_time BETWEEN @start AND @end OR l.exit_time BETWEEN @start AND @end)`

      const params = { start, end }

      if (uniqueAreaIds.length === 1) {
        query += " AND a.id = @areaId"
        params.areaId = uniqueAreaIds[0]
      } else if (uniqueAreaIds.length > 1) {
        const placeholders = uniqueAreaIds.map((_, idx) => `@areaId${idx}`).join(",")
        query += ` AND a.id IN (${placeholders})`
        uniqueAreaIds.forEach((value, idx) => {
          params[`areaId${idx}`] = value
        })
      } else if (areaId) {
        const numericAreaId = Number(areaId)
        if (Number.isFinite(numericAreaId) && numericAreaId > 0) {
          query += " AND a.id = @areaId"
          params.areaId = numericAreaId
        }
      }

      if (personId) {
        const numericPersonId = Number(personId)
        if (Number.isFinite(numericPersonId) && numericPersonId > 0) {
          query += " AND p.id = @personId"
          params.personId = numericPersonId
        }
      }

      query += " ORDER BY l.entry_time ASC"

      const result = await db.query(query, params)

      const format = (req.body?.format || "excel").toString().toLowerCase()

      if (format === "excel") {
        const workbook = new ExcelJS.Workbook()
        workbook.creator = "Access Control System"
        workbook.created = new Date()
        const worksheet = workbook.addWorksheet("Reporte de accesos")

        const columns = [
          { header: "ID", key: "id", width: 10 },
          { header: "Nombre", key: "personName", width: 25 },
          { header: "DNI", key: "personDni", width: 16 },
          { header: "Tipo", key: "personType", width: 14 },
          { header: "Area", key: "area", width: 20 },
          { header: "Ingreso", key: "entry_time", width: 22, style: { numFmt: "yyyy-mm-dd hh:mm:ss" } },
          { header: "Egreso", key: "exit_time", width: 22, style: { numFmt: "yyyy-mm-dd hh:mm:ss" } },
          { header: "Notas", key: "notes", width: 30 },
          { header: "Registrado por", key: "guardName", width: 22 },
        ]

        if (includeVehicles) {
          columns.push(
            { header: "Vehiculo - Placa", key: "vehiclePlate", width: 18 },
            { header: "Vehiculo - Marca", key: "vehicleBrand", width: 18 },
            { header: "Vehiculo - Modelo", key: "vehicleModel", width: 18 },
          )
        }

        worksheet.columns = columns

        result.recordset.forEach((row) => {
          const dataRow = {
            id: row.id,
            personName: row.personName,
            personDni: row.personDni,
            personType: row.personType,
            area: row.area,
            entry_time: row.entry_time ? new Date(row.entry_time) : null,
            exit_time: row.exit_time ? new Date(row.exit_time) : null,
            notes: row.notes || "",
            guardName: row.guardName || "",
          }

          if (includeVehicles) {
            Object.assign(dataRow, {
              vehiclePlate: row.vehiclePlate || "",
              vehicleBrand: row.vehicleBrand || "",
              vehicleModel: row.vehicleModel || "",
            })
          }

          worksheet.addRow(dataRow)
        })

        worksheet.getRow(1).font = { bold: true }
        worksheet.views = [{ state: "frozen", ySplit: 1 }]

        const safeDate = (value) =>
          value && typeof value === "string" ? value.replace(/[^0-9-]/g, "") : ""
        const filename = `reporte-accesos-${safeDate(startDate) || "inicio"}_${safeDate(endDate) || "fin"}.xlsx`

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
        await workbook.xlsx.write(res)
        res.end()
        return
      } else if (format === "pdf") {
        return res.status(501).json({ error: "Exportacion a PDF no disponible temporalmente" })
      }

      res.json({
        success: true,
        filters: {
          startDate,
          endDate,
          areaId: params.areaId ?? null,
          areaIds: uniqueAreaIds,
          personId: params.personId ?? null,
          includeVehicles,
        },
        records: result.recordset,
      })
    } catch (err) {
      console.error("REPORTS / POST ERROR", err)
      res.status(500).json({ error: "Error generando reporte detallado" })
    }
  },
)

module.exports = router
