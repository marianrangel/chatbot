const mongoose = require('mongoose');

// Schema para configurações globais do administrador
const adminSettingsSchema = new mongoose.Schema({
  globalSystemInstruction: {
    type: String,
    default: "Você é um assistente útil, educado e bem informado. Responda com clareza e precisão.",
    maxlength: 2000
  },
  botName: {
    type: String,
    default: "ChatBot-IFCODE"
  },
  botDescription: {
    type: String,
    default: "Um assistente inteligente para ajudá-lo com suas dúvidas"
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
});

// Middleware para atualizar timestamp
adminSettingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const AdminSettings = mongoose.model('AdminSettings', adminSettingsSchema);

module.exports = AdminSettings;
