const mongoose = require('mongoose');

// Definir o schema de usuário
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  // NOVO CAMPO: Instrução de sistema personalizada do usuário
  customSystemInstruction: {
    type: String,
    default: null,
    maxlength: 2000
  },
  // Dados adicionais
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: null
  }
});

// Middleware para atualizar o timestamp
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Criar modelo
const User = mongoose.model('User', userSchema);

module.exports = User;
