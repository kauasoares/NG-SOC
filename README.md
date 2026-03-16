# 🛡️ Next-Gen SOC: Autonomous Threat Intelligence & SOAR

![Status](https://img.shields.io/badge/Status-Operacional-success)
![Python](https://img.shields.io/badge/Backend-Python_FastAPI-3776AB?logo=python&logoColor=white)
![React](https://img.shields.io/badge/Frontend-React_Vite-61DAFB?logo=react&logoColor=black)
![Fortinet](https://img.shields.io/badge/Firewall-FortiGate_API-C00000)
![AI](https://img.shields.io/badge/AI_Engine-Google_Gemini-8E75B2)

Um Centro de Operações de Segurança (SOC) de Nova Geração construído em arquitetura de Microsserviços. Este projeto integra análise de tráfego de rede em tempo real, geolocalização de ameaças e uma Inteligência Artificial (Copiloto) com capacidades de SOAR (Security Orchestration, Automation, and Response) para neutralização autônoma de ataques diretamente em firewalls Fortinet FortiGate.

*(Insira aqui uma captura de tela do seu Dashboard rodando)*

## ✨ Funcionalidades Principais

* **🌐 Global Threat Map (3D):** Renderização em tempo real da origem geográfica dos ataques usando `react-globe.gl` e geolocalização de IPs.
* **🤖 AI ChatOps (SOAR):** Integração nativa com Google Gemini (SDK `google-genai`). A IA analisa logs táticos e tem permissão para executar chamadas de API para isolar IPs invasores.
* **⚡ Resposta a Incidentes em 1-Clique:** Tabela de logs enriquecida com cálculo dinâmico de *Risk Score* (0 a 100) e botões de ação rápida para bloqueio de rede.
* **📊 Telemetria Avançada:** Gráficos interativos (Recharts) mostrando alvos frequentes e uma linha do tempo (timeline) de ataques por minuto.
* **🎨 UI/UX Cyberpunk:** Interface "Dark Mode" projetada em Tailwind CSS para alta legibilidade em ambientes de monitoramento contínuo.

## 🏗️ Arquitetura do Sistema

O projeto é dividido em três camadas principais:
1. **Coleta (Edge):** Servidor Syslog em Python que escuta eventos do FortiGate e armazena em um banco SQLite.
2. **Cérebro (Backend):** API REST assíncrona construída com FastAPI. Gerencia o banco de dados, o cache de geolocalização e as sessões de *Function Calling* da IA.
3. **Apresentação (Frontend):** Aplicação Single-Page (SPA) em React.js consumindo a API em tempo real.

## 🚀 Como Executar o Projeto

### Pré-requisitos
* Node.js (v18+)
* Python (3.10+)
* Um equipamento FortiGate (Físico ou VM) com API REST habilitada.
* Chave de API do Google Gemini.

### 1. Configurando o Backend (Python / FastAPI)
Navegue até a pasta raiz do backend e crie um ambiente virtual:
```bash

Habilitando o Syslog (Para enviar logs ao Dashboard):

Abra a CLI do FortiGate (via SSH ou pelo console na interface web).

Digite os comandos abaixo, substituindo IP_DO_SEU_PC_PYTHON pelo IP da máquina onde o código vai rodar:
config log syslogd setting
    set status enable
    set server "IP_DO_SEU_PC_PYTHON"
    set port 5140
end

python -m venv venv

### Instale as dependências da API:

pip install fastapi uvicorn pydantic google-genai python-dotenv requests

### Crie um arquivo .env com suas credenciais:
GEMINI_API_KEY=sua_chave_api_aqui

### Inicie o servidor do Backend:
uvicorn main:app --reload
A API estará rodando em http://localhost:8000.

### 2. Configurando o Frontend (React)
Em um novo terminal, navegue até a pasta do frontend (ng-soc-ui):
cd ng-soc-ui
npm install

Inicie o servidor de desenvolvimento:
npm run dev
Acesse http://localhost:5173 no seu navegador para abrir o Centro de Comando.

### 🛠️ Tecnologias Utilizadas
Backend: Python, FastAPI, SQLite, Pydantic, Requests.

Frontend: React, Vite, Tailwind CSS, Recharts, React-Globe.gl, Lucide-React.

### Segurança & IA: FortiOS REST API, Google Gemini Flash 2.5.
# Ative o ambiente virtual (Windows):
venv\Scripts\activate
