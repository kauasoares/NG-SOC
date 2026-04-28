# 🛡️ Next-Gen SOC: Autonomous Threat Intelligence & SOAR

![Status](https://img.shields.io/badge/Status-Operacional-success)
![Python](https://img.shields.io/badge/Backend-Python_FastAPI-3776AB?logo=python&logoColor=white)
![React](https://img.shields.io/badge/Frontend-React_Vite-61DAFB?logo=react&logoColor=black)
![Fortinet](https://img.shields.io/badge/Firewall-FortiGate_API-C00000)
![AI](https://img.shields.io/badge/AI_Engine-Google_Gemini-8E75B2)

O NG-SOC é uma plataforma de monitoramento e resposta a incidentes (SIEM/SOAR) desenvolvida para centralizar a visibilidade de rede e automatizar a contenção de ameaças. O projeto integra telemetria de firewalls FortiGate em tempo real com uma interface tática moderna e inteligência artificial para análise de logs.


🚀 Funcionalidades Principais
Ingestão de Logs (SIEM): Coletor Syslog de alta performance via UDP/5140.

Resposta Ativa (SOAR): Bloqueio imediato de IPs maliciosos diretamente na API do FortiGate através da dashboard.

Analytics Avançado: Gráficos interativos de distribuição de ameaças, volumetria de ataques e níveis de risco (Score).

Global Threat Map: Visualização 3D de geolocalização de tráfego e tentativas de invasão.

AI Copilot: Assistente de segurança integrado para análise contextual de anomalias.

Relatórios Executivos: Geração de relatórios de turno em PDF (Shift Reports) com um clique.

Interface Multi-Tema: Visão Tática (Dark Mode) para analistas e Visão Executiva (Light Mode) para gerência.

🛠️ Stack Tecnológica
Backend (Core Engine)
Python 3.10+

FastAPI: API de baixa latência para comunicação com o Frontend.

Socket & Threading: Captura paralela de logs Syslog (UDP).

SQLite: Armazenamento persistente de logs e eventos.

Uvicorn: Servidor ASGI de alta performance.

Frontend (Command Center)
React.js + Vite

Tailwind CSS: Estilização tática e responsiva.

Recharts: Visualização de dados e tendências de ataque.

React-Globe.gl: Mapeamento global de ameaças em 3D.

Lucide Icons: Iconografia técnica.

🏗️ Arquitetura do Sistema
Firewall (FortiGate): Dispara logs de tráfego para o IP do SOC na porta 5140.

Syslog Server (Python): Recebe, processa via Regex e armazena os logs no banco de dados.

FastAPI: Serve os dados processados e gerencia as ordens de bloqueio (SOAR).

React Dashboard: Interface de usuário que consome a API e visualiza os incidentes.

💻 Como Executar
1. Preparação do Banco de Dados e API
Bash
# Clone o repositório
git clone https://github.com/seu-usuario/ng-soc.git

# Entre na pasta do backend
cd ng-soc/backend

# Instale as dependências
pip install -r requirements.txt

# Inicie o sistema (API + Syslog simultâneos)
python main.py

# Em outro terminal, entre na pasta do frontend
cd ng-soc/frontend

# Instale as dependências
npm install

# Inicie a Dashboard
npm run dev

3. Configuração no FortiGate
No CLI do seu FortiGate, configure o envio de logs:

config log syslogd setting
    set status enable
    set server "IP_DA_SUA_MAQUINA"
    set port 5140
end

Foco em: Cybersecurity, Networking, Cloud Infrastructure e Automação.

Este projeto foi desenvolvido para fins acadêmicos e laboratoriais, demonstrando a viabilidade de uma operação de SOC moderna com ferramentas Open Source.

### Segurança & IA: FortiOS REST API, Google Gemini Flash 2.5.
# Ative o ambiente virtual (Windows):
venv\Scripts\activate
