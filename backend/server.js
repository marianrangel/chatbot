// server.js - Atualizado com funcionalidade de histórico
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');

// Importar o modelo SessaoChat (certifique-se de que o arquivo existe)
// const SessaoChat = require('./models/SessaoChat');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Conexões com MongoDB Atlas
const mongoUriLogs = process.env.MONGO_URI_LOGS || process.env.MONGO_URI;
const mongoUriHistoria = process.env.MONGO_URI_HISTORIA;

let dbLogs;
let dbHistoria;

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
  dbLogs = await connectToMongoDB(mongoUriLogs, "IIW2023A_Logs", "Logs (Compartilhado)");
  dbHistoria = await connectToMongoDB(mongoUriHistoria, "chatbotHistoriaDB", "Histórico de Chat (Individual)");

  if (!dbLogs) console.warn("⚠️ Banco de logs não conectado.");
  if (!dbHistoria) console.warn("⚠️ Banco de histórico não conectado.");
}

initializeDatabases();

// Configuração do Express
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Endpoint principal do chatbot (POST /chat)
app.post('/chat', async (req, res) => {
  const mensagemUsuario = req.body.mensagem;
  const historicoRecebido = req.body.historico || [];

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const chat = model.startChat({
      history: historicoRecebido,
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