import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Coloque sua chave da API abaixo
const genAI = new GoogleGenerativeAI("AIzaSyAHqN0QsXXpsbF2zYbALEjCbp7c05lv-6o");

function App() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(prompt);
      const text = await result.response.text();
      setResponse(text);
    } catch (error) {
      console.error("Erro ao gerar resposta:", error);
      setResponse("Ocorreu um erro. Verifique sua chave de API e conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Chatbot com Gemini Pro</h1>
      <form onSubmit={handleSubmit}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Digite sua pergunta aqui..."
          rows="4"
          cols="50"
        />
        <br />
        <button type="submit" disabled={loading}>
          {loading ? "Carregando..." : "Enviar"}
        </button>
      </form>
      {response && (
        <div style={{ marginTop: 20 }}>
          <h2>Resposta:</h2>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}

export default App;
