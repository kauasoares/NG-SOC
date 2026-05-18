import sqlite3
import random
import time
from datetime import datetime

# --- CONFIGURAÇÃO DA AMEAÇA ---
# Escolha o IP do seu atacante aqui (O painel vai focar só nele)
ip_atacante = "187.16.2.60"

# Nossos servidores internos e portas que continuam sendo sorteados
ips_destino = ["192.168.158.130"] 
portas = [80, 443, 22, 3389, 445]
acoes = ["deny", "drop", "accept"]

print("======================================================")
print(f"🔥 INICIANDO INJEÇÃO DE LOGS (ATACANTE FOCADO: {ip_atacante}) 🔥")
print("======================================================\n")

while True:
    conn = sqlite3.connect('ng_soc.db')
    cursor = conn.cursor()
    
    # Garante que a tabela está correta
    cursor.execute('''CREATE TABLE IF NOT EXISTS logs 
                      (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, src_ip TEXT, dst_ip TEXT, dst_port INTEGER, action TEXT)''')
    
    agora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # A Mágica: A origem é SEMPRE o nosso atacante fixo
    src = ip_atacante 
    
    # O resto continua aleatório para simular um "Port Scan" nos seus servidores
    dst = random.choice(ips_destino) 
    porta = random.choice(portas)
    acao = random.choice(acoes)
    
    # Insere no banco
    cursor.execute("INSERT INTO logs (timestamp, src_ip, dst_ip, dst_port, action) VALUES (?, ?, ?, ?, ?)",
                   (agora, src, dst, porta, acao))
    
    conn.commit()
    conn.close()
    
    print(f"[{agora}] Log injetado: {src} -> {dst} na porta {porta} | Ação: {acao.upper()}")
    time.sleep(2)