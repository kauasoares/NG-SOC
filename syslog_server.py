import socket
import sqlite3
import re
from datetime import datetime

# 1. Conexão e Criação do Banco de Dados
def setup_database():
    conn = sqlite3.connect('ng_soc.db')
    cursor = conn.cursor()
    # Tabela estruturada para facilitar a leitura no Dashboard
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            src_ip TEXT,
            dst_port TEXT,
            action TEXT,
            raw_log TEXT
        )
    ''')
    conn.commit()
    return conn

# 2. Servidor de Escuta (Syslog)
def start_syslog_server(host='0.0.0.0', port=5140):
    conn = setup_database()
    cursor = conn.cursor()
    
    # Criando o socket UDP (Syslog usa UDP por padrão)
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((host, port))
    
    print(f"[+] Servidor Syslog Ativo. Escutando na porta {port}...")
    
    while True:
        data, addr = sock.recvfrom(4096)
        log_message = data.decode('utf-8', errors='ignore')
        
        # O FortiGate envia logs no formato chave=valor (ex: srcip=192.168.1.10)
        # Usamos Regex para caçar essas informações específicas:
        src_ip_match = re.search(r'srcip=([0-9\.]+)', log_message)
        dst_port_match = re.search(r'dstport=([0-9]+)', log_message)
        action_match = re.search(r'action="?([a-zA-Z\-]+)"?', log_message)
        
        # Se encontrar, guarda o valor. Se não, marca como Desconhecido.
        src_ip = src_ip_match.group(1) if src_ip_match else "Desconhecido"
        dst_port = dst_port_match.group(1) if dst_port_match else "Desconhecido"
        action = action_match.group(1) if action_match else "Desconhecido"
        
        # Ignora logs que não tenham IP de origem (como logs de sistema interno)
        if src_ip != "Desconhecido":
            agora = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            # Inserindo no SQLite
            cursor.execute('''
                INSERT INTO logs (timestamp, src_ip, dst_port, action, raw_log)
                VALUES (?, ?, ?, ?, ?)
            ''', (agora, src_ip, dst_port, action, log_message))
            conn.commit()
            
            print(f"Log -> Origem: {src_ip} | Porta: {dst_port} | Ação do Firewall: {action}")

if __name__ == "__main__":
    start_syslog_server()