// Backend (Node.js com Express)
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(express.json()); // Middleware para processar JSON no corpo da requisição

// Endpoint /chat
app.post('/chat', async (req, res) => {
  const mensagemUsuario = req.body.mensagem;
  const historicoRecebido = req.body.historico || []; // Garante que seja um array

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Inicia o chat com o histórico recebido
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

    // Cria o novo histórico para enviar de volta
    const novoHistorico = [
      ...historicoRecebido,
      { role: "user", parts: [{ text: mensagemUsuario }] },
      { role: "model", parts: [{ text: textoResposta }] }
    ];

    res.json({ resposta: textoResposta, historico: novoHistorico });
  } catch (error) {
    console.error("Erro ao chamar API Gemini:", error);
    res.status(500).json({ erro: "Desculpe, não consegui processar sua mensagem agora." });
  }
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

// Frontend (Função sendMessage)
let chatHistory = []; // Variável para armazenar o histórico da conversa

const sendMessage = async (userMessage) => {
  const chatContainer = document.getElementById('chat-container'); // Contêiner do chat
  const sendButton = document.getElementById('send-button'); // Botão de enviar

  // Adiciona a mensagem do usuário na interface
  const userMessageElement = document.createElement('div');
  userMessageElement.className = 'user-message';
  userMessageElement.textContent = userMessage;
  chatContainer.appendChild(userMessageElement);

  // Adiciona a mensagem temporária "Bot está digitando..."
  const typingMessageElement = document.createElement('div');
  typingMessageElement.className = 'bot-typing';
  typingMessageElement.textContent = 'Bot está digitando...';
  chatContainer.appendChild(typingMessageElement);

  // Desabilita o botão de enviar
  sendButton.disabled = true;
  sendButton.textContent = 'Aguarde...';

  try {
    // Envia a mensagem do usuário e o histórico atual para o backend
    const response = await fetch('http://localhost:3001/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem: userMessage, historico: chatHistory })
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    const botResponse = data.resposta;

    // Atualiza o histórico local com o recebido do backend
    chatHistory = data.historico;

    // Remove a mensagem "Bot está digitando..."
    typingMessageElement.remove();

    // Adiciona a resposta do bot na interface
    const botMessageElement = document.createElement('div');
    botMessageElement.className = 'bot-message';
    botMessageElement.textContent = botResponse;
    chatContainer.appendChild(botMessageElement);
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);

    // Remove a mensagem "Bot está digitando..." em caso de erro
    typingMessageElement.textContent = 'Erro ao obter resposta do bot.';
    typingMessageElement.style.color = 'red'; // Estiliza a mensagem de erro
  } finally {
    // Reabilita o botão de enviar
    sendButton.disabled = false;
    sendButton.textContent = 'Enviar';
  }
};

// Exemplo de uso
document.getElementById('send-button').addEventListener('click', () => {
  const inputField = document.getElementById('input-field');
  const userMessage = inputField.value.trim();

  if (userMessage) {
    sendMessage(userMessage);
    inputField.value = ''; // Limpa o campo de entrada
  }
});