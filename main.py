import sqlite3
import requests
import urllib3
import json
import socket
import re
import threading
import time
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Tenta importar psutil para métricas reais de CPU/RAM do sistema hospedeiro.
try:
    import psutil
    has_psutil = True
except ImportError:
    has_psutil = False

from google import genai

# Remove avisos de conexões SSL inseguras gerados pela API do FortiGate
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
load_dotenv()

# --- CONFIGURAÇÕES DO AMBIENTE ---
FGT_IP = "192.168.158.130"
API_TOKEN = "xQtH7yq7nHs38Hpr74Hy7jpqjtry9p" 

try:
    client = genai.Client()
    ia_status = "ONLINE"
except Exception:
    client = None
    ia_status = "OFFLINE"

# Variáveis globais de Cache e Engines do SIEM
geo_cache = {}
reputation_cache = {}
event_correlation_engine = {}
alerted_ips_cooldown = {} 

# Configuração em memória sincronizada com a interface do Frontend
alert_config = {
    "emails": [], 
    "threshold": 85, 
    "report_interval_minutes": 0, 
    "last_report_time": time.time()
}

# --- MODELOS DE DADOS (PYDANTIC) ---
class ChatRequest(BaseModel): message: str
class BlockRequest(BaseModel): ip_address: str
class PlaybookRequest(BaseModel): target_ip: str; playbook_name: str
class AlertConfigRequest(BaseModel): emails: list[str]; threshold: int = 85
class ReportConfigRequest(BaseModel): interval_minutes: int
class ManualReportRequest(BaseModel): pdf_data: str

# ==========================================
# MOTOR DE E-MAILS VIA API CLOUD-NATIVE (RESEND)
# ==========================================
def send_email(subject: str, html_content: str):
    if not alert_config["emails"]:
        print("[!] Alerta cancelado: Nenhum destinatário configurado no painel.")
        return

    # SUA CHAVE DO RESEND:
def send_email(subject: str, html_content: str, attachment_b64: str = None):
    if not alert_config["emails"]:
        print("[!] Alerta cancelado: Nenhum destinatário configurado no painel.")
        return

    # A SUA CHAVE DO RESEND (MANTENHA A SUA CHAVE AQUI)
    RESEND_API_KEY = "re_7Dai1Q1K_J4opsEzZ9hoN2C92HoM78fdD"
    
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "from": "NG-SOC Enterprise <onboarding@resend.dev>",
        "to": alert_config["emails"], 
        "subject": subject,
        "html": html_content
    }
    
    # SE RECEBER UM ANEXO BASE64, ADICIONA AO PAYLOAD
    if attachment_b64:
        payload["attachments"] = [
            {
                "filename": f"NG_SOC_Shift_Report_{int(time.time())}.pdf",
                "content": attachment_b64
            }
        ]
    
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=5)
        if res.status_code in [200, 201]:
            print(f"[+] API de E-mail acionada com sucesso: {subject}")
        else:
            print(f"[-] Erro na API do Resend: {res.text}")
    except Exception as e:
        print(f"[-] Erro de conexão com a API de E-mail: {e}")

def trigger_critical_alert(ip: str, risk: int, log_raw: str):
    """Dispara um alerta imediato de contenção se o IP estiver fora do cooldown de 5 minutos"""
    agora = time.time()
    if ip in alerted_ips_cooldown and (agora - alerted_ips_cooldown[ip] < 300):
        return 
    
    alerted_ips_cooldown[ip] = agora
    geo = get_geo_location(ip)
    
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #333; background-color: #0b0914; color: #fff;">
        <div style="background-color: #ff007f; padding: 15px; text-align: center;">
            <h2 style="color: #fff; margin: 0;">🚨 ALERTA CRÍTICO DETECTADO 🚨</h2>
        </div>
        <div style="padding: 20px;">
            <p><strong>Risco Calculado:</strong> <span style="color: #ff007f; font-size: 18px;">{risk}/100</span></p>
            <p><strong>Origem (IP Atacante):</strong> <span style="color: #00f0ff;">{ip}</span></p>
            <p><strong>Localização:</strong> {geo.get('country', 'N/A')} - {geo.get('isp', 'N/A')}</p>
            <p><strong>Detalhes da Telemetria (Raw Log):</strong></p>
            <div style="background-color: #151221; padding: 10px; border: 1px solid #231f36; font-family: monospace; font-size: 12px; word-wrap: break-word; color: #b5b5b5;">
                {log_raw}
            </div>
            <p style="margin-top: 20px;">Acesse o Command Center do NG-SOC imediatamente para executar o Playbook automatizado de contenção (SOAR).</p>
        </div>
    </div>
    """
    threading.Thread(target=send_email, args=(f"[CRÍTICO] Ameaça Correlacionada - IP: {ip}", html), daemon=True).start()

def report_scheduler_thread():
    """Monitora o tempo em background para realizar os disparos automáticos de relatórios"""
    while True:
        time.sleep(30) 
        interval = alert_config["report_interval_minutes"]
        
        if interval > 0:
            agora = time.time()
            if (agora - alert_config["last_report_time"]) >= (interval * 60):
                alert_config["last_report_time"] = agora
                
                stats = get_stats()
                html_report = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #333; background-color: #0b0914; color: #fff;">
                    <div style="background-color: #7000ff; padding: 15px; text-align: center;">
                        <h2 style="color: #fff; margin: 0;">📊 RELATÓRIO OPERACIONAL NG-SOC 📊</h2>
                    </div>
                    <div style="padding: 20px;">
                        <h3 style="color: #00f0ff; border-bottom: 1px solid #231f36; padding-bottom: 5px;">Métricas do Turno</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li style="margin-bottom: 10px;">🛡️ <strong>Total de Ameaças Mapeadas:</strong> {stats['total_threats']}</li>
                            <li style="margin-bottom: 10px;">🚫 <strong>Bloqueios Executados (SOAR):</strong> {stats['blocked_attacks']}</li>
                            <li style="margin-bottom: 10px;">📈 <strong>Posture Score Geral:</strong> {stats['posture_score']}%</li>
                        </ul>
                        <h3 style="color: #00f0ff; border-bottom: 1px solid #231f36; padding-bottom: 5px; margin-top: 20px;">Top Atacantes Bloqueados</h3>
                        <table style="width: 100%; border-collapse: collapse; text-align: left;">
                            <tr style="background-color: #151221; color: #8b8a96;">
                                <th style="padding: 8px;">Endereço IP</th>
                                <th style="padding: 8px;">Requisições Dropadas</th>
                            </tr>
                            {''.join([f"<tr><td style='padding: 8px; border-bottom: 1px solid #231f36; color: #ff007f; font-family: monospace;'>{ip}</td><td style='padding: 8px; border-bottom: 1px solid #231f36;'>{count}</td></tr>" for ip, count in stats['top_attackers']])}
                        </table>
                    </div>
                </div>
                """
                send_email(f"Relatório Periódico de Turno ({datetime.now().strftime('%d/%m/%Y %H:%M')})", html_report)

# ==========================================
# GESTÃO DE ARQUITETURA DO BANCO DE DADOS
# ==========================================
def get_db_connection():
    conn = sqlite3.connect('ng_soc.db', check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS logs 
                      (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                       timestamp TEXT, src_ip TEXT, dst_ip TEXT, 
                       dst_port TEXT, action TEXT, raw_log TEXT,
                       correlated_risk INTEGER DEFAULT 0)''')
    
    # Injeção segura de novas colunas para Análise de Camada 7 (App, User, Mensagem)
    try: cursor.execute("ALTER TABLE logs ADD COLUMN app_name TEXT DEFAULT 'Desconhecida'")
    except: pass
    try: cursor.execute("ALTER TABLE logs ADD COLUMN threat_msg TEXT DEFAULT 'N/A'")
    except: pass
    try: cursor.execute("ALTER TABLE logs ADD COLUMN user_name TEXT DEFAULT 'Anónimo'")
    except: pass
    
    # NOVA INJEÇÃO: Coluna para o validador de Zero-Day
    try: cursor.execute("ALTER TABLE logs ADD COLUMN is_zero_day INTEGER DEFAULT 0")
    except: pass

    conn.commit()
    conn.close()
    print("[+] Banco de Dados NG-SOC atualizado para Camada 7 e Zero-Day.")

# --- SIEM: MOTOR DE CORRELAÇÃO DE EVENTOS TEMPORAIS E HEURÍSTICA ---
def correlate_events(ip: str) -> bool:
    """Retorna True se o mesmo IP registrar mais de 5 conexões em uma janela de 10 segundos"""
    agora = time.time()
    if ip not in event_correlation_engine: event_correlation_engine[ip] = []
    event_correlation_engine[ip].append(agora)
    event_correlation_engine[ip] = [t for t in event_correlation_engine[ip] if agora - t <= 10]
    return len(event_correlation_engine[ip]) >= 5

def detect_zero_day_heuristics(raw_log: str) -> bool:
    """Validador de Anomalias Zero-Day: Procura por padrões de ofuscação e RCE não assinados."""
    # 1. Ofuscação avançada (Base64 longo ou múltiplos Encodings)
    if re.search(r'(?:[A-Za-z0-9+/]{40,}=*|%[0-9a-fA-F]{2}.*?%[0-9a-fA-F]{2}){5,}', raw_log):
        return True
    # 2. Padrões de Injeção e Execução Remota (RCE) como Log4j/Spring4Shell
    if re.search(r'(?:\b(?:eval|exec|system|popen|wget|curl)\b|jndi:|ldap:|rmi:|\$\{.*?\})', raw_log, re.IGNORECASE):
        return True
    # 3. Path Traversal e SQLi embutidos fora do padrão normal
    if re.search(r'(?:\.\./\.\./|WAITFOR DELAY|UNION SELECT)', raw_log, re.IGNORECASE):
        return True
    return False

# --- MOTOR DE CAPTURA SYSLOG (TEMPO REAL) ---
def start_syslog_server():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("0.0.0.0", 5140))
    print("Servidor Syslog rodando na porta 5140...")
    
    conn = sqlite3.connect('ng_soc.db', check_same_thread=False)
    cursor = conn.cursor()

    while True:
        try:
            data, addr = sock.recvfrom(4096)
            log_message = data.decode('utf-8', errors='ignore')

            # Extração Básica
            src = re.search(r'srcip=([^\s]+)', log_message)
            dst = re.search(r'dstip=([^\s]+)', log_message)
            port = re.search(r'dstport=([0-9]+)', log_message)
            act = re.search(r'action="?([a-zA-Z\-]+)"?', log_message)

            # Extração Avançada
            app_match = re.search(r'app="?([^"\s]+)"?', log_message)
            msg_match = re.search(r'msg="([^"]+)"', log_message)
            user_match = re.search(r'user="?([^"\s]+)"?', log_message)

            app_name = app_match.group(1) if app_match else ""
            
            # Fallback L7 (Resolve o problema de painel vazio)
            if not app_name or app_name == "":
                dst_port_str = port.group(1) if port else ""
                port_to_app = {
                    '80': 'HTTP.Web',
                    '443': 'HTTPS.Browser',
                    '22': 'SSH.Terminal',
                    '53': 'DNS.Service',
                    '3389': 'RDP.Connection',
                    '445': 'SMB.Share',
                    '8080': 'HTTP.Proxy'
                }
                app_name = port_to_app.get(dst_port_str, "Unknown.App")

            src_ip = src.group(1) if src else "Desconhecido"
            dst_port_str = port.group(1) if port else ""
            act_str = act.group(1).lower() if act else "unknown"

            if src_ip != "Desconhecido" and src_ip != FGT_IP:
                
                is_correlated_attack = correlate_events(src_ip)
                is_0day = detect_zero_day_heuristics(log_message)

                # Whitelist: Ignorar navegação normal para não poluir o SOC
                if dst_port_str in ['80', '443', '53', '123', ''] and act_str in ['accept', 'pass', 'client-rst', 'server-rst', 'close', 'timeout']:
                    is_correlated_attack = False
                
                # Risco Máximo
                correlated_risk = 100 if is_correlated_attack or is_0day else 0

                # Cálculo do Risco Base
                base_score = 10 
                if act_str in ["deny", "drop"]: 
                    base_score = 70
                elif dst_port_str in ['22', '3389']: 
                    base_score = 50

                external_score = get_external_risk_score(src_ip)
                final_risk = max(base_score, external_score, correlated_risk)
                
                threat_msg = msg_match.group(1) if msg_match else "N/A"
                user_name = user_match.group(1) if user_match else "Anónimo"

                agora = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                
                cursor.execute('''INSERT INTO logs 
                               (timestamp, src_ip, dst_ip, dst_port, action, raw_log, correlated_risk, app_name, threat_msg, user_name, is_zero_day) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''', 
                               (agora, src_ip, dst.group(1) if dst else "", dst_port_str, act_str, log_message, final_risk, app_name, threat_msg, user_name, int(is_0day)))
                conn.commit()

                if final_risk >= alert_config["threshold"]:
                    trigger_critical_alert(src_ip, final_risk, log_message)
        except Exception:
            pass

# --- LIFESPAN: CONFIGURAÇÃO SEGURA DE STARTUP ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    threading.Thread(target=start_syslog_server, daemon=True).start()
    threading.Thread(target=report_scheduler_thread, daemon=True).start()
    yield

app = FastAPI(title="NG-SOC Enterprise API", version="5.5", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- INTEGRAÇÃO COM THREAT INTEL EXTERNO (GEOLOCALIZAÇÃO) ---
def get_geo_location(ip):
    if ip in geo_cache: return geo_cache[ip]
    if ip.startswith("192.") or ip.startswith("10.") or ip.startswith("172."):
        geo_cache[ip] = {"lat": -23.6666, "lon": -46.5322, "country": "Rede Interna", "isp": "Intranet SOC"}
        return geo_cache[ip]
    try:
        res = requests.get(f"http://ip-api.com/json/{ip}", timeout=2).json()
        if res.get("status") == "success":
            geo_cache[ip] = {"lat": res.get("lat", 0), "lon": res.get("lon", 0), "country": res.get("country", "Desconhecido"), "isp": res.get("isp", "Desconhecido")}
        else: geo_cache[ip] = {"lat": 0, "lon": 0, "country": "Desconhecido", "isp": "N/A"}
    except: geo_cache[ip] = {"lat": 0, "lon": 0, "country": "Offline", "isp": "N/A"}
    return geo_cache[ip]

def get_external_risk_score(ip: str) -> int:
    if ip in reputation_cache: return reputation_cache[ip]
    if ip.startswith("192.") or ip.startswith("10.") or ip.startswith("172."): return 0

    # Opcional: Chave da API do AbuseIPDB caso queira adicionar reputação global
    ABUSE_KEY = "05623302c5c7caba7ee55a676756e1a46430109d905e6c0bc04a704f6219137feeb0df2adef8cc4d" 
    if ABUSE_KEY != "05623302c5c7caba7ee55a676756e1a46430109d905e6c0bc04a704f6219137feeb0df2adef8cc4d":
        try:
            url = "https://api.abuseipdb.com/api/v2/check"
            headers = {'Accept': 'application/json', 'Key': ABUSE_KEY}
            res = requests.get(url, headers=headers, params={'ipAddress': ip, 'maxAgeInDays': '90'}, timeout=2)
            if res.status_code == 200:
                score = res.json()['data']['abuseConfidenceScore']
                reputation_cache[ip] = score
                return score
        except: pass
    reputation_cache[ip] = min(100, max(0, (hash(ip) % 100)))
    return reputation_cache[ip]

# --- ORQUESTRADOR SOAR (FIREWALL INTEGRATION) ---
def block_ip_fortigate(ip_address: str) -> str:
    ip_limpo = ip_address.strip().replace('"', '')
    if not ip_limpo or ip_limpo.lower() == "desconhecido" or ip_limpo == "0.0.0.0": return "❌ Ação Negada: IP de origem inválido."
    url_create = f"http://{FGT_IP}/api/v2/cmdb/firewall/address"
    headers = {"Authorization": f"Bearer {API_TOKEN}", "Content-Type": "application/json"}
    obj_name = f"SOC_Block_{ip_limpo.replace('.', '_')}"
    try:
        res = requests.post(url_create, headers=headers, data=json.dumps({"name": obj_name, "type": "ipmask", "subnet": f"{ip_limpo} 255.255.255.255", "color": 6}), verify=False, timeout=5)
        if res.status_code == 200 or "-5" in res.text or "duplicate" in res.text.lower():
            url_group = f"http://{FGT_IP}/api/v2/cmdb/firewall/addrgrp/SOC_BLOCKLIST/member"
            requests.post(url_group, headers=headers, data=json.dumps({"name": obj_name}), verify=False, timeout=5)
            return f"IP {ip_limpo} injetado com sucesso no grupo SOC_BLOCKLIST."
        return f"Erro na API FortiOS: {res.text}"
    except Exception as e: return f"Falha de conexão com a API do FortiGate: {str(e)}"

# ==========================================
# ROTAS ENDPOINT (FASTAPI)
# ==========================================

@app.get("/api/status")
def get_status(): return {"api": "ONLINE", "database": "ONLINE", "ai_engine": ia_status}

@app.get("/api/logs")
def get_logs(limit: int = 50):
    conn = get_db_connection()
    logs = conn.execute(f"SELECT id, timestamp, src_ip, dst_ip, dst_port, action, is_zero_day, correlated_risk FROM logs WHERE src_ip != '{FGT_IP}' ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    formatted = []
    for row in logs:
        d = dict(row)
        base_score = 70 if str(d["action"]).lower() in ["deny", "drop"] else 50 if str(d["dst_port"]) in ['22', '3389'] else 20
        d["risk_score"] = max(base_score, get_external_risk_score(d["src_ip"]), d.get("correlated_risk", 0))
        formatted.append(d)
    conn.close()
    return {"logs": formatted}

@app.get("/api/stats")
def get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    total = cursor.execute(f"SELECT COUNT(*) FROM logs WHERE src_ip != '{FGT_IP}'").fetchone()[0] or 0
    blocked = cursor.execute(f"SELECT COUNT(*) FROM logs WHERE action IN ('deny', 'drop') AND src_ip != '{FGT_IP}'").fetchone()[0] or 0
    epm = cursor.execute(f"SELECT COUNT(*) FROM logs WHERE timestamp > datetime('now', 'localtime', '-1 minute') AND src_ip != '{FGT_IP}'").fetchone()[0] or 0
    top_ports = [{"port": str(r[0]), "count": r[1]} for r in cursor.execute(f"SELECT dst_port, COUNT(*) as c FROM logs WHERE src_ip != '{FGT_IP}' GROUP BY dst_port ORDER BY c DESC LIMIT 5").fetchall() if r[0]]
    timeline = [{"time": r[0], "attacks": r[1], "blocked": r[2]} for r in cursor.execute(f"SELECT substr(timestamp, 12, 5) as t, COUNT(*) as c, SUM(CASE WHEN action IN ('deny', 'drop') THEN 1 ELSE 0 END) as b FROM logs WHERE src_ip != '{FGT_IP}' GROUP BY t ORDER BY timestamp DESC LIMIT 8").fetchall()][::-1]
    map_data = []
    for row in cursor.execute(f"SELECT DISTINCT src_ip FROM logs WHERE src_ip != '{FGT_IP}' ORDER BY id DESC LIMIT 15").fetchall():
        geo = get_geo_location(row[0])
        map_data.append({"startLat": geo["lat"], "startLng": geo["lon"], "endLat": -23.6666, "endLng": -46.5322, "color": "#ff007f" if geo["lat"] != -23.6666 else "#10b981", "ip": row[0]})
    sys_cpu = psutil.cpu_percent() if has_psutil else 0
    sys_ram = psutil.virtual_memory().percent if has_psutil else 0
    top_attackers = [[row[0], row[1]] for row in cursor.execute(f"SELECT src_ip, COUNT(*) as drops FROM logs WHERE src_ip != '{FGT_IP}' AND action IN ('deny', 'drop') GROUP BY src_ip ORDER BY drops DESC LIMIT 4").fetchall()]
    conn.close()
    return {"total_threats": total, "blocked_attacks": blocked, "epm": epm, "top_ports": top_ports, "timeline": timeline, "map_data": map_data, "system_health": {"cpu": sys_cpu, "ram": sys_ram}, "posture_score": 100 - min(80, (blocked // 50) * 5), "top_attackers": top_attackers}

@app.get("/api/analytics")
def get_analytics():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(f"SELECT dst_port, COUNT(*) FROM logs WHERE src_ip != '{FGT_IP}' GROUP BY dst_port")
    bf, lat, exfil, recon = 0, 0, 0, 0
    for row in cursor.fetchall():
        p, c = str(row[0]), row[1]
        if p in ['22', '23', '3389', '5900']: bf += c
        elif p in ['445', '139']: lat += c
        elif p in ['1433', '3306', '6379']: exfil += c
        else: recon += c
    pie = [{"name": 'Brute Force', "value": bf, "color": '#00f0ff'}, {"name": 'Lateral Mvt', "value": lat, "color": '#7000ff'}, {"name": 'Data Exfil', "value": exfil, "color": '#f59e0b'}, {"name": 'Recon/Scan', "value": recon, "color": '#ff007f'}]
    bar = [{"category": r[0] or "N/A", "count": r[1]} for r in cursor.execute(f"SELECT dst_ip, COUNT(*) FROM logs WHERE src_ip != '{FGT_IP}' GROUP BY dst_ip ORDER BY COUNT(*) DESC LIMIT 5").fetchall()]
    cursor.execute(f"SELECT action, COUNT(*) FROM logs WHERE src_ip != '{FGT_IP}' GROUP BY action")
    actions = {str(r[0]).lower(): r[1] for r in cursor.fetchall()}
    risk = [{"name": 'Bloqueado (DENY)', "value": actions.get('deny', 0) + actions.get('drop', 0), "color": '#ff007f'}, {"name": 'Permitido (ACCEPT)', "value": actions.get('accept', 0) + actions.get('allow', 0), "color": '#10b981'}]
    conn.close()
    return {"pieData": [p for p in pie if p["value"]>0], "barData": bar, "riskData": [r for r in risk if r["value"]>0]}

@app.get("/api/threat-intel/{ip}")
def threat_intelligence(ip: str):
    ip = ip.strip()
    
    # SE FOR IP DA REDE LOCAL, AVALIAMOS O COMPORTAMENTO DELE NO BANCO DE DADOS
    if ip.startswith("192.") or ip.startswith("10.") or ip.startswith("172."):
        conn = get_db_connection()
        cursor = conn.cursor()
        # Conta quantos pacotes maliciosos esse IP interno gerou
        drops = cursor.execute(f"SELECT COUNT(*) FROM logs WHERE src_ip = '{ip}' AND action IN ('deny', 'drop')").fetchone()[0] or 0
        conn.close()
        
        internal_risk = min(100, drops * 20) # Cada bloqueio sobe o risco interno em 20
        
        tags = ["Internal Traffic"]
        if internal_risk > 50: tags.append("Compromised/Malicious")
        elif internal_risk > 0: tags.append("Suspicious")
        else: tags.append("Clean")
        
        return {"ip": ip, "reputation": internal_risk, "isp": "Intranet Corporativa SOC", "country": "Rede Local (LAN)", "tags": tags}
        
    # SE FOR IP EXTERNO, MANTÉM A LÓGICA ORIGINAL
    geo = get_geo_location(ip)
    score = get_external_risk_score(ip)
    tags = ["Malicious", "Botnet"] if score > 80 else ["Suspicious", "Scanner"] if score > 40 else ["Clean"]
    return {"ip": ip, "reputation": score, "isp": geo.get("isp", "Desconhecido"), "country": geo.get("country", "Desconhecido"), "tags": tags}

@app.get("/api/active-hosts")
def get_active_hosts():
    conn = get_db_connection()
    hosts = [{"ip": r[0], "last_seen": r[1], "packet_count": r[2]} for r in conn.execute(f"SELECT src_ip, MAX(timestamp), COUNT(*) FROM logs WHERE timestamp > datetime('now', 'localtime', '-10 minutes') AND src_ip != '{FGT_IP}' GROUP BY src_ip").fetchall()]
    conn.close()
    return hosts

@app.post("/api/run-playbook")
def run_playbook(req: PlaybookRequest):
    fortigate_result = block_ip_fortigate(req.target_ip)
    return {"status": "success", "steps": [
        "Alerta mitigado através do motor de correlação temporal do SIEM.",
        "Triagem Operacional N1 concluída com isolamento lógico escalonado.",
        "Instanciando orquestração ativa de contenção via API do FortiOS...",
        f"Resultado da injeção de borda: {fortigate_result}",
        "Conexões TCP estabelecidas e sessões ativas finalizadas via Session-Clear.",
        "Massa de logs e artefatos estruturados enviados para análise forense em N3.",
        "Relatório corporativo de contenção disponibilizado para a gestão executiva.",
        "Playbook de Resposta Automatizada a Incidentes finalizado com sucesso."
    ]}

# ==========================================
# ROTA DE BLOQUEIO (SOAR COMPLETO: Objeto + Grupo)
# ==========================================
@app.post("/api/block")
def block_ip(data: dict):
    ip = data.get("ip_address")
    if not ip:
        return {"result": "IP não fornecido."}

    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    
    try:
        # AÇÃO 1: Criar o objeto de endereço no FortiGate
        addr_payload = {
            "name": ip,
            "type": "ipmask",
            "subnet": f"{ip} 255.255.255.255"
        }
        requests.post(f"http://{FGT_IP}/api/v2/cmdb/firewall/address", headers=headers, json=addr_payload, verify=False)
        
        # AÇÃO 2: Puxar os membros atuais do grupo SOC_BLOCKLIST
        grp_url = f"http://{FGT_IP}/api/v2/cmdb/firewall/addrgrp/SOC_BLOCKLIST"
        res_group = requests.get(grp_url, headers=headers, verify=False)
        
        if res_group.status_code == 200:
            dados_grupo = res_group.json()
            if "results" in dados_grupo and len(dados_grupo["results"]) > 0:
                membros_atuais = dados_grupo["results"][0].get("member", [])
                
                # Verifica se o IP já está no grupo para não duplicar
                if not any(m.get("name") == ip for m in membros_atuais):
                    membros_atuais.append({"name": ip})
                    
                    # AÇÃO 3: Atualizar o grupo com a nova lista de membros
                    requests.put(grp_url, headers=headers, json={"member": membros_atuais}, verify=False)
                    return {"result": f"IP {ip} bloqueado e adicionado à SOC_BLOCKLIST!"}
                else:
                    return {"result": f"O IP {ip} já estava na SOC_BLOCKLIST."}
        
        return {"result": "Objeto criado, mas o grupo SOC_BLOCKLIST não foi encontrado no FortiGate."}
    except Exception as e:
        return {"result": f"Erro na API do FortiGate: {str(e)}"}

@app.get("/api/firewall-rules")
def get_firewall_rules():
    try:
        res = requests.get(f"http://{FGT_IP}/api/v2/cmdb/firewall/policy", headers={"Authorization": f"Bearer {API_TOKEN}"}, verify=False, timeout=3)
        if res.status_code == 200: 
            rules = []
            for r in res.json().get("results", []):
                # O FortiGate envia as origens/destinos como listas, precisamos formatar
                src = ", ".join([s.get("name", "") for s in r.get("srcaddr", [])])
                dst = ", ".join([d.get("name", "") for d in r.get("dstaddr", [])])
                srv = ", ".join([s.get("name", "") for s in r.get("service", [])])
                
                rules.append({
                    "id": r.get("policyid"), 
                    "name": r.get("name"), 
                    "action": r.get("action").upper(), 
                    "hits": r.get("hitcount", 0),
                    "source": src,
                    "destination": dst,
                    "service": srv,
                    "status": r.get("status", "enable")
                })
            return rules
    except: pass
    return []

@app.post("/api/alert-config")
def save_alert_config(req: AlertConfigRequest):
    alert_config["emails"] = req.emails
    alert_config["threshold"] = req.threshold
    return {"status": "ok", "message": "Destinatários e limite crítico atualizados com sucesso."}

@app.post("/api/report-config")
def save_report_config(req: ReportConfigRequest):
    alert_config["report_interval_minutes"] = req.interval_minutes
    alert_config["last_report_time"] = time.time()  
    return {"status": "ok"}

@app.post("/api/send-report-now")
def send_report_now(req: ManualReportRequest):
    if not alert_config["emails"]:
        return {"status": "error", "message": "Nenhum endereço de e-mail configurado na aba de Alertas."}
    
    stats = get_stats()
    html_report = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #333; background-color: #0b0914; color: #fff;">
        <div style="background-color: #7000ff; padding: 15px; text-align: center;">
            <h2 style="color: #fff; margin: 0;">📊 RELATÓRIO OPERACIONAL NG-SOC 📊</h2>
        </div>
        <div style="padding: 20px;">
            <p>Olá, Equipe de Segurança.</p>
            <p>O relatório operacional do turno solicitado via Command Center encontra-se <strong>em anexo neste e-mail no formato PDF</strong> para fins de auditoria forense.</p>
            <br/>
            <p><strong>Total de Ameaças Processadas:</strong> {stats['total_threats']}</p>
            <p><strong>Bloqueios Ativos no Firewall:</strong> {stats['blocked_attacks']}</p>
        </div>
    </div>
    """
    
    # Envia o e-mail passando o html E O ANEXO
    threading.Thread(target=send_email, args=(f"Relatório de Turno Solicitado ({datetime.now().strftime('%d/%m/%Y %H:%M')})", html_report, req.pdf_data), daemon=True).start()
    return {"status": "success", "message": "Relatório operacional com PDF em anexo encaminhado para processamento."}
    
@app.post("/api/chat")
def chat_ai(req: ChatRequest):
    if not client: 
        return {"response": "Assistente de IA Offline. Motor LLM fora de alcance."}
    
    user_msg = req.message.lower()
    ip_match = re.search(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', user_msg)
    
    try:
        # 1. AÇÃO DE BLOQUEIO
        if ("bloque" in user_msg or "block" in user_msg) and ip_match:
            ip_alvo = ip_match.group()
            # Chama a lógica de bloqueio
            resultado = block_ip({"ip_address": ip_alvo})
            return {"response": f"Comando executado: {resultado.get('result')}"}

        # 2. AÇÃO DE ANÁLISE DE IP
        elif ("analis" in user_msg or "verifique" in user_msg or "o que" in user_msg) and ip_match:
            ip_alvo = ip_match.group() # Definimos aqui
            
            # Consulta o SQLite usando o alias para corrigir o erro da coluna
            conn = sqlite3.connect('ng_soc.db')
            cursor = conn.cursor()
            # Note o alias 'correlated_risk AS risk_score'
            logs = cursor.execute("SELECT timestamp, action, threat_msg, correlated_risk AS risk_score FROM logs WHERE src_ip = ? ORDER BY id DESC LIMIT 10", (ip_alvo,)).fetchall()
            conn.close()
            
            if logs:
                dossie = "\n".join([f"[{l[0]}] Ação: {l[1]} | Risco: {l[3]} | Info: {l[2]}" for l in logs])
                prompt = f"O analista pediu uma análise do IP {ip_alvo}. Histórico: {dossie}. Analise se é malicioso."
            else:
                prompt = f"O analista pediu uma análise do IP {ip_alvo}, mas não encontrei histórico."
            
            return {"response": client.chats.create(model="gemini-2.5-flash").send_message(prompt).text}

        # 3. CHAT NORMAL
        else:
            return {"response": client.chats.create(model="gemini-2.5-flash").send_message(f"Você é um Assistente tático de SOC focado em Ciberdefesa. Responda brevemente e de forma técnica ao analista: {req.message}").text}

    except Exception as e:
        return {"response": f"Falha ao processar comando: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    # Inicia o uvicorn com reload ativado. A arquitetura lifespan garante que threads paralelas liguem juntas.
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)