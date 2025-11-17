// server.js - Atualizado com funcionalidade de histórico e customização de personalidade
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Importar modelos
const User = require('./models/User');
const AdminSettings = require('./models/AdminSettings');
const authenticateToken = require('./middleware/auth');
const { hashPassword, verifyPassword } = require('./utils/passwordUtils');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const JWT_SECRET = process.env.JWT_SECRET || 'seu_secret_key_super_seguro';

// Conexões com MongoDB Atlas
const mongoUriLogs = process.env.MONGO_URI_LOGS || process.env.MONGO_URI;
const mongoUriHistoria = process.env.MONGO_URI_HISTORIA;
const mongoUriUsers = process.env.MONGO_URI_USERS || process.env.MONGO_URI; // Para Mongoose

let dbLogs;
let dbHistoria;

// Conectar ao MongoDB com Mongoose (para os modelos)
async function connectMongoose() {
  try {
    await mongoose.connect(mongoUriUsers, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`✅ Mongoose conectado ao MongoDB`);
  } catch (err) {
    console.error(`❌ Erro ao conectar Mongoose:`, err.message);
  }
}

// Função para conectar ao MongoDB
async function connectToMongoDB(uri, dbName, description) {
  if (!uri) {
    console.error(`❌ URI do MongoDB para ${description} não definida.`);
    return null;
  }

  try {
    const client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    await client.connect();
    console.log(`✅ Conectado ao MongoDB Atlas: ${description}`);
    return client.db(dbName);
  } catch (err) {
    console.error(`❌ Falha ao conectar ao MongoDB ${description}:`, err.message);
    return null;
  }
}

// Inicializa os dois bancos
async function initializeDatabases() {
  await connectMongoose();
  dbLogs = await connectToMongoDB(mongoUriLogs, "IIW2023A_Logs", "Logs (Compartilhado)");
  dbHistoria = await connectToMongoDB(mongoUriHistoria, "chatbotHistoriaDB", "Histórico de Chat (Individual)");

  if (!dbLogs) console.warn("⚠️ Banco de logs não conectado.");
  if (!dbHistoria) console.warn("⚠️ Banco de histórico não conectado.");
}

initializeDatabases();

// Configuração do Express
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Endpoint principal do chatbot (POST /chat) - REFATORADO COM SUPORTE A PERSONALIDADE CUSTOMIZADA
app.post('/chat', async (req, res) => {
  const mensagemUsuario = req.body.mensagem;
  const historicoRecebido = req.body.historico || [];
  const userId = req.body.userId; // Agora aceita userId opcional

  try {
    let systemInstruction = null;
    
    // SE o usuário está logado, buscar sua instrução personalizada
    if (userId) {
      const user = await User.findById(userId);
      if (user && user.customSystemInstruction) {
        systemInstruction = user.customSystemInstruction;
        console.log(`✨ Usando instrução personalizada do usuário ${user.username}`);
      }
    }

    // SE não tem instrução personalizada, buscar a instrução global do admin
    if (!systemInstruction) {
      const adminSettings = await AdminSettings.findOne();
      systemInstruction = adminSettings?.globalSystemInstruction || 
        "Você é um assistente útil, educado e bem informado. Responda com clareza e precisão.";
      console.log(`🌍 Usando instrução global do administrador`);
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Construir histórico com a instrução de sistema
    const historicoComSistema = [
      { role: "user", parts: [{ text: systemInstruction }] },
      { role: "model", parts: [{ text: "Entendido! Vou seguir essas instruções." }] },
      ...historicoRecebido
    ];

    const chat = model.startChat({
      history: historicoComSistema,
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 1024
      },
      safetySettings: [
        { category: "HARM_CATEGORY_DEROGATORY", threshold: 3 },
        { category: "HARM_CATEGORY_VIOLENCE", threshold: 3 }
      ]
    });

    const result = await chat.sendMessage(mensagemUsuario);
    const response = await result.response;
    const textoResposta = response.text();

    const novoHistorico = [
      ...historicoRecebido,
      { role: "user", parts: [{ text: mensagemUsuario }] },
      { role: "model", parts: [{ text: textoResposta }] }
    ];

    res.json({ resposta: textoResposta, historico: novoHistorico });
  } catch (error) {
    console.error("Erro ao chamar API Gemini:", error);
    res.status(500).json({ erro: "Erro interno ao processar a mensagem." });
  }
});

// ============================================================================
// ENDPOINTS DE AUTENTICAÇÃO
// ============================================================================

// POST /api/auth/register - Registrar novo usuário
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, passwordConfirm } = req.body;

    // Validações
    if (!username || !email || !password || !passwordConfirm) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios." });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({ error: "Senhas não conferem." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres." });
    }

    // Verificar se usuário já existe
    const usuarioExistente = await User.findOne({ 
      $or: [{ username }, { email }] 
    });

    if (usuarioExistente) {
      return res.status(409).json({ error: "Username ou email já cadastrado." });
    }

    // Criar novo usuário
    const novoUsuario = new User({
      username,
      email,
      password: hashPassword(password)
    });

    await novoUsuario.save();

    // Gerar token JWT
    const token = jwt.sign(
      { userId: novoUsuario._id, username: novoUsuario.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: "Usuário registrado com sucesso!",
      token,
      user: {
        id: novoUsuario._id,
        username: novoUsuario.username,
        email: novoUsuario.email,
        customSystemInstruction: novoUsuario.customSystemInstruction
      }
    });

  } catch (error) {
    console.error("Erro ao registrar usuário:", error.message);
    res.status(500).json({ error: "Erro ao registrar usuário." });
  }
});

// POST /api/auth/login - Fazer login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username e senha são obrigatórios." });
    }

    // Buscar usuário
    const usuario = await User.findOne({ username });

    if (!usuario) {
      return res.status(401).json({ error: "Username ou senha inválidos." });
    }

    // Verificar senha
    if (!verifyPassword(password, usuario.password)) {
      return res.status(401).json({ error: "Username ou senha inválidos." });
    }

    // Atualizar lastLogin
    usuario.lastLogin = new Date();
    await usuario.save();

    // Gerar token JWT
    const token = jwt.sign(
      { userId: usuario._id, username: usuario.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: "Login bem-sucedido!",
      token,
      user: {
        id: usuario._id,
        username: usuario.username,
        email: usuario.email,
        customSystemInstruction: usuario.customSystemInstruction
      }
    });

  } catch (error) {
    console.error("Erro ao fazer login:", error.message);
    res.status(500).json({ error: "Erro ao fazer login." });
  }
});

// ============================================================================
// ENDPOINTS DE PREFERÊNCIAS DO USUÁRIO
// ============================================================================

// GET /api/user/preferences - Buscar preferências do usuário logado
app.get('/api/user/preferences', authenticateToken, async (req, res) => {
  try {
    const usuario = await User.findById(req.userId);

    if (!usuario) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    res.json({
      customSystemInstruction: usuario.customSystemInstruction,
      username: usuario.username,
      email: usuario.email
    });

  } catch (error) {
    console.error("Erro ao buscar preferências:", error.message);
    res.status(500).json({ error: "Erro ao buscar preferências." });
  }
});

// PUT /api/user/preferences - Atualizar preferências do usuário logado
app.put('/api/user/preferences', authenticateToken, async (req, res) => {
  try {
    const { customSystemInstruction } = req.body;

    if (!customSystemInstruction) {
      return res.status(400).json({ error: "Campo customSystemInstruction é obrigatório." });
    }

    if (customSystemInstruction.length > 2000) {
      return res.status(400).json({ error: "Instrução deve ter no máximo 2000 caracteres." });
    }

    const usuario = await User.findByIdAndUpdate(
      req.userId,
      { customSystemInstruction },
      { new: true }
    );

    if (!usuario) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    console.log(`✨ Personalidade atualizada para ${usuario.username}`);

    res.json({
      message: "Personalidade salva com sucesso!",
      customSystemInstruction: usuario.customSystemInstruction
    });

  } catch (error) {
    console.error("Erro ao atualizar preferências:", error.message);
    res.status(500).json({ error: "Erro ao atualizar preferências." });
  }
});

// DELETE /api/user/preferences - Remover personalidade customizada
app.delete('/api/user/preferences', authenticateToken, async (req, res) => {
  try {
    const usuario = await User.findByIdAndUpdate(
      req.userId,
      { customSystemInstruction: null },
      { new: true }
    );

    if (!usuario) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    res.json({ message: "Personalidade removida. Usando personalidade global." });

  } catch (error) {
    console.error("Erro ao remover preferências:", error.message);
    res.status(500).json({ error: "Erro ao remover preferências." });
  }
});

// Salvar histórico do chat (POST /api/chat/salvar-historico)
app.post('/api/chat/salvar-historico', async (req, res) => {
  if (!dbHistoria) {
    return res.status(500).json({ error: "Servidor não conectado ao banco de dados de histórico." });
  }

  try {
    const { sessionId, userId, botId, startTime, endTime, messages } = req.body;

    if (!sessionId || !botId || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Dados obrigatórios faltando para salvar histórico." });
    }

    const novaSessao = {
      sessionId,
      userId: userId || 'anonimo',
      botId,
      startTime: new Date(startTime || Date.now()),
      endTime: new Date(endTime || Date.now()),
      messages,
      totalMessages: messages.length,
      loggedAt: new Date()
    };

    const collection = dbHistoria.collection("sessoesChat");
    await collection.insertOne(novaSessao);

    console.log(`💾 Histórico salvo: ${sessionId}`);
    res.status(201).json({ message: "Histórico salvo com sucesso.", sessionId });
  } catch (error) {
    console.error("Erro ao salvar histórico:", error.message);
    res.status(500).json({ error: "Erro ao salvar histórico." });
  }
});

// NOVO ENDPOINT: Buscar lista de históricos de conversas (GET /api/chat/historicos)
app.get('/api/chat/historicos', async (req, res) => {
  if (!dbHistoria) {
    return res.status(500).json({ error: "Servidor não conectado ao banco de histórico." });
  }

  try {
    const { 
      page = 1, 
      limit = 10, 
      botId, 
      userId,
      sortBy = 'startTime',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    // Construir filtros dinâmicos
    const filtros = {};
    if (botId) filtros.botId = botId;
    if (userId) filtros.userId = userId;

    const collection = dbHistoria.collection("sessoesChat");
    
    // Buscar sessões com paginação
    const sessoes = await collection.find(filtros)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(parseInt(limit))
      .project({ 
        sessionId: 1,
        botId: 1,
        userId: 1,
        startTime: 1,
        endTime: 1,
        totalMessages: 1,
        loggedAt: 1,
        // Não incluir o array completo de mensagens na listagem para melhor performance
        'messages.0': 1, // Apenas a primeira mensagem para prévia
        'messages.-1': 1 // Apenas a última mensagem para prévia
      })
      .toArray();

    // Contar total para paginação
    const totalSessoes = await collection.countDocuments(filtros);
    const totalPaginas = Math.ceil(totalSessoes / parseInt(limit));

    // Enriquecer dados para exibição
    const sessoesEnriquecidas = sessoes.map(sessao => {
      const duracao = new Date(sessao.endTime) - new Date(sessao.startTime);
      const duracaoMinutos = Math.round(duracao / (1000 * 60));
      
      return {
        ...sessao,
        duracaoMinutos,
        preview: {
          primeiraMensagem: sessao.messages?.[0]?.parts?.[0]?.text?.substring(0, 100) + '...' || 'Sem mensagens',
          ultimaMensagem: sessao.messages?.[sessao.messages.length - 1]?.parts?.[0]?.text?.substring(0, 100) + '...' || 'Sem mensagens'
        }
      };
    });

    res.json({
      sessoes: sessoesEnriquecidas,
      paginacao: {
        paginaAtual: parseInt(page),
        totalPaginas,
        totalSessoes,
        itensPorPagina: parseInt(limit),
        temProxima: parseInt(page) < totalPaginas,
        temAnterior: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error("Erro ao buscar históricos:", error.message);
    res.status(500).json({ error: "Erro ao consultar históricos." });
  }
});

// NOVO ENDPOINT: Buscar conversa específica por sessionId (GET /api/chat/historicos/:sessionId)
app.get('/api/chat/historicos/:sessionId', async (req, res) => {
  if (!dbHistoria) {
    return res.status(500).json({ error: "Servidor não conectado ao banco de histórico." });
  }

  try {
    const { sessionId } = req.params;
    const collection = dbHistoria.collection("sessoesChat");

    const sessao = await collection.findOne({ sessionId });
    
    if (!sessao) {
      return res.status(404).json({ error: "Sessão não encontrada." });
    }

    // Calcular estatísticas da conversa
    const duracao = new Date(sessao.endTime) - new Date(sessao.startTime);
    const duracaoMinutos = Math.round(duracao / (1000 * 60));
    const mensagensUsuario = sessao.messages.filter(m => m.role === 'user').length;
    const mensagensBot = sessao.messages.filter(m => m.role === 'model').length;

    const sessaoCompleta = {
      ...sessao,
      estatisticas: {
        duracaoMinutos,
        totalMensagens: sessao.totalMessages,
        mensagensUsuario,
        mensagensBot,
        dataFormatada: new Date(sessao.startTime).toLocaleString('pt-BR'),
        dataFimFormatada: new Date(sessao.endTime).toLocaleString('pt-BR')
      }
    };

    res.json(sessaoCompleta);

  } catch (error) {
    console.error("Erro ao buscar sessão específica:", error.message);
    res.status(500).json({ error: "Erro ao consultar sessão." });
  }
});

// NOVO ENDPOINT: Buscar estatísticas gerais dos históricos (GET /api/chat/estatisticas)
app.get('/api/chat/estatisticas', async (req, res) => {
  if (!dbHistoria) {
    return res.status(500).json({ error: "Servidor não conectado ao banco de histórico." });
  }

  try {
    const collection = dbHistoria.collection("sessoesChat");

    // Agregação para estatísticas
    const estatisticas = await collection.aggregate([
      {
        $group: {
          _id: null,
          totalSessoes: { $sum: 1 },
          totalMensagens: { $sum: "$totalMessages" },
          mediaMensagensPorSessao: { $avg: "$totalMessages" },
          primeiraSessao: { $min: "$startTime" },
          ultimaSessao: { $max: "$startTime" }
        }
      }
    ]).toArray();

    // Estatísticas por bot
    const estatisticasPorBot = await collection.aggregate([
      {
        $group: {
          _id: "$botId",
          totalSessoes: { $sum: 1 },
          totalMensagens: { $sum: "$totalMessages" },
          mediaMensagens: { $avg: "$totalMessages" }
        }
      },
      { $sort: { totalSessoes: -1 } }
    ]).toArray();

    const resultado = {
      geral: estatisticas[0] || {
        totalSessoes: 0,
        totalMensagens: 0,
        mediaMensagensPorSessao: 0,
        primeiraSessao: null,
        ultimaSessao: null
      },
      porBot: estatisticasPorBot
    };

    res.json(resultado);

  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error.message);
    res.status(500).json({ error: "Erro ao consultar estatísticas." });
  }
});

// Consultar histórico de sessões (GET /api/chat/historico ou /:sessionId) - MANTIDO PARA COMPATIBILIDADE
app.get('/api/chat/historico/:sessionId?', async (req, res) => {
  if (!dbHistoria) {
    return res.status(500).json({ error: "Servidor não conectado ao banco de histórico." });
  }

  try {
    const { sessionId } = req.params;
    const collection = dbHistoria.collection("sessoesChat");

    if (sessionId) {
      const sessao = await collection.findOne({ sessionId });
      if (!sessao) return res.status(404).json({ error: "Sessão não encontrada." });
      return res.json(sessao);
    }

    const sessoes = await collection.find({})
      .sort({ loggedAt: -1 })
      .limit(10)
      .toArray();

    res.json(sessoes);
  } catch (error) {
    console.error("Erro ao buscar histórico:", error.message);
    res.status(500).json({ error: "Erro ao consultar histórico." });
  }
});

// Log de acesso (POST /api/log-connection)
app.post('/api/log-connection', async (req, res) => {
  if (!dbLogs) {
    return res.status(500).json({ error: "Servidor não conectado ao banco de logs." });
  }

  const { ip, acao, nomeBot } = req.body;
  const agora = new Date();

  const log = {
    col_data: agora.toISOString().split('T')[0],
    col_hora: agora.toTimeString().split(' ')[0],
    col_IP: ip,
    col_nome_bot: nomeBot,
    col_acao: acao
  };

  try {
    await dbLogs.collection("tb_cl_user_log_acess").insertOne(log);
    res.status(201).json({ message: "Log registrado." });
  } catch (error) {
    console.error("Erro ao registrar log:", error.message);
    res.status(500).json({ error: "Erro ao registrar log." });
  }
});

// Ranking de bots (em memória)
let dadosRankingVitrine = [];

app.post('/api/ranking/registrar-acesso-bot', (req, res) => {
  const { botId, nomeBot, timestampAcesso, usuarioId } = req.body;

  const acesso = {
    botId,
    nomeBot,
    usuarioId: usuarioId || 'anonimo',
    acessoEm: new Date(timestampAcesso || Date.now()),
    contagem: 1
  };

  const existente = dadosRankingVitrine.find(b => b.botId === botId);
  if (existente) {
    existente.contagem++;
    existente.ultimoAcesso = acesso.acessoEm;
  } else {
    dadosRankingVitrine.push({
      ...acesso,
      ultimoAcesso: acesso.acessoEm
    });
  }

  res.status(201).json({ message: "Acesso ao bot registrado." });
});

app.get('/api/ranking/visualizar', (req, res) => {
  const ordenado = [...dadosRankingVitrine].sort((a, b) => b.contagem - a.contagem);
  res.json(ordenado);
});

// Verificar status da API e dos bancos
app.get('/api/status', (req, res) => {
  res.json({
    status: "online",
    timestamp: new Date().toISOString(),
    databases: {
      logs: dbLogs ? "conectado" : "desconectado",
      historico: dbHistoria ? "conectado" : "desconectado"
    }
  });
});

// Iniciar servidor com tratamento de porta em uso
function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📋 Endpoints disponíveis:`);
    console.log(`   GET  /api/chat/historicos - Lista paginada de sessões`);
    console.log(`   GET  /api/chat/historicos/:sessionId - Sessão específica`);
    console.log(`   GET  /api/chat/estatisticas - Estatísticas gerais`);
    console.log(`   POST /chat - Enviar mensagem ao chatbot`);
    console.log(`   POST /api/chat/salvar-historico - Salvar histórico`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Porta ${PORT} em uso. Tente outra porta.`);
    } else {
      console.error("Erro ao iniciar servidor:", err.message);
    }
  });
}

startServer();