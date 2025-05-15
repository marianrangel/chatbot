// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuração das APIs
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyAHqN0QsXXpsbF2zYbALEjCbp7c05lv-6o");
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || "sua_chave_da_openweathermap";

app.use(cors());
app.use(express.json());

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
  
  return "São Paulo"; // Cidade padrão se nenhuma for identificada
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

// Endpoint para obter informações do clima
app.get('/api/weather', async (req, res) => {
  const { city } = req.query;
  
  if (!city) {
    return res.status(400).json({ error: 'Nome da cidade é obrigatório' });
  }
  
  try {
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather`,
      {
        params: {
          q: city,
          appid: WEATHER_API_KEY,
          units: 'metric',
          lang: 'pt_br'
        }
      }
    );
    
    const weatherData = response.data;
    const temp = Math.round(weatherData.main.temp);
    const clothing = getClothingRecommendation(temp, weatherData.weather[0].main);
    
    res.json({
      city: weatherData.name,
      temperature: temp,
      tempMin: Math.round(weatherData.main.temp_min),
      tempMax: Math.round(weatherData.main.temp_max),
      humidity: weatherData.main.humidity,
      weatherDesc: weatherData.weather[0].description,
      clothing
    });
  } catch (error) {
    console.error('Erro ao buscar dados do clima:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      res.status(404).json({ error: 'Cidade não encontrada' });
    } else {
      res.status(500).json({ error: 'Erro ao buscar dados do clima' });
    }
  }
});

// Endpoint /chat
app.post('/chat', async (req, res) => {
  const mensagemUsuario = req.body.mensagem;
  const historicoRecebido = req.body.historico || [];

  try {
    // Verifica se é uma pergunta sobre clima/tempo
    if (isWeatherQuestion(mensagemUsuario)) {
      const city = extractCityName(mensagemUsuario);
      
      try {
        const weatherResponse = await axios.get(
          `http://localhost:${PORT}/api/weather`,
          { params: { city } }
        );
        
        const weatherData = weatherResponse.data;
        const weatherText = `
🌡️ Clima atual em ${weatherData.city}:
Temperatura: ${weatherData.temperature}°C (mínima: ${weatherData.tempMin}°C, máxima: ${weatherData.tempMax}°C)
Condição: ${weatherData.weatherDesc}
Umidade: ${weatherData.humidity}%

👕 Recomendação de vestuário:
${weatherData.clothing}
        `.trim();
        
        // Cria o novo histórico para enviar de volta
        const novoHistorico = [
          ...historicoRecebido,
          { role: "user", parts: [{ text: mensagemUsuario }] },
          { role: "model", parts: [{ text: weatherText }] }
        ];
        
        res.json({ resposta: weatherText, historico: novoHistorico });
      } catch (error) {
        // Se houver erro ao buscar clima, envia para o modelo de IA
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const chat = model.startChat({
          history: historicoRecebido,
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 1024
          }
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
      }
    } else {
      // Se não for pergunta sobre clima, usa o modelo de IA diretamente
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
    }
  } catch (error) {
    console.error("Erro ao processar mensagem:", error);
    res.status(500).json({ 
      erro: "Desculpe, não consegui processar sua mensagem agora." 
    });
  }
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});