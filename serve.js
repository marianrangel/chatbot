// ============================================================================
// server.js - Versão Final com Dashboard Analytics (Painel de Guerra)
// ============================================================================
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ============================================================================
// 🔗 Conexões com MongoDB Atlas
// ============================================================================
const mongoUriLogs = process.env.MONGO_URI_LOGS || process.env.MONGO_URI;
const mongoUriHistoria = process.env.MONGO_URI_HISTORIA;

let dbLogs;
let dbHistoria;

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

async function initializeDatabases() {
  dbLogs = await connectToMongoDB(mongoUriLogs, "IIW2023A_Logs", "Logs (Compartilhado)");
  dbHistoria = await connectToMongoDB(mongoUriHistoria, "chatbotHistoriaDB", "Histórico de Chat (Individual)");

  if (!dbLogs) console.warn("⚠️ Banco de logs não conectado.");
  if (!dbHistoria) console.warn("⚠️ Banco de histórico não conectado.");
}
initializeDatabases();

// ============================================================================
// ⚙️ Configuração do Express
// ============================================================================
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ============================================================================
// 🎯 ENDPOINT DO PAINEL DE GUERRA - DASHBOARD ANALYTICS
// ============================================================================
app.get('/api/admin/dashboard', async (req, res) => {
  if (!dbHistoria) {
    return res.status(500).json({
      success: false,
      error: "Servidor não conectado ao banco de histórico."
    });
  }

  try {
    const collection = dbHistoria.collection("sessoesChat");

    // === MÉTRICA 1: Profundidade de Engajamento ===
    const engajamentoStats = await collection.aggregate([
      {
        $project: {
          userId: 1,
          numeroDeMensagens: { $size: "$messages" }
        }
      },
      {
        $group: {
          _id: null,
          duracaoMedia: { $avg: "$numeroDeMensagens" },
          conversasCurtas: {
            $sum: { $cond: [{ $lte: ["$numeroDeMensagens", 3] }, 1, 0] }
          },
          conversasLongas: {
            $sum: { $cond: [{ $gt: ["$numeroDeMensagens", 3] }, 1, 0] }
          },
          totalConversas: { $sum: 1 }
        }
      }
    ]).toArray();

    // === MÉTRICA 2: Lealdade do Usuário (Top 5) ===
    const topUsuarios = await collection.aggregate([
      {
        $group: {
          _id: "$userId",
          totalSessoes: { $sum: 1 },
          ultimaAtividade: { $max: "$endTime" }
        }
      },
      { $sort: { totalSessoes: -1 } },
      { $limit: 5 },
      {
        $project: {
          userId: "$_id",
          totalSessoes: 1,
          ultimaAtividade: 1,
          _id: 0
        }
      }
    ]).toArray();

    // === MÉTRICA 3: Análise de Falhas ===
    const frasesDeErro = [
      "não entendi",
      "não compreendi",
      "não posso ajudar",
      "desculpe, não sei",
      "pode reformular",
      "não tenho informação",
      "não consigo responder",
      "não está claro",
      "não compreendo",
      "me desculpe",
      "não sei",
      "não tenho certeza"
    ];

    const conversasComFalha = await collection.aggregate([
      { $unwind: { path: "$messages", includeArrayIndex: "messageIndex" } },
      { $match: { "messages.role": "model" } },
      {
        $addFields: {
          textoBot: {
            $reduce: {
              input: "$messages.parts",
              initialValue: "",
              in: { $concat: ["$$value", " ", { $ifNull: ["$$this.text", ""] }] }
            }
          }
        }
      },
      {
        $match: {
          $or: frasesDeErro.map(frase => ({
            textoBot: { $regex: frase, $options: "i" }
          }))
        }
      },
      {
        $project: {
          sessionId: 1,
          userId: 1,
          messageIndex: 1,
          respostaBot: "$textoBot",
          timestamp: "$messages.timestamp"
        }
      },
      { $sort: { timestamp: -1 } },
      { $limit: 10 }
    ]).toArray();

    const conversasEnriquecidas = await Promise.all(
      conversasComFalha.map(async (falha) => {
        const sessaoCompleta = await collection.findOne({ sessionId: falha.sessionId });
        if (sessaoCompleta && falha.messageIndex > 0) {
          const msgAnterior = sessaoCompleta.messages[falha.messageIndex - 1];
          if (msgAnterior && msgAnterior.role === 'user') {
            const perguntaUsuario = msgAnterior.parts.map(p => p.text).join(' ');
            return {
              sessionId: falha.sessionId,
              userId: falha.userId,
              perguntaUsuario,
              respostaBot: falha.respostaBot.trim(),
              timestamp: falha.timestamp || sessaoCompleta.endTime
            };
          }
        }
        return {
          sessionId: falha.sessionId,
          userId: falha.userId,
          perguntaUsuario: "Pergunta não disponível",
          respostaBot: falha.respostaBot.trim(),
          timestamp: falha.timestamp
        };
      })
    );

    const totalFalhas = await collection.aggregate([
      { $unwind: "$messages" },
      { $match: { "messages.role": "model" } },
      {
        $addFields: {
          textoBot: {
            $reduce: {
              input: "$messages.parts",
              initialValue: "",
              in: { $concat: ["$$value", " ", { $ifNull: ["$$this.text", ""] }] }
            }
          }
        }
      },
      {
        $match: {
          $or: frasesDeErro.map(frase => ({
            textoBot: { $regex: frase, $options: "i" }
          }))
        }
      },
      { $count: "total" }
    ]).toArray();

    // === MÉTRICAS GERAIS ===
    const totalConversas = await collection.countDocuments();
    const ultimasAtividades = await collection
      .find()
      .sort({ endTime: -1 })
      .limit(5)
      .project({ userId: 1, endTime: 1, messages: 1 })
      .toArray();

    const atividadesFormatadas = ultimasAtividades.map(a => ({
      userId: a.userId,
      updatedAt: a.endTime,
      mensagensCount: a.messages ? a.messages.length : 0
    }));

    // === MONTAR RESPOSTA FINAL ===
    const dashboardData = {
      profundidadeEngajamento: {
        duracaoMedia: engajamentoStats[0]?.duracaoMedia?.toFixed(2) || 0,
        conversasCurtas: engajamentoStats[0]?.conversasCurtas || 0,
        conversasLongas: engajamentoStats[0]?.conversasLongas || 0,
        totalConversas: engajamentoStats[0]?.totalConversas || 0
      },
      lealdadeUsuario: {
        topUsuarios
      },
      analiseFalhas: {
        totalRespostasInconclusivas: totalFalhas[0]?.total || 0,
        conversasProblematicas: conversasEnriquecidas.filter(c => c.perguntaUsuario !== "Pergunta não disponível")
      },
      metricsGerais: {
        totalConversas,
        ultimasAtividades: atividadesFormatadas
      }
    };

    console.log("📊 Dashboard consultado com sucesso");
    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("❌ Erro ao buscar dados do dashboard:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao carregar métricas do dashboard",
      details: error.message
    });
  }
});

// ============================================================================
// 🧠 ENDPOINTS DO CHATBOT E HISTÓRICO
// ============================================================================
app.post('/chat', async (req, res) => {
  const mensagemUsuario = req.body.mensagem;
  const historicoRecebido = req.body.historico || [];
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const chat = model.startChat({
      history: historicoRecebido,
      generationConfig: { temperature: 0.9, maxOutputTokens: 1024 }
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
// 💾 SALVAR HISTÓRICO
// ============================================================================
app.post('/api/chat/salvar-historico', async (req, res) => {
  if (!dbHistoria) return res.status(500).json({ error: "Banco não conectado." });

  try {
    const { sessionId, userId, botId, startTime, endTime, messages } = req.body;
    if (!sessionId || !botId || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Dados obrigatórios faltando." });
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

    await dbHistoria.collection("sessoesChat").insertOne(novaSessao);
    console.log(`💾 Histórico salvo: ${sessionId}`);
    res.status(201).json({ message: "Histórico salvo com sucesso.", sessionId });
  } catch (error) {
    console.error("Erro ao salvar histórico:", error.message);
    res.status(500).json({ error: "Erro ao salvar histórico." });
  }
});

// ============================================================================
// 🔍 OUTROS ENDPOINTS: HISTÓRICOS, ESTATÍSTICAS, LOGS, STATUS
// ============================================================================
app.get('/api/chat/historicos', async (req, res) => {
  if (!dbHistoria) return res.status(500).json({ error: "Banco não conectado." });
  try {
    const { page = 1, limit = 10, sortBy = 'startTime', sortOrder = 'desc' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    const collection = dbHistoria.collection("sessoesChat");
    const sessoes = await collection.find({})
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(parseInt(limit))
      .project({ sessionId: 1, botId: 1, userId: 1, startTime: 1, endTime: 1, totalMessages: 1 })
      .toArray();

    res.json({ sessoes });
  } catch (error) {
    console.error("Erro ao buscar históricos:", error.message);
    res.status(500).json({ error: "Erro ao consultar históricos." });
  }
});

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

// ============================================================================
// 🚀 INICIAR SERVIDOR
// ============================================================================
function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log("🎯 Endpoints principais:");
    console.log("   GET  /api/admin/dashboard  → Painel de Guerra (Analytics)");
    console.log("   POST /chat                 → Enviar mensagem ao chatbot");
    console.log("   POST /api/chat/salvar-historico → Salvar histórico");
    console.log("   GET  /api/chat/historicos  → Listar históricos");
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') console.error(`❌ Porta ${PORT} em uso.`);
    else console.error("Erro ao iniciar servidor:", err.message);
  });
}
startServer();
