// client.js - Frontend com salvamento de histórico

// Configurações globais
const backendUrl = 'https://chat-back-end-2.onrender.com'; // Corrigido para sempre usar o backend do Render
let chatHistory = [];

// Variáveis para controle de sessão
let currentSessionId = `sessao_${Date.now()}_${Math.random().toString(36).substring(7)}`;
let chatStartTime = new Date();
let messageCount = 0;

// Função para obter IP do usuário (simplificada)
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

// Função para registrar conexão do usuário (mantida do código original)
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

// NOVA FUNÇÃO: Salvar histórico completo da sessão
async function salvarHistoricoSessao(sessionId, botId, startTime, endTime, messages) {
  try {
    // Só salva se houver mensagens
    if (!messages || messages.length === 0) {
      console.log('📝 Nenhuma mensagem para salvar no histórico');
      return;
    }

    const payload = {
      sessionId,
      botId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      messages // O array chatHistory completo
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
      console.log(`💾 ${result.message} (${result.totalMessages} mensagens)`);
    }
  } catch (error) {
    console.error("❌ Erro ao enviar histórico de sessão:", error);
  }
}

// Função principal para enviar mensagem (adaptada)
async function enviarMensagem() {
  const inputUsuario = document.getElementById('userInput');
  const mensagem = inputUsuario.value.trim();

  if (!mensagem) return;

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
      throw new Error(`Erro na requisição: ${response.status}`);
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

    // NOVO: Salva o histórico após cada interação
    await salvarHistoricoSessao(
      currentSessionId, 
      "chatbotPrincipalIFCODE", 
      chatStartTime, 
      new Date(), 
      chatHistory
    );

    console.log(`💬 Mensagem ${messageCount} processada. Histórico atualizado.`);

  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    exibirMensagemBot('Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.');
  }
}

// Função para exibir mensagem do usuário
function exibirMensagemUsuario(mensagem) {
  const chatContainer = document.getElementById('chat-container');
  const mensagemDiv = document.createElement('div');
  mensagemDiv.className = 'mensagem usuario';
  mensagemDiv.innerHTML = `
    <div class="conteudo-mensagem">
      <strong>Você:</strong> ${escapeHtml(mensagem)}
    </div>
    <div class="timestamp">${new Date().toLocaleTimeString()}</div>
  `;
  chatContainer.appendChild(mensagemDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Função para exibir mensagem do bot
function exibirMensagemBot(mensagem) {
  const chatContainer = document.getElementById('chat-container');
  const mensagemDiv = document.createElement('div');
  mensagemDiv.className = 'mensagem bot';
  mensagemDiv.innerHTML = `
    <div class="conteudo-mensagem">
      <strong>Bot:</strong> ${escapeHtml(mensagem)}
    </div>
    <div class="timestamp">${new Date().toLocaleTimeString()}</div>
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

// NOVA FUNÇÃO: Limpar chat e iniciar nova sessão
function limparChat() {
  // Salva o histórico atual antes de limpar (se houver mensagens)
  if (chatHistory.length > 0) {
    salvarHistoricoSessao(
      currentSessionId, 
      "chatbotPrincipalIFCODE", 
      chatStartTime, 
      new Date(), 
      chatHistory
    );
  }

  // Limpa a interface
  const chatContainer = document.getElementById('chat-container');
  chatContainer.innerHTML = '';

  // Reinicia as variáveis de sessão
  chatHistory = [];
  currentSessionId = `sessao_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  chatStartTime = new Date();
  messageCount = 0;

  console.log(`🔄 Nova sessão iniciada: ${currentSessionId}`);
  exibirMensagemBot('Olá! Como posso ajudá-lo hoje?');
}

// NOVA FUNÇÃO: Salvar histórico manualmente
async function salvarHistoricoManual() {
  if (chatHistory.length === 0) {
    alert('Nenhum histórico para salvar!');
    return;
  }

  await salvarHistoricoSessao(
    currentSessionId, 
    "chatbotPrincipalIFCODE", 
    chatStartTime, 
    new Date(), 
    chatHistory
  );
  
  alert(`Histórico salvo! SessionID: ${currentSessionId}`);
}

// NOVA FUNÇÃO: Buscar históricos de conversas antigas
async function buscarHistoricosAntigos() {
  try {
    const response = await fetch(`${backendUrl}/api/chat/historicos`);
    if (!response.ok) throw new Error('Erro ao buscar históricos');
    const historicos = await response.json();
    return historicos;
  } catch (error) {
    console.error('Erro ao buscar históricos:', error);
    return [];
  }
}

// NOVA FUNÇÃO: Exibir menu de históricos na interface
async function exibirMenuHistoricos() {
  const historicos = await buscarHistoricosAntigos();
  const chatContainer = document.getElementById('chat-container');
  let menu = document.getElementById('menu-historicos');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'menu-historicos';
    menu.style.background = '#fff';
    menu.style.border = '1px solid #ccc';
    menu.style.padding = '10px';
    menu.style.maxHeight = '300px';
    menu.style.overflowY = 'auto';
    menu.style.position = 'absolute';
    menu.style.zIndex = '10';
    menu.style.top = '10px';
    menu.style.right = '10px';
    chatContainer.appendChild(menu);
  }
  menu.innerHTML = `<h3>Históricos de Conversas</h3>`;
  if (historicos.length === 0) {
    menu.innerHTML += '<p>Nenhum histórico encontrado.</p>';
  } else {
    menu.innerHTML += '<ul style="list-style:none;padding:0;">' +
      historicos.map(h => `<li style='margin-bottom:8px;'><button style='width:100%' onclick='carregarHistoricoAntigo("${h.sessionId}")'>${h.sessionId}<br><small>${new Date(h.startTime).toLocaleString('pt-BR')}</small></button></li>`).join('') + '</ul>';
  }
  menu.innerHTML += `<button onclick='fecharMenuHistoricos()' style='margin-top:10px;'>Fechar</button>`;
}

// NOVA FUNÇÃO: Carregar histórico antigo na interface
async function carregarHistoricoAntigo(sessionId) {
  try {
    const response = await fetch(`${backendUrl}/api/chat/historicos/${sessionId}`);
    if (!response.ok) throw new Error('Erro ao buscar histórico');
    const historico = await response.json();
    const chatContainer = document.getElementById('chat-container');
    chatContainer.innerHTML = `<h4>Histórico: ${historico.sessionId}</h4>`;
    historico.messages.forEach(msg => {
      const div = document.createElement('div');
      div.className = 'mensagem ' + (msg.role === 'user' ? 'usuario' : 'bot');
      div.innerHTML = `<div class='conteudo-mensagem'><strong>${msg.role === 'user' ? 'Você' : 'Bot'}:</strong> ${escapeHtml(msg.content || msg.parts?.[0]?.text)}</div>`;
      chatContainer.appendChild(div);
    });
    chatContainer.innerHTML += `<button onclick='fecharMenuHistoricos()' style='margin-top:10px;'>Fechar Histórico</button>`;
  } catch (error) {
    alert('Erro ao carregar histórico!');
  }
}

// NOVA FUNÇÃO: Fechar menu de históricos
function fecharMenuHistoricos() {
  const menu = document.getElementById('menu-historicos');
  if (menu) menu.remove();
  // Opcional: pode recarregar o chat atual aqui se quiser
}

// Adiciona botão para abrir o menu de históricos
function adicionarBotaoHistoricos() {
  const chatContainer = document.getElementById('chat-container');
  let btn = document.getElementById('btn-historicos');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'btn-historicos';
    btn.textContent = '📜 Históricos';
    btn.style.position = 'absolute';
    btn.style.top = '10px';
    btn.style.left = '10px';
    btn.style.zIndex = '20';
    btn.onclick = exibirMenuHistoricos;
    chatContainer.appendChild(btn);
  }
}

// Corrige escopo global para funções usadas em onclick
window.carregarHistoricoAntigo = carregarHistoricoAntigo;
window.fecharMenuHistoricos = fecharMenuHistoricos;

// Event listeners quando a página carrega
document.addEventListener('DOMContentLoaded', function() {
  // Registra o acesso do usuário
  registrarConexaoUsuario();

  // Configura o event listener para o Enter no input
  const userInput = document.getElementById('userInput');
  if (userInput) {
    userInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        enviarMensagem();
      }
    });
  }

  // Configura botão de enviar
  const sendButton = document.getElementById('sendButton');
  if (sendButton) {
    sendButton.addEventListener('click', enviarMensagem);
  }

  // Configura botão de limpar chat (se existir)
  const clearButton = document.getElementById('clearButton');
  if (clearButton) {
    clearButton.addEventListener('click', limparChat);
  }

  // Configura botão de salvar histórico (se existir)
  const saveButton = document.getElementById('saveHistoryButton');
  if (saveButton) {
    saveButton.addEventListener('click', salvarHistoricoManual);
  }

  // Salva histórico automaticamente antes de sair da página
  window.addEventListener('beforeunload', function() {
    if (chatHistory.length > 0) {
      // Usa sendBeacon para garantir que a requisição seja enviada
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
  exibirMensagemBot('Olá! Como posso ajudá-lo hoje?');
  
  console.log(`🎯 Sistema iniciado. SessionID: ${currentSessionId}`);
  adicionarBotaoHistoricos();
});