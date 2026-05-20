import socket
import time

# O IP real da tua máquina atacante (Kali Linux)
IP_KALI = "172.16.0.2"
SYSLOG_IP = "127.0.0.1"
SYSLOG_PORT = 5140

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

def enviar_log(log):
    sock.sendto(log.encode('utf-8'), (SYSLOG_IP, SYSLOG_PORT))

print("=== INICIANDO SIMULAÇÃO NG-SOC PARA A BANCA ===\n")

print("[+] Fase 1: Tráfego Normal (Reconhecimento Oculto)")
enviar_log(f'date=2026-05-20 time=10:00:00 srcip={IP_KALI} dstip=8.8.8.8 dstport=443 action="accept" app="HTTPS.Browser" msg="Navegacao padrao"')
time.sleep(4) # Espera 4 segundos para o painel respirar

print("[+] Fase 2: Tentativa de Invasão (Brute Force SSH)")
for _ in range(3):
    enviar_log(f'date=2026-05-20 time=10:00:05 srcip={IP_KALI} dstip=192.168.158.130 dstport=22 action="deny" app="SSH.Terminal" msg="Falha de Autenticacao"')
    time.sleep(1)
time.sleep(3)

print("[+] Fase 3: Disparo de Exploit 0-Day (Log4j + Path Traversal)")
enviar_log(f'date=2026-05-20 time=10:00:10 srcip={IP_KALI} dstip=192.168.158.130 dstport=80 action="accept" app="HTTP.Web" msg="Payload malicioso: jndi:ldap://hacker.com/exploit ../../etc/passwd"')

print("\n[!] Simulação concluída! O SOC deve estar a alertar Risco 100.")
print("[!] Ação Recomendada: Execute o Playbook SOAR para mitigar a ameaça.")