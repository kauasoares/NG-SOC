<div align="center">
  
# 🛡️ NG-SOC | Next-Generation Command Center
**Plataforma Avançada de SIEM & SOAR com Integração em Tempo Real**

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-2024-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Fortinet](https://img.shields.io/badge/Hardware-FortiGate-CC0000?style=for-the-badge&logo=fortinet&logoColor=white)](https://www.fortinet.com/)

O **NG-SOC** é um laboratório de Defesa Cibernética de ponta a ponta. Ele resolve o problema da fadiga de alertas ao centralizar a ingestão de logs do firewall, aplicar inteligência analítica e permitir a contenção imediata de ameaças com um único clique.

</div>

---

## 📋 Tabela de Conteúdos
1. [Sobre o Projeto](#-sobre-o-projeto)
2. [Principais Funcionalidades](#-principais-funcionalidades)
3. [Arquitetura do Sistema](#-arquitetura-do-sistema)
4. [Tecnologias Utilizadas](#-tecnologias-utilizadas)
5. [Como Executar (Quick Start)](#-como-executar-quick-start)
6. [Galeria](#-galeria)
7. [Autor](#-autor)

---

## 🎯 Sobre o Projeto

Este projeto foi construído para simular uma operação real de **Blue Team** e **SOC (Security Operations Center)**. Ele não apenas consome telemetria de rede passivamente, mas age como um orquestrador de segurança (SOAR), comunicando-se de volta com a infraestrutura para bloquear tráfego malicioso de forma automatizada.

> **Objetivo Acadêmico:** Validar conceitos de segurança de perímetro, roteamento, consumo de APIs REST, processamento de dados em tempo real e desenvolvimento de interfaces táticas.

---

## ✨ Principais Funcionalidades

- **📡 Ingestão de Telemetria (SIEM):** Coletor de logs Syslog customizado via UDP, capaz de processar eventos de segurança gerados por firewalls.
- **⚡ Resposta Ativa (SOAR):** Bloqueio imediato de atacantes injetando IPs diretamente na *Blocklist* do FortiGate via Dashboard.
- **📊 Threat Analytics Avançado:** Dashboards dinâmicos com gráficos de rosca e barras para categorização de ameaças (Brute Force, Scan, etc).
- **🌍 Global Threat Map:** Mapeamento 3D interativo geolocalizando a origem dos ataques.
- **🤖 AI Copilot:** Motor de inteligência que simula a análise automatizada de logs suspeitos.
- **📄 Relatórios Executivos:** Geração de *Shift Reports* (Relatórios de Turno) em formato PDF, prontos para auditoria de compliance.
- **🌓 Dual-View UI:** Suporte a "Visão Tática" (Dark Mode) para analistas e "Visão Executiva" (Light Mode) para gestão.

---

## 🧠 Arquitetura do Sistema

O diagrama abaixo ilustra o fluxo de dados em tempo real do sistema:

```mermaid
graph TD
    A[🔥 FortiGate Firewall] -->|Logs via UDP/5140| B(🐍 Syslog Collector)
    B -->|Gravação| C[(🗄️ Banco de Dados SQLite)]
    D[⚡ FastAPI Backend] <-->|Leitura/Consultas| C
    E[💻 React Dashboard] <-->|Polling / API REST| D
    E -->|1-Click Block / Payload| D
    D -->|Bloqueio Automatizado| A
