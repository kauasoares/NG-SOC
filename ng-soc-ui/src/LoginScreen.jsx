import React, { useState } from 'react';
import { Shield, Lock } from 'lucide-react';

const LoginScreen = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAuth = (e) => {
    e.preventDefault();
    
    // Credenciais para a demonstração na banca
    // Você pode mudar para o que quiser
    if (username === 'admin' && password === 'senai2026') {
      onLogin();
    } else {
      setError('[!] ACESSO NEGADO: Credenciais não autorizadas.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 font-mono">
      <div className="max-w-md w-full bg-gray-900 border border-emerald-500/30 rounded-lg shadow-[0_0_40px_rgba(16,185,129,0.15)] p-8">
        
        {/* Cabeçalho do Login */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gray-950 border border-emerald-500 flex items-center justify-center rounded-full mb-4 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
            <Shield className="text-emerald-500 w-8 h-8" />
          </div>
          <h1 className="text-3xl text-white font-bold tracking-widest mt-2">NG-SOC</h1>
          <p className="text-emerald-500 text-xs tracking-widest mt-2 border-b border-emerald-500/30 pb-1">
            SISTEMA DE DEFESA ATIVA
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label className="block text-gray-400 text-xs tracking-widest mb-2">OPERATOR ID</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 focus:border-emerald-500 rounded text-emerald-400 px-4 py-3 outline-none transition-colors"
              placeholder="Digite o usuário"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-xs tracking-widest mb-2">PASSPHRASE</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 focus:border-emerald-500 rounded text-emerald-400 px-4 py-3 outline-none transition-colors"
              placeholder="Digite a senha"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-xs p-3 rounded text-center tracking-wider animate-pulse">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold tracking-widest py-3 rounded transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] flex justify-center items-center gap-3"
          >
            <Lock className="w-4 h-4" />
            AUTENTICAR
          </button>
        </form>
        
        <div className="mt-8 text-center">
          <p className="text-gray-600 text-[10px] tracking-widest">
            ACESSO RESTRITO | MONITORAMENTO CONTÍNUO
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;