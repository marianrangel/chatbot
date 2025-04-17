// App.js
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import './App.css';


// Configuração da API
const genAI = new GoogleGenerativeAI("AIzaSyAHqN0QsXXpsbF2zYbALEjCbp7c05lv-6o");

function App() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Rolagem automática para a última mensagem
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Ajusta a altura do textarea dinamicamente
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [prompt]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const userMessage = prompt;
    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
    setPrompt('');
    setLoading(true);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(userMessage);
      const text = await result.response.text();
      setMessages(prev => [...prev, { text: text, sender: 'bot' }]);
    } catch (error) {
      console.error("Erro ao gerar resposta:", error);
      setMessages(prev => [...prev, { 
        text: "Ocorreu um erro. Verifique sua chave de API e conexão.", 
        sender: 'bot', 
        error: true 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.body.classList.toggle('dark-mode');
  };

  // Permite enviar mensagem com Enter (Shift+Enter para quebra de linha)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={`chat-container ${darkMode ? 'dark-mode' : ''}`}>
      {/* Header */}
      <header className="chat-header">
        <div className="header-title">
          <span className="sparkle-icon">✨</span>
          <h1>Chatbot de Autocuidado</h1>
        </div>
        <div className="header-controls">
          <button onClick={startNewChat} className="new-chat-btn">
            <span className="plus-icon">+</span>
            <span className="btn-text">Nova Conversa</span>
          </button>
          <button onClick={toggleDarkMode} className="theme-toggle-btn">
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Chat area */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="welcome-container">
            <div className="welcome-icon">✨</div>
            <h2>Bem-vindo ao Chatbot de Autocuidado</h2>
            <p>Estou aqui para conversar sobre bem-estar, oferecer dicas para relaxar e ajudar nas suas rotinas de autocuidado!</p>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((msg, index) => (
              <div 
                key={index}
                className={`message-wrapper ${msg.sender === 'user' ? 'user-message' : 'bot-message'}`}
              >
                <div className={`message ${msg.error ? 'error-message' : ''}`}>
                  <p>{msg.text}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="chat-input-container">
        <form onSubmit={handleSubmit} className="input-form">
          <div className="textarea-container">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              rows={1}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || !prompt.trim()} 
            className={`send-button ${(loading || !prompt.trim()) ? 'disabled' : ''}`}
          >
            {loading ? (
              <div className="loading-spinner"></div>
            ) : (
              <span className="send-icon">➤</span>
            )}
          </button>
        </form>
        <p className="input-tip">
          Pressione Enter para enviar. Shift+Enter para quebra de linha.
        </p>
      </div>
    </div>
  );
}

export default App; 