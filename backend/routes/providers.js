const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { authenticateToken, requireSupervisor, requireAnyRole } = require("../middleware/auth");
const { db } = require("../lib/database");

const router = express.Router();

// Upload configuration -------------------------------------------------------
const UPLOAD_DIR = path.join(__dirname, "..", "..", "public", "uploads", "providers");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".pdf";
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "") || "document";
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("INVALID_FILE_TYPE"));
    }
    cb(null, true);
  },
});

// Helpers -------------------------------------------------------------------
async function unlinkIfExists(filePath) {
  if (!filePath) return;
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.join(UPLOAD_DIR, path.basename(filePath));
  try {
    await fs.promises.unlink(absolute);
  } catch {
    // ignore missing files
  }
}

// Routes --------------------------------------------------------------------
router.get(
  "/",
  authenticateToken,
  requireAnyRole(["guardia", "supervisor", "administrador"]),
  async (req, res) => {
    try {
      const search = (req.query.search || "").trim();
      const hasSearch = search.length > 0;

      const queryParts = [
        `SELECT
           p.id,
           p.name,
           p.dni,
           p.area,
           p.vehicle_access AS vehicleAccess,
           p.is_active AS isActive,
           p.supervisor_id AS supervisorId,
           p.created_at AS createdAt,
           p.updated_at AS updatedAt,
           vd.id AS vehicleDocId,
           vd.pdf_path AS vehicleDocPath,
           vd.upload_date AS vehicleDocUploadDate,
           vd.expiration_date AS vehicleDocExpiration,
           vd.allows_vehicle AS vehicleDocAllows,
           gd.id AS generalDocId,
           gd.pdf_path AS generalDocPath,
           gd.upload_date AS generalDocUploadDate,
           gd.expiration_date AS generalDocExpiration
         FROM providers p`,
        `OUTER APPLY (
           SELECT TOP 1 d.id, d.pdf_path, d.upload_date, d.expiration_date, d.allows_vehicle
           FROM provider_docs d
           WHERE d.provider_id = p.id AND d.doc_type = 'vehicle'
           ORDER BY d.upload_date DESC
         ) vd`,
        `OUTER APPLY (
           SELECT TOP 1 d.id, d.pdf_path, d.upload_date, d.expiration_date, d.allows_vehicle
           FROM provider_docs d
           WHERE d.provider_id = p.id AND d.doc_type = 'general'
           ORDER BY d.upload_date DESC
         ) gd`,
      ];

      if (hasSearch) {
        queryParts.push("WHERE (p.name LIKE @term OR p.dni LIKE @term OR p.area LIKE @term)");
      }

      queryParts.push("ORDER BY p.name ASC");

      const query = queryParts.join(" ");
      const params = hasSearch ? { term: `%${search}%` } : {};
      const result = await db.query(query, params);

      const providers = result.recordset.map((row) => ({
        id: row.id,
        name: row.name,
        dni: row.dni,
        area: row.area,
        vehicleAccess: !!row.vehicleAccess,
        isActive: !!row.isActive,
        supervisorId: row.supervisorId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        latestVehicleDoc: row.vehicleDocId
          ? {
              id: row.vehicleDocId,
              pdfPath: row.vehicleDocPath,
              uploadDate: row.vehicleDocUploadDate,
              expirationDate: row.vehicleDocExpiration,
              allowsVehicle: !!row.vehicleDocAllows,
              docType: "vehicle",
            }
          : null,
        latestGeneralDoc: row.generalDocId
          ? {
              id: row.generalDocId,
              pdfPath: row.generalDocPath,
              uploadDate: row.generalDocUploadDate,
              expirationDate: row.generalDocExpiration,
              docType: "general",
            }
          : null,
      }));

      res.json({ providers });
    } catch (err) {
      console.error("Error in GET /providers:", err);
      res.status(500).json({ error: "Error fetching providers" });
    }
  }
);

router.get(
  "/summary",
  authenticateToken,
  requireAnyRole(["guardia", "supervisor", "administrador"]),
  async (_req, res) => {
    try {
      const result = await db.query(
        `WITH latest AS (
           SELECT
             p.id,
             p.is_active,
             COALESCE(docs.has_doc, 0) AS has_doc,
             docs.expiration_date
           FROM providers p
           OUTER APPLY (
             SELECT TOP 1
               expiration_date,
               1 AS has_doc
             FROM provider_docs
             WHERE provider_id = p.id
             ORDER BY upload_date DESC
           ) docs
         ),
         classified AS (
           SELECT
             id,
             is_active,
             CASE
               WHEN has_doc = 0 THEN 'vencido'
               WHEN expiration_date IS NULL THEN 'vencido'
               WHEN expiration_date < SYSDATETIME() THEN 'vencido'
               WHEN DATEDIFF(DAY, SYSDATETIME(), expiration_date) BETWEEN 0 AND 10 THEN 'por_vencer'
               ELSE 'vigente'
             END AS status
           FROM latest
         )
         SELECT
           SUM(CASE WHEN status = 'vencido' THEN 1 ELSE 0 END) AS total_vencidos,
           SUM(CASE WHEN status = 'por_vencer' THEN 1 ELSE 0 END) AS total_por_vencer,
           SUM(CASE WHEN status = 'vigente' THEN 1 ELSE 0 END) AS total_vigentes
         FROM classified
         WHERE is_active = 1`,
        {}
      );

      const row = result.recordset[0] || {};
      res.json({
        success: true,
        total_vencidos: Number(row.total_vencidos) || 0,
        total_por_vencer: Number(row.total_por_vencer) || 0,
        total_vigentes: Number(row.total_vigentes) || 0,
      });
    } catch (err) {
      console.error("Error in GET /providers/summary:", err);
      res.status(500).json({ error: "Error obteniendo resumen de proveedores" });
    }
  }
);

router.get(
  "/:id/docs",
  authenticateToken,
  requireAnyRole(["guardia", "supervisor", "administrador"]),
  async (req, res) => {
    try {
      const docs = await db.query(
        `SELECT
           id,
           doc_type AS docType,
           pdf_path AS pdfPath,
           allows_vehicle AS allowsVehicle,
           upload_date AS uploadDate,
           expiration_date AS expirationDate,
           estado,
           dias_restantes AS diasRestantes
         FROM provider_docs
         WHERE provider_id = @id
         ORDER BY upload_date DESC`,
        { id: Number(req.params.id) }
      );
      res.json({ documents: docs.recordset });
    } catch (err) {
      console.error("Error in GET /providers/:id/docs:", err);
      res.status(500).json({ error: "Error fetching documents" });
    }
  }
);

router.post(
  "/:id/docs",
  authenticateToken,
  requireSupervisor,
  upload.single("pdf"),
  async (req, res) => {
    const providerId = Number(req.params.id);
    const { docType, allowsVehicle = "false", expirationDate } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "PDF file required" });
    }
    if (!docType || !["vehicle", "general"].includes(docType)) {
      await unlinkIfExists(req.file.path);
      return res.status(400).json({ error: "Invalid docType" });
    }

    const relativePath = `/uploads/providers/${req.file.filename}`;
    const uploadDate = new Date();
    let expires = expirationDate ? new Date(expirationDate) : null;
    if (expires && Number.isNaN(expires.getTime())) {
      expires = null;
    }

    const allowsFlag = docType === "vehicle" && (allowsVehicle === "true" || allowsVehicle === true);
    const diasRestantes = expires
      ? Math.ceil((expires.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const estado = expires ? (expires > uploadDate ? "vigente" : "vencido") : null;

    try {
      await db.query(
        `INSERT INTO provider_docs
           (provider_id, doc_type, pdf_path, allows_vehicle, upload_date, expiration_date, uploaded_by, estado, dias_restantes)
         VALUES
           (@provider_id, @doc_type, @pdf_path, @allows_vehicle, @upload_date, @expiration_date, @uploaded_by, @estado, @dias_restantes)`,
        {
          provider_id: providerId,
          doc_type: docType,
          pdf_path: relativePath,
          allows_vehicle: allowsFlag ? 1 : 0,
          upload_date: uploadDate,
          expiration_date: expires,
          uploaded_by: req.user?.id || null,
          estado,
          dias_restantes: diasRestantes,
        }
      );

      if (docType === "vehicle") {
        await db.query(
          "UPDATE providers SET vehicle_access=@access WHERE id=@id",
          { id: providerId, access: allowsFlag ? 1 : 0 }
        );
      }

      res.json({ success: true, pdfPath: relativePath });
    } catch (err) {
      console.error("Error in POST /providers/:id/docs:", err);
      await unlinkIfExists(req.file.path);
      res.status(500).json({ error: "Error saving document" });
    }
  }
);

router.delete(
  "/:providerId/docs/:docId",
  authenticateToken,
  requireSupervisor,
  async (req, res) => {
    const providerId = Number(req.params.providerId);
    const docId = Number(req.params.docId);

    if (Number.isNaN(providerId) || Number.isNaN(docId)) {
      return res.status(400).json({ error: "Invalid identifiers" });
    }

    try {
      const docResult = await db.query(
        `SELECT id, provider_id AS providerId, doc_type AS docType, pdf_path AS pdfPath, allows_vehicle AS allowsVehicle
         FROM provider_docs
         WHERE id=@id`,
        { id: docId }
      );

      const doc = docResult.recordset[0];
      if (!doc || doc.providerId !== providerId) {
        return res.status(404).json({ error: "Document not found" });
      }

      await unlinkIfExists(doc.pdfPath);
      await db.query("DELETE FROM provider_docs WHERE id=@id", { id: docId });

      if (doc.docType === "vehicle") {
        const latest = await db.query(
          `SELECT TOP 1 allows_vehicle AS allowsVehicle
           FROM provider_docs
           WHERE provider_id=@pid AND doc_type='vehicle'
           ORDER BY upload_date DESC`,
          { pid: providerId }
        );
        const hasVehicleAccess = latest.recordset[0]?.allowsVehicle ? 1 : 0;
        await db.query(
          "UPDATE providers SET vehicle_access=@access WHERE id=@id",
          { id: providerId, access: hasVehicleAccess }
        );
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Error in DELETE /providers/:providerId/docs/:docId:", err);
      res.status(500).json({ error: "Error deleting document" });
    }
  }
);

module.exports = router;
