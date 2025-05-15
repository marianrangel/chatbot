// App.js
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import './App.css';

// Configuração da API
const genAI = new GoogleGenerativeAI("AIzaSyAHqN0QsXXpsbF2zYbALEjCbp7c05lv-6o");
const WEATHER_API_KEY = "ef0e41b4f1e307cff4f937ec8971e46a"; // Use uma chave OpenWeatherMap (registre-se em openweathermap.org)

// Função para verificar se a mensagem contém perguntas sobre data/hora
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

// Função para verificar se a mensagem contém perguntas sobre clima/tempo
const isWeatherQuestion = (message) => {
  const weatherRegex = /(clima|tempo|temperatura|chover|chuva|previsão|ensolarado|sol|vento|frio|calor|quente|graus|roupa|vestir)/i;
  const cityRegex = /(em|na|no|para|de)\s+([A-ZÀ-Úa-zà-ú\s]+)/i;
  const questionRegex = /(como|qual|que|está|vai|pode|poderia|deve|vestir|usar)/i;
  
  return (
    (weatherRegex.test(message) && questionRegex.test(message)) ||
    message.includes("como está o tempo") ||
    message.includes("previsão do tempo") ||
    message.includes("vai chover") ||
    message.includes("temperatura") ||
    message.includes("que roupa usar")
  );
};

// Função para extrair nome da cidade da mensagem
const extractCityName = (message) => {
  // Padrões comuns para identificar cidades
  const patterns = [
    /(?:em|na|no|para|de)\s+([A-ZÀ-Úa-zà-ú\s]+?)(?:\s+hoje|\?|$|\.)/i,
    /(?:clima|tempo|temperatura|previsão)\s+(?:para|em|na|no|de)\s+([A-ZÀ-Úa-zà-ú\s]+?)(?:\s+hoje|\?|$|\.)/i,
    /(?:como está|vai estar)\s+(?:em|na|no)\s+([A-ZÀ-Úa-zà-ú\s]+?)(?:\s+hoje|\?|$|\.)/i
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      // Remove possíveis preposições no final
      return match[1].trim().replace(/\s+(em|na|no|de|para)$/, '');
    }
  }
  
  // Se nenhum padrão específico funcionar, procura por qualquer palavra que pareça uma cidade
  const words = message.split(/\s+/);
  for (const word of words) {
    // Palavras com inicial maiúscula e com mais de 3 caracteres podem ser cidades
    if (word.length > 3 && /^[A-ZÀ-Ú][a-zà-ú]+$/.test(word)) {
      return word;
    }
  }
  
  return "São Paulo"; // Cidade padrão se nenhuma for identificada
};

// Função para gerar resposta de data/hora
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

// Função para obter informações do clima com a API OpenWeatherMap
const getWeatherData = async (city) => {
  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${WEATHER_API_KEY}&units=metric&lang=pt_br`
    );
    
    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Erro ao buscar dados do clima:", error);
    return null;
  }
};

// Função para recomendar roupas baseadas na temperatura
const getClothingRecommendation = (temp, conditions) => {
  if (temp < 10) {
    return "Está muito frio! Recomendo usar várias camadas de roupas, como camiseta, blusa, suéter e casaco pesado. Não esqueça de cachecol, luvas e gorro para se proteger do frio intenso.";
  } else if (temp < 15) {
    return "Está frio. Você deve usar calças, um suéter ou moletom e um casaco mais leve. Uma echarpe ou cachecol também podem ser úteis.";
  } else if (temp < 20) {
    return "A temperatura está amena. Uma calça jeans com uma camiseta de manga comprida e talvez um casaco leve ou cardigã deve ser suficiente.";
  } else if (temp < 25) {
    return "O clima está agradável. Você pode usar calças leves ou até mesmo bermuda/saia, com camiseta. Leve um casaco leve para caso esfrie mais tarde.";
  } else if (temp < 30) {
    return "Está quente. Roupas leves como shorts/bermudas/saias, camisetas, vestidos leves são ideais. Considere usar protetor solar e levar uma garrafa de água.";
  } else {
    return "Está muito quente! Vista-se com roupas bem leves, preferencialmente de algodão ou tecidos que permitam a transpiração. Protetor solar é essencial, assim como manter-se hidratado.";
  }
};

// Função para gerar resposta sobre o clima
const generateWeatherResponse = async (message) => {
  const city = extractCityName(message);
  const weatherData = await getWeatherData(city);
  
  if (!weatherData) {
    return `Desculpe, não consegui obter informações sobre o clima em ${city}. Verifique se o nome da cidade está correto ou tente novamente mais tarde.`;
  }
  
  const temp = Math.round(weatherData.main.temp);
  const tempMin = Math.round(weatherData.main.temp_min);
  const tempMax = Math.round(weatherData.main.temp_max);
  const humidity = weatherData.main.humidity;
  const weatherDesc = weatherData.weather[0].description;
  const clothing = getClothingRecommendation(temp, weatherData.weather[0].main);
  
  return `
🌡️ Clima atual em ${city}:
Temperatura: ${temp}°C (mínima: ${tempMin}°C, máxima: ${tempMax}°C)
Condição: ${weatherDesc}
Umidade: ${humidity}%

👕 Recomendação de vestuário:
${clothing}
  `.trim();
};

// Função auxiliar para obter o nome do mês em português
const getMonthName = (monthIndex) => {
  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 
    'maio', 'junho', 'julho', 'agosto', 
    'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  return months[monthIndex];
};

// Função auxiliar para obter o nome do dia da semana em português
const getWeekdayName = (dayIndex) => {
  const weekdays = [
    'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 
    'quinta-feira', 'sexta-feira', 'sábado'
  ];
  return weekdays[dayIndex];
};

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
      // Verificar se é uma pergunta sobre data/hora
      if (isDateTimeQuestion(userMessage)) {
        // Se for pergunta sobre data/hora, gerar resposta local
        const dateTimeResponse = generateDateTimeResponse();
        setTimeout(() => {
          setMessages(prev => [...prev, { text: dateTimeResponse, sender: 'bot' }]);
          setLoading(false);
        }, 500); // Pequeno atraso para parecer natural
      } 
      // Verificar se é uma pergunta sobre clima/tempo
      else if (isWeatherQuestion(userMessage)) {
        // Se for pergunta sobre clima, chamar função específica
        const weatherResponse = await generateWeatherResponse(userMessage);
        setMessages(prev => [...prev, { text: weatherResponse, sender: 'bot' }]);
        setLoading(false);
      } 
      else {
        // Caso contrário, usar a API do modelo
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(userMessage);
        const text = await result.response.text();
        setMessages(prev => [...prev, { text: text, sender: 'bot' }]);
        setLoading(false);
      }
    } catch (error) {
      console.error("Erro ao gerar resposta:", error);
      setMessages(prev => [...prev, { 
        text: "Ocorreu um erro. Verifique sua chave de API e conexão.", 
        sender: 'bot', 
        error: true 
      }]);
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
            <p>Você também pode me perguntar:</p>
            <ul>
              <li>A data e hora atuais</li>
              <li>O clima e temperatura em qualquer cidade</li>
              <li>Recomendações de roupas para o clima atual</li>
            </ul>
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