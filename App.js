// App.js - Corrigido para usar o backend
import React, { useState, useRef, useEffect } from 'react';
import './App.css';

// Configuração do backend
const backendUrl = 'https://chat-back-end-2.onrender.com';

function App() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [historicos, setHistoricos] = useState([]);
  const [showHistoricos, setShowHistoricos] = useState(false);
  const [selectedHistorico, setSelectedHistorico] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Variáveis de sessão
  const [sessionId] = useState(`sessao_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  const [startTime] = useState(new Date());

  // Rolagem automática
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Ajusta altura do textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [prompt]);

  // Registrar acesso do usuário
  useEffect(() => {
    const registrarAcesso = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const { ip } = await response.json();
        
        await fetch(`${backendUrl}/api/log-connection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ip,
            acao: 'ACESSO_CHATBOT',
            nomeBot: 'ChatBot-Principal-IFCODE'
          })
        });
      } catch (error) {
        console.error('Erro ao registrar acesso:', error);
      }
    };
    
    registrarAcesso();
  }, []);

  // Salvar histórico no backend
  const salvarHistorico = async (messagesArray) => {
    try {
      await fetch(`${backendUrl}/api/chat/salvar-historico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          botId: "chatbotPrincipalIFCODE",
          startTime: startTime.toISOString(),
          endTime: new Date().toISOString(),
          messages: messagesArray
        })
      });
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }
  };

  // Função principal de envio
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userMessage = prompt;
    setPrompt('');
    
    // Adiciona mensagem do usuário na interface
    const newMessages = [...messages, { text: userMessage, sender: 'user' }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Envia para o backend
      const response = await fetch(`${backendUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem: userMessage,
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

      // Atualiza histórico e interface
      setChatHistory(data.historico);
      const finalMessages = [...newMessages, { text: data.resposta, sender: 'bot' }];
      setMessages(finalMessages);

      // Salva histórico
      await salvarHistorico(data.historico);

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setMessages(prev => [...prev, { 
        text: 'Desculpe, ocorreu um erro ao processar sua mensagem. Verifique se o servidor está online.', 
        sender: 'bot', 
        error: true 
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Buscar históricos
  const fetchHistoricos = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/chat/historicos`);
      const data = await response.json();
      setHistoricos(data.sessoes || []);
    } catch (error) {
      console.error('Erro ao buscar históricos:', error);
      setHistoricos([]);
    }
  };

  // Buscar detalhes de histórico
  const fetchHistoricoDetalhe = async (sessionId) => {
    try {
      const response = await fetch(`${backendUrl}/api/chat/historicos/${sessionId}`);
      const data = await response.json();
      setSelectedHistorico(data);
    } catch (error) {
      console.error('Erro ao buscar detalhe:', error);
      setSelectedHistorico(null);
    }
  };

  const startNewChat = () => {
    // Salva histórico atual antes de limpar
    if (chatHistory.length > 0) {
      salvarHistorico(chatHistory);
    }
    setMessages([]);
    setChatHistory([]);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.body.classList.toggle('dark-mode');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={`chat-container ${darkMode ? 'dark-mode' : ''}`}>
      {/* Menu de Históricos */}
      <button 
        onClick={() => { 
          setShowHistoricos(!showHistoricos); 
          if (!showHistoricos) fetchHistoricos(); 
        }} 
        className="new-chat-btn" 
        style={{margin:'10px'}}
      >
        📜 Históricos
      </button>

      {showHistoricos && (
        <div className="historicos-menu" style={{
          background: '#fff',
          border: '1px solid #ccc',
          padding: '10px',
          maxHeight: '300px',
          overflowY: 'auto',
          position: 'absolute',
          zIndex: 10,
          top: '60px',
          right: '10px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3>Conversas Antigas</h3>
          {historicos.length === 0 && <p>Nenhum histórico encontrado.</p>}
          <ul style={{listStyle:'none', padding:0}}>
            {historicos.map(h => (
              <li key={h.sessionId} style={{marginBottom:'8px'}}>
                <button 
                  style={{width:'100%', padding:'8px', borderRadius:'4px'}} 
                  onClick={() => fetchHistoricoDetalhe(h.sessionId)}
                >
                  {h.sessionId.substring(0, 20)}... <br/>
                  <small>{new Date(h.startTime).toLocaleString('pt-BR')}</small>
                </button>
              </li>
            ))}
          </ul>
          <button 
            onClick={() => { 
              setShowHistoricos(false); 
              setSelectedHistorico(null); 
            }} 
            style={{marginTop:'10px', width:'100%'}}
          >
            Fechar
          </button>
        </div>
      )}

      {selectedHistorico && (
        <div className="historico-detalhe" style={{
          background: '#f9f9f9',
          border: '1px solid #aaa',
          padding: '10px',
          margin: '10px 0',
          borderRadius: '8px',
          maxHeight: '400px',
          overflow: 'hidden'
        }}>
          <h4>Histórico: {selectedHistorico.sessionId?.substring(0, 30)}...</h4>
          <p><b>Início:</b> {selectedHistorico.estatisticas?.dataFormatada}</p>
          <p><b>Duração:</b> {selectedHistorico.estatisticas?.duracaoMinutos} min</p>
          <p><b>Total:</b> {selectedHistorico.estatisticas?.totalMensagens} mensagens</p>
          
          <div style={{
            maxHeight: '200px',
            overflowY: 'auto',
            background: '#fff',
            padding: '8px',
            border: '1px solid #eee',
            borderRadius: '4px'
          }}>
            {selectedHistorico.messages?.map((msg, idx) => (
              <div key={idx} style={{marginBottom:'6px', padding:'4px', borderBottom:'1px solid #f0f0f0'}}>
                <b>{msg.role === 'user' ? 'Você' : 'Bot'}:</b> 
                <span style={{marginLeft:'8px'}}>
                  {(msg.content || msg.parts?.[0]?.text || '').substring(0, 100)}
                  {(msg.content || msg.parts?.[0]?.text || '').length > 100 ? '...' : ''}
                </span>
              </div>
            ))}
          </div>
          <button 
            onClick={() => setSelectedHistorico(null)} 
            style={{marginTop:'10px', width:'100%'}}
          >
            Fechar Detalhes
          </button>
        </div>
      )}

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
            {loading && (
              <div className="message-wrapper bot-message">
                <div className="message">
                  <div className="loading-spinner"></div>
                  <p>Digitando...</p>
                </div>
              </div>
            )}
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
              disabled={loading}
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