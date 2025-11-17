const crypto = require('crypto');

// Função para fazer hash de senha
function hashPassword(password) {
  return crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');
}

// Função para verificar senha
function verifyPassword(inputPassword, hashedPassword) {
  return hashPassword(inputPassword) === hashedPassword;
}

module.exports = {
  hashPassword,
  verifyPassword
};
