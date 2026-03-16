import sqlite3
import requests
import urllib3
import json
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from google import genai
from google.genai import types

# Remove avisos SSL do FortiGate
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
load_dotenv()

# --- CONFIGURAÇÕES ---
FGT_IP = "192.168.158.130"
API_TOKEN = "xQtH7yq7nHs38Hpr74Hy7jpqjtry9p" 

try:
    client = genai.Client()
    ia_status = "ONLINE"
except Exception as e:
    client = None
    ia_status = "OFFLINE"

app = FastAPI(title="NG-SOC API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

class BlockRequest(BaseModel):
    ip_address: str

# Cache de Geolocalização (evita bloqueios na API pública)
geo_cache = {}

def get_geo_location(ip):
    if ip in geo_cache:
        return geo_cache[ip]
    
    # Se for IP interno, aponta para a rede local
    if ip.startswith("192.168.") or ip.startswith("10."):
        geo_cache[ip] = {"lat": -23.6666, "lon": -46.5322, "country": "Rede Interna"}
        return geo_cache[ip]
    
    try:
        res = requests.get(f"http://ip-api.com/json/{ip}", timeout=2).json()
        if res.get("status") == "success":
            geo_cache[ip] = {"lat": res["lat"], "lon": res["lon"], "country": res["country"]}
        else:
            geo_cache[ip] = {"lat": 0, "lon": 0, "country": "Desconhecido"}
    except:
        # Simulação de coordenadas em caso de falha na rede
        geo_cache[ip] = {"lat": (hash(ip) % 180) - 90, "lon": (hash(ip) % 360) - 180, "country": "Simulado"}
    
    return geo_cache[ip]

def block_ip_fortigate(ip_address: str) -> str:
    url = f"http://{FGT_IP}/api/v2/cmdb/firewall/address"
    headers = {"Authorization": f"Bearer {API_TOKEN}", "Content-Type": "application/json"}
    object_name = f"SOC_Block_{ip_address.replace('.', '_')}"
    payload = {"name": object_name, "type": "ipmask", "subnet": f"{ip_address} 255.255.255.255", "color": 6}
    
    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload), verify=False, timeout=5)
        if response.status_code == 200:
            return f"Sucesso: IP {ip_address} isolado no FortiGate."
        elif response.status_code == 500 and "duplicate" in response.text.lower():
            return f"Aviso: O IP {ip_address} já estava bloqueado."
        return f"Erro HTTP {response.status_code}"
    except Exception as e:
        return f"Falha no FortiOS: {str(e)}"

chat_session = None
if client:
    chat_session = client.chats.create(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(
            system_instruction="És a inteligência de um SOC. Analisa registos de rede, identifica ameaças de port scanner e bloqueia IPs usando a ferramenta fornecida.",
            temperature=0.2, tools=[block_ip_fortigate]
        )
    )

@app.get("/api/status")
def get_status():
    return {"api": "ONLINE", "database": "ONLINE", "ai_engine": ia_status}

@app.get("/api/logs")
def get_logs(limit: int = 50):
    try:
        conn = sqlite3.connect('ng_soc.db')
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        query = f"SELECT id, timestamp, src_ip, dst_port, action FROM logs WHERE src_ip != '{FGT_IP}' ORDER BY id DESC LIMIT ?"
        cursor.execute(query, (limit,))
        logs = []
        for row in cursor.fetchall():
            d = dict(row)
            # Motor Simulado de Pontuação de Risco (0-100)
            risk_score = min(100, 10 + (hash(d["src_ip"]) % 80))
            if d["action"] in ["deny", "drop"]: 
                risk_score = max(risk_score, 85) # Alto risco se foi bloqueado
            d["risk_score"] = risk_score
            logs.append(d)
        conn.close()
        return {"logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
def get_stats():
    try:
        conn = sqlite3.connect('ng_soc.db')
        cursor = conn.cursor()
        
        cursor.execute(f"SELECT COUNT(*) FROM logs WHERE src_ip != '{FGT_IP}'")
        total_logs = cursor.fetchone()[0]
        
        cursor.execute(f"SELECT COUNT(*) FROM logs WHERE src_ip != '{FGT_IP}' AND action IN ('deny', 'drop')")
        blocked = cursor.fetchone()[0]
        
        cursor.execute(f"SELECT dst_port, COUNT(*) as count FROM logs WHERE src_ip != '{FGT_IP}' GROUP BY dst_port ORDER BY count DESC LIMIT 5")
        top_ports = [{"port": str(row[0]), "count": row[1]} for row in cursor.fetchall()]

        # Agregação de dados para a Timeline de Ataques
        cursor.execute(f"SELECT substr(timestamp, 12, 5) as time, COUNT(*) as count FROM logs WHERE src_ip != '{FGT_IP}' GROUP BY time ORDER BY timestamp DESC LIMIT 8")
        timeline = [{"time": row[0], "attacks": row[1]} for row in cursor.fetchall()][::-1]

        # Extração de IPs únicos para gerar os lasers no Mapa 3D
        cursor.execute(f"SELECT DISTINCT src_ip FROM logs WHERE src_ip != '{FGT_IP}' ORDER BY id DESC LIMIT 15")
        ips = [row[0] for row in cursor.fetchall()]
        map_data = []
        for ip in ips:
            geo = get_geo_location(ip)
            map_data.append({
                "startLat": geo["lat"], "startLng": geo["lon"],
                # Coordenadas do teu laboratório
                "endLat": -23.6666, "endLng": -46.5322,
                "color": "#ff0000" if geo["lat"] != -23.6666 else "#00ff00",
                "ip": ip
            })
        
        conn.close()
        return {
            "total_threats": total_logs,
            "blocked_attacks": blocked,
            "top_ports": top_ports,
            "timeline": timeline,
            "map_data": map_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
def chat_with_copilot(req: ChatRequest):
    if not chat_session: raise HTTPException(status_code=503, detail="IA offline")
    logs_response = get_logs(limit=10)
    prompt = f"[TELEMETRIA RECENTE]: {json.dumps(logs_response['logs'])}\n\n[COMANDO]: {req.message}"
    response = chat_session.send_message(prompt)
    return {"response": response.text}

@app.post("/api/block")
def block_ip_direct(req: BlockRequest):
    # Ação Direta acionada pelo botão [BLOQUEAR] na tabela
    resultado = block_ip_fortigate(req.ip_address)
    return {"result": resultado}