import sqlite3

conn = sqlite3.connect('ng_soc.db')
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(logs)")
columns = cursor.fetchall()

print("Colunas existentes na tabela 'logs':")
for col in columns:
    print(f"- {col[1]}") # col[1] é o nome da coluna

conn.close()