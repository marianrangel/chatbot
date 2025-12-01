<!--
	Polished README for Demo Day / Portfolio
	Replace placeholders in brackets [..] with project-specific links and texts.
-->

# ChatBot de Autocuidado — Conversa que cuida

Slogan: Um chatbot personalizável que aprende seu contexto e protege suas conversas.

Descrição
---
Este projeto é um chatbot full‑stack criado como parte do curso — com autenticação, memória por usuário, painel de administração e opções para personalizar personalidade e tom. O objetivo deste repositório é servir como um ativo de portfólio: código limpo, documentação e uma demo interativa.

Demo Visual
---
- GIF de demonstração: `assets/demo.gif` (substitua pelo GIF gravado mostrando: login → conversa → personalização)
- Demo online (frontend): [COLE_AQUI_O_LINK_DA_FRONTEND]  
- API (backend): [COLE_AQUI_O_LINK_DA_BACKEND]

Principais funcionalidades
---
- Autenticação segura (armazenamento de token + hashing no backend)
- Personalização por usuário (persona, tom, preferências)
- Memória de conversa por sessão com endpoint de persistência
- Geração de títulos de conversa e gerenciamento de históricos
- Painel de admin com métricas básicas (usuários, conversas, erros)
- Proteções básicas: validação de entrada, mensagens de erro amigáveis

Tech Stack
---
- Frontend: React (Create React App)
- Backend: Node.js + Express
- Banco de dados: MongoDB (ou outra implementação baseada em JSON)
- LLM: integração via API (ex: Gemini / OpenAI) gerenciada pelo backend
- Deploy: Vercel, Render ou Heroku (substitua conforme aplicável)

Como rodar localmente (Windows)
---
1. Clone o repositório e entre na pasta principal:

```powershell
cd "c:\Users\aluno2025\Downloads\chatbot-main (3)\chatbot-main"
```

2. Backend (abra um terminal):

```powershell
cd backend
npm install
# defina variáveis de ambiente: DATABASE_URL, API_KEY, etc.
npm start
```

3. Frontend (outro terminal):

```powershell
cd frontend
npm install
npm start
```

Nota rápida: o `login.html` em `/public` faz POST para o backend (ver `BACKEND_URL`), ajuste se estiver rodando localmente.

QA Rápido (smoke tests)
---
- Registrar um novo usuário e efetuar login
- Enviar mensagem vazia — UI deve impedir
- Verificar que a personalização afeta respostas
- Confirmar que o histórico é salvo (ver endpoint `/api/chat/historicos`)

Estrutura do repositório
---
- `/frontend` — código React (UI)
- `/backend` — API (auth, chat, integrações com LLM)
- `/public` — páginas estáticas (login, registro, configuracoes)
- `/assets` — imagens e GIFs para README e demo

Como contribuir
---
- Abra uma issue para bugs/UX e solicite permissões para PRs.
- Para PRs: descreva a mudança, inclua screenshots/GIFs e adicione testes básicos quando possível.

Pitch & Demo
---
Veja `docs/PITCH.md` para roteiro de apresentação, tempo sugerido e instruções para gravação do GIF de demonstração.

Licença
---
MIT — ajuste conforme necessário.

Contato
---
- Autor: [SEU NOME]
- Email: [SEU EMAIL]

---
Substitua os placeholders entre colchetes antes de publicar no GitHub.
