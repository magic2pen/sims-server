// middleware/auth.js
// Verifies the JWT sent by the app/portal in the Authorization header,
// and (optionally) checks the token belongs to the required role.
// This is what enforces "only admins can create officer accounts".

const jwt = require('jsonwebtoken');

function requireAuth(requiredRole) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const token = header.slice('Bearer '.length);
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (requiredRole && payload.role !== requiredRole) {
        return res.status(403).json({ error: `This action requires role: ${requiredRole}` });
      }
      req.user = payload; // { id, role, name, ... }
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

module.exports = { requireAuth };
