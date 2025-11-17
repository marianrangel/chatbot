const jwt = require('jsonwebtoken');

// Middleware para verificar se o usuário está autenticado
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Token não fornecido. Autenticação necessária." });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'seu_secret_key_super_seguro', (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido ou expirado." });
    }

    req.userId = user.userId;
    req.username = user.username;
    next();
  });
};

module.exports = authenticateToken;
