<div align="center">
  
# 🛡️ NG-SOC | Next-Generation Command Center
**Plataforma Avançada de SIEM & SOAR com Integração em Tempo Real**

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-2024-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Fortinet](https://img.shields.io/badge/Hardware-FortiGate-CC0000?style=for-the-badge&logo=fortinet&logoColor=white)](https://www.fortinet.com/)

O **NG-SOC** é um laboratório de Defesa Cibernética de ponta a ponta. Ele resolve o problema da fadiga de alertas ao centralizar a ingestão de logs do firewall, aplicar inteligência analítica, detetar anomalias heurísticas e permitir a contenção imediata de ameaças com um único clique.

</div>

---

## 📋 Tabela de Conteúdos
1. [Sobre o Projeto](#-sobre-o-projeto)
2. [Principais Funcionalidades](#-principais-funcionalidades)
3. [Arquitetura do Sistema](#-arquitetura-do-sistema)
4. [Tecnologias Utilizadas](#-tecnologias-utilizadas)
5. [Como Executar (Quick Start)](#-como-executar-quick-start)

---

## 🎯 Sobre o Projeto

Este projeto foi construído para simular uma operação real de **Blue Team** e **SOC (Security Operations Center)**. Ele não apenas consome telemetria de rede passivamente, mas age como um orquestrador de segurança (SOAR), comunicando-se de volta com a infraestrutura para bloquear tráfego malicioso de forma automatizada.

> **Objetivo Acadêmico:** Validar conceitos de segurança de perímetro, roteamento, consumo de APIs REST, processamento de dados em tempo real, deteção de ameaças não-assinadas (Zero-Day) e desenvolvimento de interfaces táticas.

---

## ✨ Principais Funcionalidades

- **📡 Ingestão de Telemetria L7 (SIEM):** Coletor Syslog customizado via UDP, processando eventos com visibilidade de Aplicação e Identidade de utilizadores, indo muito além da Camada 3.
- **🦠 Validador de Zero-Day (Heurística):** Motor Python que inspeciona payloads à procura de padrões evasivos (ex: Base64, RCE, Path Traversal, Log4j) sem depender de assinaturas conhecidas.
- **🛡️ Mapeamento MITRE ATT&CK®:** Tradução automática de incidentes para a taxonomia oficial de Táticas e Técnicas da Kill Chain (ex: *TA0006 Credential Access / T1110 Brute Force*).
- **⚡ Resposta Ativa (SOAR):** Bloqueio imediato de atacantes injetando IPs diretamente na *Blocklist* do FortiGate via API RESTful.
- **📊 Threat Analytics Avançado:** Dashboards dinâmicos para categorização de ameaças e score de postura de risco em tempo real.
- **🌍 Global Threat Map:** Mapeamento 3D interativo geolocalizando a origem dos ataques globais.
- **🤖 AI Copilot:** Assistente virtual tático integrado com motor LLM para triagem rápida.
- **📬 Relatórios Cloud-Native:** Disparo automatizado de alertas críticos e relatórios compilados em PDF via API Transacional de E-mail (*Resend*).

---

## 🧠 Arquitetura do Sistema

O diagrama abaixo ilustra o fluxo de dados em tempo real do sistema:

```mermaid
graph TD
    A[🔥 FortiGate Firewall] -->|Logs UDP/5140| B(🐍 Syslog Collector & Motor Zero-Day)
    B -->|Mapeamento L7 & MITRE| C[(🗄️ Banco de Dados SQLite)]
    D[⚡ FastAPI Backend] <-->|Consultas SQL| C
    E[💻 React Dashboard] <-->|Polling / API REST| D
    E -->|Gerar Relatório PDF| F[📧 Resend API]
    E -->|SOAR: Bloquear IP| D
    D -->|Injeção API| A
