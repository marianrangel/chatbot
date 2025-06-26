// server.js
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Conexões com MongoDB Atlas - Múltiplos bancos
const mongoUriLogs = process.env.MONGO_URI_LOGS || process.env.MONGO_URI; // Fallback para compatibilidade
const mongoUriHistoria = process.env.MONGO_URI_HISTORIA;

let dbLogs;
let dbHistoria;

async function connectToMongoDB(uri, dbName, description) {
  if (!uri) {
    console.error(`URI do MongoDB para ${description} não definida!`);
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
  // Conecta ao banco de logs (compartilhado)
  dbLogs = await connectToMongoDB(
    mongoUriLogs, 
    "IIW2023A_Logs", 
    "Logs (Compartilhado)"
  );
  
  // Conecta ao banco de histórico (individual)
  dbHistoria = await connectToMongoDB(
    mongoUriHistoria, 
    "chatbotHistoriaDB", 
    "Histórico de Chat (Individual)"
  );
  
  if (!dbLogs) {
    console.warn("⚠️  Banco de logs não conectado. Funcionalidade de log pode não funcionar.");
  }
  
  if (!dbHistoria) {
    console.warn("⚠️  Banco de histórico não conectado. Funcionalidade de histórico pode não funcionar.");
  }
}

// Inicializar conexões com os bancos
initializeDatabases();

// Serve arquivos estáticos (HTML, JS, CSS)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Endpoint do chat
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

// Endpoint para registrar log de acesso do usuário (banco compartilhado)
app.post('/api/log-connection', async (req, res) => {
  if (!dbLogs) {
    return res.status(500).json({ error: 'Servidor não conectado ao banco de dados de logs.' });
  }

  const { ip, acao, nomeBot } = req.body;
  if (!ip || !acao || !nomeBot) {
    return res.status(400).json({ error: 'Dados de log incompletos (IP, ação e nomeBot são obrigatórios).' });
  }

  const agora = new Date();
  const dataFormatada = agora.toISOString().split('T')[0]; // YYYY-MM-DD
  const horaFormatada = agora.toTimeString().split(' ')[0]; // HH:MM:SS
  
  const logEntry = {
    col_data: dataFormatada,
    col_hora: horaFormatada,
    col_IP: ip,
    col_nome_bot: nomeBot,
    col_acao: acao
  };

  try {
    const collection = dbLogs.collection('tb_cl_user_log_acess');
    await collection.insertOne(logEntry);
    console.log(`📊 Log registrado: ${acao} - ${nomeBot} - ${ip}`);
    res.status(201).json({ message: 'Log registrado com sucesso!' });
  } catch (err) {
    console.error('Erro ao registrar log:', err);
    res.status(500).json({ error: 'Erro ao registrar log.' });
  }
});

// NOVO: Endpoint para salvar histórico completo do chat (banco individual)
app.post('/api/chat/salvar-historico', async (req, res) => {
  if (!dbHistoria) {
    return res.status(500).json({ error: "Servidor não conectado ao banco de dados de histórico." });
  }

  try {
    const { sessionId, userId, botId, startTime, endTime, messages } = req.body;

    // Validação dos dados obrigatórios
    if (!sessionId || !botId || !messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: "Dados incompletos para salvar histórico (sessionId, botId, messages são obrigatórios)." 
      });
    }

    const novaSessao = {
      sessionId,
      userId: userId || 'anonimo',
      botId,
      startTime: startTime ? new Date(startTime) : new Date(),
      endTime: endTime ? new Date(endTime) : new Date(),
      messages, // O array completo de histórico do chat
      totalMessages: messages.length,
      loggedAt: new Date()
    };

    const collection = dbHistoria.collection("sessoesChat");
    const result = await collection.insertOne(novaSessao);

    console.log(`💾 Histórico de sessão salvo: ${sessionId} (${messages.length} mensagens)`);
    res.status(201).json({ 
      message: "Histórico de chat salvo com sucesso!", 
      sessionId: novaSessao.sessionId,
      totalMessages: messages.length
    });

  } catch (error) {
    console.error("[Servidor] Erro em /api/chat/salvar-historico:", error.message);
    res.status(500).json({ error: "Erro interno ao salvar histórico de chat." });
  }
});

// NOVO: Endpoint para consultar histórico de sessões (opcional)
app.get('/api/chat/historico/:sessionId?', async (req, res) => {
  if (!dbHistoria) {
    return res.status(500).json({ error: "Servidor não conectado ao banco de dados de histórico." });
  }

  try {
    const { sessionId } = req.params;
    const collection = dbHistoria.collection("sessoesChat");

    if (sessionId) {
      // Buscar sessão específica
      const sessao = await collection.findOne({ sessionId });
      if (!sessao) {
        return res.status(404).json({ error: "Sessão não encontrada." });
      }
      res.json(sessao);
    } else {
      // Listar últimas 10 sessões
      const sessoes = await collection
        .find({})
        .sort({ loggedAt: -1 })
        .limit(10)
        .toArray();
      res.json(sessoes);
    }

  } catch (error) {
    console.error("[Servidor] Erro ao consultar histórico:", error.message);
    res.status(500).json({ error: "Erro interno ao consultar histórico." });
  }
});

// Simulação de ranking de bots
let dadosRankingVitrine = [];

// Endpoint para registrar acesso ao bot para ranking
app.post('/api/ranking/registrar-acesso-bot', (req, res) => {
  const { botId, nomeBot, timestampAcesso, usuarioId } = req.body;
  if (!botId || !nomeBot) {
    return res.status(400).json({ error: 'ID e Nome do Bot são obrigatórios para o ranking.' });
  }
  
  const acesso = {
    botId,
    nomeBot,
    usuarioId: usuarioId || 'anonimo',
    acessoEm: timestampAcesso ? new Date(timestampAcesso) : new Date(),
    contagem: 1
  };
  
  const botExistente = dadosRankingVitrine.find(b => b.botId === botId);
  if (botExistente) {
    botExistente.contagem += 1;
    botExistente.ultimoAcesso = acesso.acessoEm;
  } else {
    dadosRankingVitrine.push({
      botId: botId,
      nomeBot: nomeBot,
      contagem: 1,
      ultimoAcesso: acesso.acessoEm
    });
  }
  
  console.log('[Servidor] Dados de ranking atualizados:', dadosRankingVitrine);
  res.status(201).json({ message: `Acesso ao bot ${nomeBot} registrado para ranking.` });
});

// Endpoint para visualizar ranking
app.get('/api/ranking/visualizar', (req, res) => {
  const rankingOrdenado = [...dadosRankingVitrine].sort((a, b) => b.contagem - a.contagem);
  res.json(rankingOrdenado);
});

// Endpoint de status (para verificar conectividade)
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    databases: {
      logs: dbLogs ? 'conectado' : 'desconectado',
      historico: dbHistoria ? 'conectado' : 'desconectado'
    }
  });
});

// Função para iniciar o servidor com tratamento de erro de porta
function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📊 Status dos bancos:`);
    console.log(`   - Logs: ${dbLogs ? '✅ Conectado' : '❌ Desconectado'}`);
    console.log(`   - Histórico: ${dbHistoria ? '✅ Conectado' : '❌ Desconectado'}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Porta ${PORT} já está em uso!`);
      console.log('💡 Soluções possíveis:');
      console.log(`   1. Use uma porta diferente: PORT=3005 npm start`);
      console.log(`   2. Finalize o processo que está usando a porta ${PORT}`);
      console.log(`   3. No Windows: netstat -ano | findstr :${PORT}`);
      console.log(`   4. No Linux/Mac: lsof -ti:${PORT} | xargs kill -9`);
      
      // Tenta uma porta alternativa automaticamente
      const alternativePort = PORT + 1;
      console.log(`🔄 Tentando porta alternativa: ${alternativePort}`);
      
      setTimeout(() => {
        const alternativeServer = app.listen(alternativePort, () => {
          console.log(`🚀 Servidor iniciado na porta alternativa: http://localhost:${alternativePort}`);
        });
        
        alternativeServer.on('error', (altErr) => {
          console.error(`❌ Erro na porta alternativa ${alternativePort}:`, altErr.message);
          process.exit(1);
        });
      }, 1000);
    } else {
      console.error('❌ Erro ao iniciar servidor:', err);
      process.exit(1);
    }
  });
}

// Inicia o servidor
startServer();