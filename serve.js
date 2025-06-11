// server.js
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
