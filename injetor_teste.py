import sqlite3
import random
from datetime import datetime, timedelta

def injetar_dados_simulados():
    # Conecta ao banco de dados (cria o arquivo se não existir)
    conn = sqlite3.connect('ng_soc.db')
    cursor = conn.cursor()

    # Garante que a tabela existe, caso você ainda não tenha rodado o servidor syslog
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

    print("Gerando tráfego simulado...")

    # Cenários de IPs atacantes
    ip_scanner = "187.16.2.55"  # Simula alguém fazendo um Port Scan externo
    ip_bruteforce = "10.0.0.88" # Simula um IP interno tentando invadir o servidor
    ip_legitimo = "192.168.1.150"

    now = datetime.now()

    # Gera 50 logs de teste
    for i in range(50):
        # Cria timestamps aleatórios para os últimos 60 minutos
        tempo_evento = now - timedelta(minutes=random.randint(1, 60), seconds=random.randint(0, 59))
        str_tempo = tempo_evento.strftime('%Y-%m-%d %H:%M:%S')

        # Randomiza o tipo de ataque
        cenario = random.randint(1, 10)
        
        if cenario <= 5:
            # Simula o Port Scan: Várias portas aleatórias sendo testadas e bloqueadas
            src_ip = ip_scanner
            dst_port = str(random.randint(1024, 8080))
            action = 'deny'
            raw_log = f'date={str_tempo[:10]} time={str_tempo[11:]} devname="FortiGate" type="traffic" level="warning" srcip={src_ip} dstport={dst_port} action="{action}" msg="traffic denied"'
        
        elif cenario <= 8:
            # Simula Força Bruta: Foco em portas críticas como SSH (22) e RDP (3389)
            src_ip = ip_bruteforce
            dst_port = random.choice(['22', '3389'])
            action = 'drop'
            raw_log = f'date={str_tempo[:10]} time={str_tempo[11:]} devname="FortiGate" type="traffic" level="notice" srcip={src_ip} dstport={dst_port} action="{action}" msg="connection dropped"'
        
        else:
            # Tráfego normal de navegação
            src_ip = ip_legitimo
            dst_port = random.choice(['80', '443', '53'])
            action = 'accept'
            raw_log = f'date={str_tempo[:10]} time={str_tempo[11:]} devname="FortiGate" type="traffic" level="notice" srcip={src_ip} dstport={dst_port} action="{action}"'

        cursor.execute('''
            INSERT INTO logs (timestamp, src_ip, dst_port, action, raw_log)
            VALUES (?, ?, ?, ?, ?)
        ''', (str_tempo, src_ip, dst_port, action, raw_log))

    conn.commit()
    conn.close()
    print("✅ 50 registros de ataque e tráfego injetados com sucesso!")

if __name__ == "__main__":
    injetar_dados_simulados()