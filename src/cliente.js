let chatHistory = [];

/**
 * Função para verificar se a mensagem contém perguntas sobre data/hora
 * @param {string} message - Mensagem para verificar
 * @returns {boolean} - Verdadeiro se for uma pergunta de data/hora
 */
const isDateTimeQuestion = (message) => {
  const dateTimeRegex = /que (dia|data|horas?|horário|hora|mes|mês|ano) (é|são|estamos|temos)/i;
  const dateRegex = /(data|dia|mês|mes|ano|hora|horas|horário)/i;
  const questionRegex = /(qual|que|me\s+diga|me\s+fala|poderia|pode|sabe)/i;
  
  return (
    dateTimeRegex.test(message) || 
    (dateRegex.test(message) && questionRegex.test(message)) ||
    message.includes("que horas são") ||
    message.includes("data de hoje") ||
    message.includes("dia de hoje") ||
    message.includes("dia é hoje")
  );
};

/**
 * Função para gerar resposta de data/hora
 * @returns {string} - Resposta formatada com data e hora atuais
 */
const generateDateTimeResponse = () => {
  const now = new Date();
  
  // Formatação para português brasileiro
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
  
  const dateStr = formatter.format(now);
  
  // Criando uma resposta mais natural
  return `Agora são ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} do dia ${now.getDate()} de ${getMonthName(now.getMonth())} de ${now.getFullYear()}, ${getWeekdayName(now.getDay())}. (${dateStr})`;
};

/**
 * Função auxiliar para obter o nome do mês em português
 * @param {number} monthIndex - Índice do mês (0-11)
 * @returns {string} - Nome do mês em português
 */
const getMonthName = (monthIndex) => {
  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 
    'maio', 'junho', 'julho', 'agosto', 
    'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  return months[monthIndex];
};

/**
 * Função auxiliar para obter o nome do dia da semana em português
 * @param {number} dayIndex - Índice do dia (0-6)
 * @returns {string} - Nome do dia da semana em português
 */
const getWeekdayName = (dayIndex) => {
  const weekdays = [
    'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 
    'quinta-feira', 'sexta-feira', 'sábado'
  ];
  return weekdays[dayIndex];
};

/**
 * Função principal para enviar mensagem do usuário e receber resposta do bot
 * @param {string} userMessage - Mensagem digitada pelo usuário
 */
const sendMessage = async (userMessage) => {
  const chatContainer = document.getElementById('chat-container'); // Contêiner do chat
  const sendButton = document.getElementById('send-button'); // Botão de enviar
  const inputField = document.getElementById('input-field'); // Campo de entrada

  // Adiciona a mensagem do usuário na interface
  const userMessageElement = document.createElement('div');
  userMessageElement.className = 'user-message';
  userMessageElement.textContent = userMessage;
  chatContainer.appendChild(userMessageElement);

  // Cria o elemento de indicador de digitação (três pontinhos)
  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'typing-indicator';
  
  // Cria os três pontos da animação
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('span');
    dot.className = 'typing-dot';
    dot.textContent = '•';
    typingIndicator.appendChild(dot);
  }
  
  // Adiciona o indicador de digitação ao chat
  const typingContainer = document.createElement('div');
  typingContainer.className = 'bot-typing';
  typingContainer.appendChild(typingIndicator);
  chatContainer.appendChild(typingContainer);

  // Desabilita o botão de enviar e o campo de entrada durante o processamento
  sendButton.disabled = true;
  sendButton.textContent = 'Aguarde...';
  inputField.disabled = true;

  // Rola para o final do chat
  chatContainer.scrollTop = chatContainer.scrollHeight;

  try {
    // Verificar se é uma pergunta sobre data/hora
    if (isDateTimeQuestion(userMessage)) {
      // Se for pergunta sobre data/hora, gerar resposta local
      const dateTimeResponse = generateDateTimeResponse();
      
      // Simula um pequeno atraso para parecer mais natural
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Remove o indicador de digitação
      typingContainer.remove();
      
      // Adiciona a resposta do bot na interface
      const botMessageElement = document.createElement('div');
      botMessageElement.className = 'bot-message';
      botMessageElement.textContent = dateTimeResponse;
      chatContainer.appendChild(botMessageElement);
      
      // Adiciona ao histórico do chat
      chatHistory.push({ role: 'user', content: userMessage });
      chatHistory.push({ role: 'bot', content: dateTimeResponse });
    } else {
      // Envia a mensagem do usuário e o histórico atual para o backend
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: userMessage, historico: chatHistory })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.erro || "Erro desconhecido no servidor.");
      }

      const data = await response.json();
      const botResponse = data.resposta;

      // Atualiza o histórico local com o recebido do backend
      chatHistory = data.historico;

      // Remove o indicador de digitação
      typingContainer.remove();

      // Adiciona a resposta do bot na interface
      const botMessageElement = document.createElement('div');
      botMessageElement.className = 'bot-message';
      botMessageElement.textContent = botResponse;
      chatContainer.appendChild(botMessageElement);
    }
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);

    // Substitui o indicador de digitação por uma mensagem de erro
    typingContainer.innerHTML = '';
    typingContainer.className = 'error-message';
    typingContainer.textContent = 'Oops! Algo deu errado. Tente novamente.';
    typingContainer.style.color = 'red';
  } finally {
    // Reabilita o botão de enviar e o campo de entrada
    sendButton.disabled = false;
    sendButton.textContent = 'Enviar';
    inputField.disabled = false;
    inputField.focus();

    // Rola para o final do chat novamente após adicionar todas as mensagens
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
};

/**
 * Função auxiliar para mostrar mensagens na interface do usuário
 * @param {string} role - Papel da mensagem (user, bot, error)
 * @param {string} message - Conteúdo da mensagem
 */
function mostrarMensagemNaUI(role, message) {
  const chatContainer = document.getElementById('chat-container');
  const messageElement = document.createElement('div');
  
  // Define a classe baseada no papel da mensagem
  switch(role) {
    case 'user':
      messageElement.className = 'user-message';
      break;
    case 'bot':
      messageElement.className = 'bot-message';
      break;
    case 'error':
      messageElement.className = 'error-message';
      messageElement.style.color = 'red';
      break;
    default:
      messageElement.className = 'system-message';
  }
  
  messageElement.textContent = message;
  chatContainer.appendChild(messageElement);
  
  // Rola para o final do chat
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Função para limpar o histórico do chat
 */
function limparHistorico() {
  chatHistory = [];
  const chatContainer = document.getElementById('chat-container');
  chatContainer.innerHTML = '';
  
  // Adiciona mensagem de sistema informando que o histórico foi limpo
  mostrarMensagemNaUI('system', 'Histórico de conversa limpo.');
}

/**
 * Adiciona o CSS para a animação dos três pontinhos
 */
function adicionarCSS() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .typing-indicator {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .typing-dot {
      font-size: 24px;
      line-height: 10px;
      animation: typingAnimation 1.2s infinite;
      opacity: 0.7;
    }
    
    .typing-dot:nth-child(1) { animation-delay: 0s; }
    .typing-dot:nth-child(2) { animation-delay: 0.4s; }
    .typing-dot:nth-child(3) { animation-delay: 0.8s; }
    
    @keyframes typingAnimation {
      0%, 100% { opacity: 0.7; transform: translateY(0); }
      50% { opacity: 1; transform: translateY(-5px); }
    }
  `;
  document.head.appendChild(styleElement);
}

// Inicialização da página
document.addEventListener('DOMContentLoaded', () => {
  // Adiciona o CSS para a animação dos três pontinhos
  adicionarCSS();
  
  // Configuração dos event listeners
  const sendButton = document.getElementById('send-button');
  const inputField = document.getElementById('input-field');
  const clearButton = document.getElementById('clear-button'); // Se existir

  // Event listener para o botão de enviar
  sendButton.addEventListener('click', () => {
    const userMessage = inputField.value.trim();
    if (userMessage) {
      sendMessage(userMessage);
      inputField.value = ''; // Limpa o campo de entrada
    }
  });

  // Event listener para tecla Enter no campo de entrada
  inputField.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      const userMessage = inputField.value.trim();
      if (userMessage) {
        sendMessage(userMessage);
        inputField.value = ''; // Limpa o campo de entrada
        event.preventDefault(); // Evita que o Enter crie uma nova linha
      }
    }
  });

  // Event listener para o botão de limpar (se existir)
  if (clearButton) {
    clearButton.addEventListener('click', limparHistorico);
  }

  // Mensagem de boas-vindas (opcional)
  mostrarMensagemNaUI('bot', 'Olá! Como posso ajudar você hoje? Você pode me perguntar a data e hora atuais quando quiser.');
});