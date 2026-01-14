const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  // Aceptar cookie 'token' (principal), luego 'session', luego Bearer
  const token =
    req.cookies?.token ||
    req.cookies?.session ||
    (req.headers["authorization"] && req.headers["authorization"].split(" ")[1]);

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

function requireRoles(role) {
  return function (req, res, next) {
    if (req.user && req.user.role === role) return next();
    return res.status(403).json({ error: "No autorizado" });
  };
}

function requireSupervisor(req, res, next) {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role === 'supervisor' || req.user.role === 'administrador') return next();
    return res.status(403).json({ error: 'No autorizado' });
}

// NUEVO: permitir cualquiera de una lista de roles
function requireAnyRole(roles = []) {
  return function (req, res, next) {
    if (!req.user) return res.sendStatus(401);
    if (roles.includes(req.user.role)) return next();
    return res.status(403).json({ error: 'No autorizado' });
  };
}

// NUEVO: exigir administrador estrictamente
function requireAdmin(req, res, next) {
  if (!req.user) return res.sendStatus(401);
  if (req.user.role === 'administrador') return next();
  return res.status(403).json({ error: 'No autorizado' });
}

/*
Ejemplos de uso en un router:
const { authenticateToken, requireAnyRole, requireAdmin } = require('../middleware/auth');

router.get('/solo-supervisores-o-admin', authenticateToken, requireAnyRole(['supervisor','administrador']), handler);
router.delete('/critico', authenticateToken, requireAdmin, handler);
*/

module.exports = { authenticateToken, requireRoles, requireSupervisor, requireAnyRole, requireAdmin };
