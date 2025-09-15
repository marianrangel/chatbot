// client.js - Frontend corrigido

// Configurações globais
const backendUrl = 'https://chat-back-end-2.onrender.com';
let chatHistory = [];

// Variáveis para controle de sessão
let currentSessionId = `sessao_${Date.now()}_${Math.random().toString(36).substring(7)}`;
let chatStartTime = new Date();
let messageCount = 0;

// Função para obter IP do usuário
async function obterIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.warn('Não foi possível obter IP:', error);
    return 'IP_DESCONHECIDO';
  }
}

// Função para registrar conexão do usuário
async function registrarConexaoUsuario() {
  try {
    const userIP = await obterIP();
    const logData = {
      ip: userIP,
      acao: 'ACESSO_CHATBOT',
      nomeBot: 'ChatBot-Principal-IFCODE'
    };

    const response = await fetch(`${backendUrl}/api/log-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData)
    });

    if (response.ok) {
      console.log('✅ Conexão de usuário registrada no log compartilhado');
    } else {
      console.warn('⚠️ Falha ao registrar conexão:', response.statusText);
    }
  } catch (error) {
    console.error('Erro ao registrar conexão:', error);
  }
}

// Salvar histórico completo da sessão
async function salvarHistoricoSessao(sessionId, botId, startTime, endTime, messages) {
  try {
    if (!messages || messages.length === 0) {
      console.log('📝 Nenhuma mensagem para salvar no histórico');
      return;
    }

    const payload = {
      sessionId,
      botId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      messages
    };

    const response = await fetch(`${backendUrl}/api/chat/salvar-historico`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ Falha ao salvar histórico:", errorData.error || response.statusText);
    } else {
      const result = await response.json();
      console.log(`💾 ${result.message} (${messages.length} mensagens)`);
    }
  } catch (error) {
    console.error("❌ Erro ao enviar histórico de sessão:", error);
  }
}

// Função principal para enviar mensagem
async function enviarMensagem() {
  const inputUsuario = document.getElementById('userInput');
  const sendButton = document.getElementById('sendButton');
  
  if (!inputUsuario) {
    console.error('❌ Elemento userInput não encontrado!');
    return;
  }
  
  const mensagem = inputUsuario.value.trim();
  if (!mensagem) return;

  // Desabilita input durante o envio
  inputUsuario.disabled = true;
  if (sendButton) sendButton.disabled = true;

  // Limpa o input e mostra a mensagem do usuário
  inputUsuario.value = '';
  exibirMensagemUsuario(mensagem);

  try {
    // Faz a requisição para o chatbot
    const response = await fetch(`${backendUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mensagem: mensagem,
        historico: chatHistory
      })
    });

    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.erro) {
      throw new Error(data.erro);
    }

    // Atualiza o histórico local
    chatHistory = data.historico;
    messageCount++;

    // Exibe a resposta do bot
    exibirMensagemBot(data.resposta);

    // Salva o histórico após cada interação
    await salvarHistoricoSessao(
      currentSessionId, 
      "chatbotPrincipalIFCODE", 
      chatStartTime, 
      new Date(), 
      chatHistory
    );

    console.log(`💬 Mensagem ${messageCount} processada. Histórico atualizado.`);

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    exibirMensagemBot(`Erro: ${error.message}. Verifique se o servidor está online.`);
  } finally {
    // Reabilita input
    inputUsuario.disabled = false;
    if (sendButton) sendButton.disabled = false;
    inputUsuario.focus();
  }
}

// Função para exibir mensagem do usuário
function exibirMensagemUsuario(mensagem) {
  const chatContainer = document.getElementById('chat-container');
  if (!chatContainer) {
    console.error('❌ Elemento chat-container não encontrado!');
    return;
  }

  const mensagemDiv = document.createElement('div');
  mensagemDiv.className = 'mensagem usuario';
  mensagemDiv.innerHTML = `
    <div class="conteudo-mensagem">
      <strong>Você:</strong> ${escapeHtml(mensagem)}
    </div>
    <div class="timestamp">${new Date().toLocaleTimeString('pt-BR')}</div>
  `;
  chatContainer.appendChild(mensagemDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Função para exibir mensagem do bot
function exibirMensagemBot(mensagem) {
  const chatContainer = document.getElementById('chat-container');
  if (!chatContainer) {
    console.error('❌ Elemento chat-container não encontrado!');
    return;
  }

  const mensagemDiv = document.createElement('div');
  mensagemDiv.className = 'mensagem bot';
  mensagemDiv.innerHTML = `
    <div class="conteudo-mensagem">
      <strong>Bot:</strong> ${escapeHtml(mensagem)}
    </div>
    <div class="timestamp">${new Date().toLocaleTimeString('pt-BR')}</div>
  `;
  chatContainer.appendChild(mensagemDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Função utilitária para escapar HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Limpar chat e iniciar nova sessão
function limparChat() {
  if (chatHistory.length > 0) {
    salvarHistoricoSessao(
      currentSessionId, 
      "chatbotPrincipalIFCODE", 
      chatStartTime, 
      new Date(), 
      chatHistory
    );
  }

  const chatContainer = document.getElementById('chat-container');
  if (chatContainer) {
    chatContainer.innerHTML = '';
  }

  chatHistory = [];
  currentSessionId = `sessao_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  chatStartTime = new Date();
  messageCount = 0;

  console.log(`🔄 Nova sessão iniciada: ${currentSessionId}`);
  exibirMensagemBot('Olá! Como posso ajudá-lo hoje?');
}

// Event listeners quando a página carrega
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Sistema carregando...');
  
  // Verifica se os elementos existem
  const userInput = document.getElementById('userInput');
  const sendButton = document.getElementById('sendButton');
  const chatContainer = document.getElementById('chat-container');

  if (!userInput) {
    console.error('❌ ERRO: Elemento userInput não encontrado! Verifique o HTML.');
    return;
  }

  if (!chatContainer) {
    console.error('❌ ERRO: Elemento chat-container não encontrado! Verifique o HTML.');
    return;
  }

  // Registra o acesso do usuário
  registrarConexaoUsuario();

  // Configura o event listener para o Enter no input
  userInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  });

  // Configura botão de enviar
  if (sendButton) {
    sendButton.addEventListener('click', (e) => {
      e.preventDefault();
      enviarMensagem();
    });
  } else {
    console.warn('⚠️ Botão sendButton não encontrado');
  }

  // Configura botão de limpar chat (se existir)
  const clearButton = document.getElementById('clearButton');
  if (clearButton) {
    clearButton.addEventListener('click', limparChat);
  }

  // Salva histórico automaticamente antes de sair da página
  window.addEventListener('beforeunload', function() {
    if (chatHistory.length > 0) {
      const payload = JSON.stringify({
        sessionId: currentSessionId,
        botId: "chatbotPrincipalIFCODE",
        startTime: chatStartTime.toISOString(),
        endTime: new Date().toISOString(),
        messages: chatHistory
      });
      
      navigator.sendBeacon(`${backendUrl}/api/chat/salvar-historico`, payload);
    }
  });

  // Mensagem inicial do bot
  setTimeout(() => {
    exibirMensagemBot('Olá! Como posso ajudá-lo hoje?');
  }, 1000);
  
  console.log(`🎯 Sistema iniciado. SessionID: ${currentSessionId}`);
});

// Expõe funções globais
window.enviarMensagem = enviarMensagem;
window.limparChat = limparChat;