const express = require("express");
const router = express.Router();
const { db } = require("../lib/database");
const { broadcastAccessEvent } = require("../realtime");
const { triggerShellyRelay, getShellyConfig } = require("../lib/shellyClient");
const { getLocalizedCurrentTimestamp } = require("../lib/timezone");

const SHELLY_SECRET = process.env.SHELLY_SHARED_SECRET || null;
const SHELLY_GUARD_USER_ID_ENV = Number(process.env.SHELLY_GUARD_USER_ID || 0) || null;

let cachedShellyGuardUserId = SHELLY_GUARD_USER_ID_ENV;

async function resolveShellyGuardUserId() {
  if (cachedShellyGuardUserId != null) {
    return cachedShellyGuardUserId;
  }

  try {
    const guardResult = await db.query(
      "SELECT TOP 1 id FROM users WHERE role = 'guardia' ORDER BY id ASC",
      {}
    );
    if (guardResult.recordset[0]?.id) {
      cachedShellyGuardUserId = guardResult.recordset[0].id;
      return cachedShellyGuardUserId;
    }
  } catch (err) {
    console.warn("Shelly scan: unable to resolve guard user id from role guardia:", err.message);
  }

  try {
    const fallbackResult = await db.query(
      "SELECT TOP 1 id FROM users ORDER BY id ASC",
      {}
    );
    if (fallbackResult.recordset[0]?.id) {
      cachedShellyGuardUserId = fallbackResult.recordset[0].id;
    }
  } catch (err) {
    console.warn("Shelly scan: fallback guard user lookup failed:", err.message);
  }

  return cachedShellyGuardUserId;
}

function serializeError(error) {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return "Error desconocido";
  }
}

async function handleShellyScan(req, res) {
  try {
    if (SHELLY_SECRET) {
      const incomingSecret = req.header("x-shelly-secret");
      if (!incomingSecret || incomingSecret !== SHELLY_SECRET) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    const dni = typeof req.body?.dni === "string" ? req.body.dni.trim() : "";
    if (!dni) {
      return res.status(400).json({ error: "dni requerido" });
    }

    const requestedActionRaw = typeof req.body?.action === "string" ? req.body.action.trim().toLowerCase() : "entry";
    const requestedAction = requestedActionRaw === "exit" ? "exit" : "entry";

    const personResult = await db.query(
      `SELECT TOP 1
         p.id,
         p.name,
         p.dni,
         p.type,
         p.is_active AS isActive,
         p.photo_url AS photoUrl,
         a.name AS areaName
       FROM people p
       LEFT JOIN areas a ON a.id = p.area_id
       WHERE p.dni = @dni`,
      { dni }
    );

    const person = personResult.recordset[0];
    if (!person) {
      const payload = {
        allowed: false,
        color: "red",
        status: "denied",
        reasonCode: "PERSON_NOT_FOUND",
        message: "No se encontró ninguna persona con ese DNI",
        person: { dni },
      };
      broadcastAccessEvent(payload);
      return res.json(payload);
    }

    const now = new Date();
    const responsePayload = {
      allowed: true,
      color: "green",
      status: "approved",
      reasonCode: "ACCESS_GRANTED",
      message: "Acceso permitido",
      person: {
        id: person.id,
        name: person.name,
        dni: person.dni,
        type: person.type,
        area: person.areaName || null,
        photoUrl: person.photoUrl || null,
      },
      provider: null,
      timestamp: now.toISOString(),
    };
    const rawNotes =
      typeof req.body?.notes === "string" && req.body.notes.trim().length > 0
        ? req.body.notes.trim()
        : "";
    const entryNotes = rawNotes.length > 0 ? rawNotes : "Registrado via Shelly";
    const exitNotes = rawNotes.length > 0 ? rawNotes : null;

    if (!person.isActive) {
      responsePayload.allowed = false;
      responsePayload.color = "red";
      responsePayload.status = "denied";
      responsePayload.reasonCode = "PERSON_INACTIVE";
      responsePayload.message = "La persona está marcada como inactiva";
    }

    if (person.type === "proveedor") {
      const providerResult = await db.query(
        `SELECT TOP 1 id, is_active AS isActive
         FROM providers
         WHERE dni = @dni`,
        { dni: person.dni }
      );
      const provider = providerResult.recordset[0];

      if (!provider) {
        responsePayload.allowed = false;
        responsePayload.color = "red";
        responsePayload.status = "denied";
        responsePayload.reasonCode = "PROVIDER_NOT_FOUND";
        responsePayload.message = "Proveedor no registrado en catálogo";
      } else if (!provider.isActive) {
        responsePayload.allowed = false;
        responsePayload.color = "red";
        responsePayload.status = "denied";
        responsePayload.reasonCode = "PROVIDER_INACTIVE";
        responsePayload.message = "Proveedor marcado como inactivo";
      } else {
        const docsResult = await db.query(
          `SELECT TOP 1
             expiration_date AS expirationDate,
             upload_date AS uploadDate
           FROM provider_docs
           WHERE provider_id = @providerId
           ORDER BY upload_date DESC`,
          { providerId: provider.id }
        );

        const doc = docsResult.recordset[0];
        let docStatus = "inexistente";
        let daysRemaining = null;
        let expirationDate = null;

        if (doc) {
          expirationDate = doc.expirationDate ? new Date(doc.expirationDate) : null;
          if (!expirationDate || Number.isNaN(expirationDate.getTime())) {
            docStatus = "sin_vencimiento";
          } else if (expirationDate < now) {
            docStatus = "vencido";
            daysRemaining = -Math.ceil((now.getTime() - expirationDate.getTime()) / (1000 * 60 * 60 * 24));
          } else {
            const diff = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            daysRemaining = diff;
            docStatus = diff <= 10 ? "proximo_vencer" : "vigente";
          }
        }

        responsePayload.provider = {
          id: provider.id,
          docStatus,
          expirationDate: expirationDate ? expirationDate.toISOString() : null,
          daysRemaining,
        };

        if (docStatus === "vencido" || docStatus === "inexistente") {
          responsePayload.allowed = false;
          responsePayload.color = "red";
          responsePayload.status = "denied";
          responsePayload.reasonCode = docStatus === "vencido" ? "PROVIDER_DOC_EXPIRED" : "PROVIDER_DOC_MISSING";
          responsePayload.message =
            docStatus === "vencido"
              ? "Documentación vencida. Acceso denegado."
              : "No se encontró documentación vigente. Acceso denegado.";
        } else {
          responsePayload.reasonCode =
            docStatus === "proximo_vencer" ? "PROVIDER_DOC_NEAR_EXPIRATION" : "ACCESS_GRANTED";
          responsePayload.message =
            docStatus === "proximo_vencer"
              ? "Documentación próxima a vencer. Acceso permitido."
              : "Documentación vigente. Acceso permitido.";
        }
      }
    }

    const originalMessage = responsePayload.message;
    const shellyConfig = getShellyConfig();

    const shellyRelayAction = shellyConfig.openAction;
    const restoreAction = shellyConfig.closeAction;

    if (responsePayload.allowed) {
      const shellyResult = await triggerShellyRelay({
        action: shellyRelayAction,
        restoreAction,
        restoreDelayMs: shellyConfig.pulseDurationMs,
      });
      if (shellyResult.skipped) {
        responsePayload.shellyTrigger = {
          status: "skipped",
          reason: shellyResult.message || "Shelly no configurado",
          relayAction: shellyRelayAction,
        };
      } else if (shellyResult.success) {
        responsePayload.shellyTrigger = {
          status: "success",
          attempts: shellyResult.attempts,
          relayAction: shellyRelayAction,
          restoreScheduled: shellyResult.restoreScheduled ?? Boolean(restoreAction),
        };
      } else {
        responsePayload.shellyTrigger = {
          status: "failed",
          attempts: shellyResult.attempts,
          error: shellyResult.error || "Shelly no respondió",
          relayAction: shellyRelayAction,
          restoreScheduled: shellyResult.restoreScheduled ?? Boolean(restoreAction),
        };
        responsePayload.reasonCode = "HARDWARE_TRIGGER_FAILED";
        responsePayload.message = `${originalMessage} (No se pudo activar el relé)`;
      }
    } else {
      responsePayload.shellyTrigger = {
        status: "skipped",
        reason: "Acceso denegado",
        relayAction: shellyRelayAction,
        restoreScheduled: false,
      };
    }

    responsePayload.shellyTrigger = {
      ...responsePayload.shellyTrigger,
      configured: shellyConfig.enabled,
    };
    responsePayload.requestedAction = requestedAction;

    if (responsePayload.allowed) {
      try {
        const guardUserId = await resolveShellyGuardUserId();
        if (!guardUserId) {
          console.warn("Shelly scan: guard user id not resolved, skipping access log persistence.");
        } else {
          const timestamp = await getLocalizedCurrentTimestamp();
          if (requestedAction === "exit") {
            const updateRes = await db.query(
              `UPDATE access_logs
               SET exit_time = CONVERT(DATETIME2, @ts, 120), notes = CASE WHEN @notes IS NULL OR LTRIM(RTRIM(@notes)) = '' THEN notes ELSE @notes END
               WHERE person_id=@personId AND exit_time IS NULL`,
              {
                personId: person.id,
                ts: timestamp,
                notes: exitNotes,
              }
            );
            if (updateRes.rowsAffected[0] === 0) {
              responsePayload.reasonCode = "NO_OPEN_ENTRY";
              responsePayload.status = "warning";
              responsePayload.color = "yellow";
              responsePayload.message = "No se encontro registro de ingreso activo. No se actualizo la salida.";
            }
          } else {
            await db.query(
              `INSERT INTO access_logs (person_id, vehicle_id, entry_time, notes, guard_user_id, created_at)
               VALUES (@personId, NULL, CONVERT(DATETIME2, @ts, 120), @notes, @guardUserId, CONVERT(DATETIME2, @ts, 120))`,
              {
                personId: person.id,
                ts: timestamp,
                notes: entryNotes,
                guardUserId,
              }
            );
          }
        }
      } catch (logErr) {
        console.error("Shelly scan: error registrando log de acceso:", logErr);
      }
    }

    broadcastAccessEvent(responsePayload);
    return res.json(responsePayload);
  } catch (err) {
    console.error("Shelly scan error:", err);
    return res.status(500).json({ error: "Error interno procesando escaneo", detail: serializeError(err) });
  }
}

router.post("/scan", handleShellyScan);

module.exports = router;
module.exports.handleScan = handleShellyScan;
