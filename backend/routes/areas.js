const express = require("express")
const { db } = require("../lib/database");
const router = express.Router()
const { authenticateToken, requireAnyRole } = require("../middleware/auth")
const { validate } = require("../middleware/validate")
const { areaCreateSchema, areaUpdateSchema } = require("../validation/schemas")

// GET todas las áreas
router.get("/", authenticateToken, requireAnyRole(["guardia","supervisor","administrador"]), async (_req,res)=> {
  try {
    const r = await db.query(
      `SELECT 
         a.id,
         a.name,
         a.description,
         a.created_at as createdAt,
         COALESCE(SUM(CASE WHEN p.type = 'empleado' THEN 1 ELSE 0 END), 0) AS employeeCount,
         COALESCE(SUM(CASE WHEN p.type = 'proveedor' THEN 1 ELSE 0 END), 0) AS providerCount
       FROM areas a
       LEFT JOIN people p ON p.area_id = a.id
       GROUP BY a.id, a.name, a.description, a.created_at
       ORDER BY a.name`, {}
    )
    res.json(r.recordset)
  } catch (e) {
    console.error("Error listando áreas:", e)
    res.status(500).json({ error: "Error listando áreas" })
  }
})

// GET una sola área por ID
router.get("/:id", authenticateToken, requireAnyRole(["guardia","supervisor","administrador"]), async (req,res)=> {
  try {
    const r = await db.query(
      "SELECT id, name, description, created_at as createdAt FROM areas WHERE id=@id",
      { id: Number(req.params.id) }
    )
    if (!r.recordset[0]) return res.status(404).json({ error: "No encontrado" })
    res.json(r.recordset[0])
  } catch (e) {
    console.error("Error obteniendo área:", e)
    res.status(500).json({ error: "Error obteniendo área" })
  }
})

// POST crear nueva área
router.post("/", authenticateToken, requireAnyRole(["supervisor","administrador"]), validate(areaCreateSchema), async (req,res)=> {
  const { name, description } = req.validated
  try {
    await db.query(
      "INSERT INTO areas (name, description, created_at) VALUES (@name, @desc, GETDATE())",
      { name, desc: description }
    )
    res.status(201).json({ success: true })
  } catch (e) {
    console.error("Error creando área:", e)
    res.status(500).json({ error: "Error creando área" })
  }
})

// PUT actualizar área
router.put("/:id", authenticateToken, requireAnyRole(["supervisor","administrador"]), validate(areaUpdateSchema), async (req,res)=> {
  const { name, description } = req.validated
  try {
    await db.query(
      "UPDATE areas SET name=@name, description=@desc WHERE id=@id",
      { id: Number(req.params.id), name, desc: description }
    )
    res.status(204).end()
  } catch (e) {
    console.error("Error actualizando área:", e)
    res.status(500).json({ error: "Error actualizando área" })
  }
})

// DELETE eliminar área
router.delete("/:id", authenticateToken, requireAnyRole(["supervisor","administrador"]), async (req,res)=> {
  try {
    await db.query("DELETE FROM areas WHERE id=@id", { id: Number(req.params.id) })
    res.status(204).end()
  } catch (e) {
    console.error("Error eliminando área:", e)
    res.status(500).json({ error: "Error eliminando área" })
  }
})

module.exports = router
