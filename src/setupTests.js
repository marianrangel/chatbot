// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
const sendMessage = async (userMessage) => {
    const chatContainer = document.getElementById('chat-container'); // Contêiner do chat
    const sendButton = document.getElementById('send-button'); // Botão de enviar
  
    // Adiciona a mensagem do usuário na interface
    const userMessageElement = document.createElement('div');
    userMessageElement.className = 'user-message';
    userMessageElement.textContent = userMessage;
    chatContainer.appendChild(userMessageElement);
  
    // Adiciona os três pontinhos animados "Bot está digitando..."
    const typingMessageElement = document.createElement('div');
    typingMessageElement.className = 'bot-typing';
    typingMessageElement.innerHTML = `
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
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
  
      // Remove os três pontinhos animados
      typingMessageElement.remove();
  
      // Adiciona a resposta do bot na interface
      const botMessageElement = document.createElement('div');
      botMessageElement.className = 'bot-message';
      botMessageElement.textContent = botResponse;
      chatContainer.appendChild(botMessageElement);
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
  
      // Substitui os três pontinhos animados por uma mensagem de erro
      typingMessageElement.textContent = 'Erro ao obter resposta do bot.';
      typingMessageElement.style.color = 'red'; // Estiliza a mensagem de erro
    } finally {
      // Reabilita o botão de enviar
      sendButton.disabled = false;
      sendButton.textContent = 'Enviar';
    }
  };
