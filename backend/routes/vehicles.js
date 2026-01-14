const express = require("express")
const { db } = require("../lib/database");
const router = express.Router()
const { authenticateToken, requireAnyRole } = require("../middleware/auth")
const { validate } = require("../middleware/validate")
const { vehicleCreateSchema, vehicleUpdateSchema } = require("../validation/schemas")

// GET todos los vehículos
router.get("/", authenticateToken, requireAnyRole(["guardia","supervisor","administrador"]), async (_req,res)=> {
  try {
    const r = await db.query(
      `SELECT v.id,
              v.license_plate AS licensePlate,
              v.brand,
              v.model,
              v.color,
              v.person_id AS personId,
              v.created_at AS createdAt,
              p.name AS ownerName,
              p.dni AS ownerDni,
              ISNULL(pr.vehicle_access, 0) AS providerVehicleAccess
       FROM vehicles v
       LEFT JOIN people p ON p.id = v.person_id
       LEFT JOIN providers pr ON pr.dni = p.dni`, {}
    )
    res.json(r.recordset)
  } catch (e) {
    console.error("Error listando vehículos:", e)
    res.status(500).json({ error: "Error listando vehículos" })
  }
})

// GET vehículo por ID
router.get("/:id", authenticateToken, requireAnyRole(["guardia","supervisor","administrador"]), async (req,res)=> {
  try {
    const r = await db.query(
      `SELECT v.id,
              v.license_plate as licensePlate,
              v.brand,
              v.model,
              v.color,
              v.person_id as personId,
              v.created_at as createdAt
       FROM vehicles v
       WHERE v.id = @id`, { id: Number(req.params.id) }
    )
    if (!r.recordset[0]) return res.status(404).json({ error: "No encontrado" })
    res.json(r.recordset[0])
  } catch (e) {
    console.error("Error obteniendo vehículo:", e)
    res.status(500).json({ error: "Error obteniendo vehículo" })
  }
})

// POST crear vehículo
router.post("/", authenticateToken, requireAnyRole(["supervisor","administrador"]), validate(vehicleCreateSchema), async (req,res)=> {
  try {
    const { licensePlate, personId, brand, model, color = "" } = req.validated
    await db.query(
      `INSERT INTO vehicles (license_plate, person_id, brand, model, color, created_at)
       VALUES (@lp, @pid, @b, @m, @c, GETDATE())`,
      { lp: licensePlate, pid: personId, b: brand, m: model, c: color }
    )
    res.status(201).json({ success: true })
  } catch (e) {
    console.error("Error creando vehículo:", e)
    res.status(500).json({ error: "Error creando vehículo" })
  }
})

// PUT actualizar vehículo
router.put("/:id", authenticateToken, requireAnyRole(["supervisor","administrador"]), validate(vehicleUpdateSchema), async (req,res)=> {
  try {
    const { licensePlate, personId, brand, model, color = "" } = req.validated
    await db.query(
      `UPDATE vehicles
       SET license_plate=@lp,
           person_id=@pid,
           brand=@b,
           model=@m,
           color=@c
       WHERE id=@id`,
      { id: Number(req.params.id), lp: licensePlate, pid: personId, b: brand, m: model, c: color }
    )
    res.status(204).end()
  } catch (e) {
    console.error("Error actualizando vehículo:", e)
    res.status(500).json({ error: "Error actualizando vehículo" })
  }
})

// DELETE eliminar vehículo
router.delete("/:id", authenticateToken, requireAnyRole(["supervisor","administrador"]), async (req,res)=> {
  try {
    await db.query("DELETE FROM vehicles WHERE id=@id", { id: Number(req.params.id) })
    res.status(204).end()
  } catch (e) {
    console.error("Error eliminando vehículo:", e)
    res.status(500).json({ error: "Error eliminando vehículo" })
  }
})

module.exports = router
