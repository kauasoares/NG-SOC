import { useState, useEffect } from 'react';
import axios from 'axios';
import Globe from 'react-globe.gl';
import { ShieldAlert, Server, Activity, TerminalSquare, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const API_URL = 'http://localhost:8000/api';

export default function App() {
  const [stats, setStats] = useState({ total_threats: 0, blocked_attacks: 0, top_ports: [], timeline: [], map_data: [] });
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState({ api: 'A carregar...', ai_engine: 'A carregar...' });
  
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'ai', text: '>_ SOAR OPERACIONAL. COPILOTO IA ATIVO.' }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const fetchData = async () => {
    try {
      const statusRes = await axios.get(`${API_URL}/status`);
      setStatus(statusRes.data);

      const statsRes = await axios.get(`${API_URL}/stats`);
      setStats(statsRes.data);

      const logsRes = await axios.get(`${API_URL}/logs?limit=25`);
      setLogs(logsRes.data.logs);
    } catch (error) {
      console.error("Falha na ligação à API", error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setIsTyping(true);

    try {
      const res = await axios.post(`${API_URL}/chat`, { message: userMsg });
      setChatHistory(prev => [...prev, { role: 'ai', text: res.data.response }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'ai', text: '❌ ERRO DE LIGAÇÃO.' }]);
    }
    setIsTyping(false);
  };

  const handleQuickBlock = async (ip) => {
    if(!window.confirm(`Autorizar bloqueio imediato do IP ${ip} no FortiGate?`)) return;
    try {
      const res = await axios.post(`${API_URL}/block`, { ip_address: ip });
      alert(res.data.result);
      fetchData(); // Força actualização após o bloqueio
    } catch (error) {
      alert("Falha ao comunicar com o firewall.");
    }
  };

  return (
    <div className="min-h-screen p-4 flex flex-col gap-4">
      {/* CABEÇALHO */}
      <header className="flex justify-between items-center border-b border-cyber-neon/30 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-cyber-neon tracking-widest flex items-center gap-3">
            <ShieldAlert size={32} /> THREAT INTELLIGENCE CENTER
          </h1>
          <p className="text-sm text-gray-400">Next-Generation SOC • Geolocalização Activa</p>
        </div>
        <div className="flex gap-4 text-xs font-bold">
          <div className="bg-cyber-panel px-4 py-2 border border-cyber-success/50 text-cyber-success flex items-center gap-2">
            <Server size={16} /> API: {status.api}
          </div>
          <div className="bg-cyber-panel px-4 py-2 border border-cyber-neon/50 text-cyber-neon flex items-center gap-2">
            <Activity size={16} /> IA ENGINE: {status.ai_engine}
          </div>
        </div>
      </header>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-cyber-panel border border-cyber-neon/30 p-4 shadow-[0_0_15px_rgba(0,243,255,0.1)]">
          <p className="text-cyber-neon mb-1">TOTAL THREATS DETECTED</p>
          <p className="text-4xl text-white font-bold">{stats.total_threats}</p>
        </div>
        <div className="bg-cyber-panel border border-cyber-alert/50 p-4 shadow-[0_0_15px_rgba(255,87,34,0.1)]">
          <p className="text-cyber-alert mb-1">ATTACKS BLOCKED</p>
          <p className="text-4xl text-white font-bold">{stats.blocked_attacks}</p>
        </div>
        <div className="bg-cyber-panel border border-cyber-neon/30 p-4">
          <p className="text-cyber-neon mb-1">ACTIVE TARGETS</p>
          <p className="text-4xl text-white font-bold">{stats.top_ports?.length || 0}</p>
        </div>
      </div>

      {/* CONTEÚDO CENTRAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 h-[450px]">
        
        {/* ESQUERDA: Gráficos Empilhados */}
        <div className="flex flex-col gap-4">
          <div className="bg-cyber-panel border border-cyber-neon/30 p-4 flex-1">
            <h2 className="text-cyber-neon font-bold mb-2 text-sm">TARGET PORTS (ALVOS)</h2>
            <ResponsiveContainer width="100%" height="80%">
              <BarChart data={stats.top_ports || []} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="port" type="category" stroke="#00f3ff" width={40} fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#0a192f', borderColor: '#00f3ff' }} />
                <Bar dataKey="count" fill="#ff5722" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-cyber-panel border border-cyber-neon/30 p-4 flex-1">
            <h2 className="text-cyber-neon font-bold mb-2 text-sm">ATTACK TIMELINE</h2>
            <ResponsiveContainer width="100%" height="80%">
              <LineChart data={stats.timeline || []}>
                <XAxis dataKey="time" stroke="#00f3ff" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0a192f', borderColor: '#00f3ff' }} />
                <Line type="monotone" dataKey="attacks" stroke="#ff5722" strokeWidth={2} dot={{ r: 3, fill: '#ff5722' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CENTRO: Globo 3D Georreferenciado */}
        <div className="bg-cyber-panel border border-cyber-neon/30 p-1 flex justify-center items-center overflow-hidden relative">
          <div className="absolute top-2 left-2 text-cyber-neon text-xs font-bold z-10 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> GLOBAL THREAT MAP
          </div>
          <Globe
            width={600}
            height={450}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
            backgroundColor="rgba(0,0,0,0)"
            arcsData={stats.map_data || []}
            arcColor="color"
            arcDashLength={0.5}
            arcDashGap={0.1}
            arcDashAnimateTime={1200}
            arcStroke={1.5}
          />
        </div>

        {/* DIREITA: ChatOps IA */}
        <div className="bg-cyber-panel border border-cyber-neon/30 p-4 flex flex-col relative">
          <h2 className="text-cyber-neon font-bold flex items-center gap-2 mb-4">
            <TerminalSquare size={20} /> AI COPILOT / SOAR
          </h2>
          <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2 text-sm">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`p-3 border ${msg.role === 'ai' ? 'border-cyber-neon/40 text-cyber-neon bg-cyber-neon/5' : 'border-gray-600 text-white bg-gray-800/50'}`}>
                <span className="font-bold">{msg.role === 'ai' ? 'SYS_AI: ' : 'ADMIN: '}</span>
                <span dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
              </div>
            ))}
            {isTyping && <div className="text-cyber-neon animate-pulse">A processar directiva...</div>}
          </div>
          <form onSubmit={handleChat} className="flex gap-2">
            <input 
              type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
              placeholder="Inserir comando tático..." 
              className="flex-1 bg-black border border-cyber-neon/50 text-white p-2 outline-none focus:border-cyber-neon"
            />
            <button type="submit" className="bg-cyber-neon/20 border border-cyber-neon text-cyber-neon px-4 hover:bg-cyber-neon hover:text-black font-bold">
              EXECUTE
            </button>
          </form>
        </div>
      </div>

      {/* TABELA INFERIOR: Logs de Segurança Avançados */}
      <div className="bg-cyber-panel border border-cyber-neon/30 p-4 mt-2">
        <h2 className="text-cyber-neon font-bold mb-4">SECURITY LOGS & QUICK ACTIONS</h2>
        <div className="overflow-x-auto h-[250px] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-cyber-neon border-b border-cyber-neon/30 sticky top-0 bg-cyber-panel z-10">
              <tr>
                <th className="p-2">DATA/HORA</th>
                <th className="p-2">RISK SCORE</th>
                <th className="p-2">ORIGEM (IP)</th>
                <th className="p-2">ALVO</th>
                <th className="p-2">STATUS FIREWALL</th>
                <th className="p-2">ACÇÃO TÁCTICA</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 text-green-400">
                  <td className="p-2">{log.timestamp}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded font-bold text-black ${log.risk_score > 80 ? 'bg-red-500' : log.risk_score > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}>
                      {log.risk_score} / 100
                    </span>
                  </td>
                  <td className="p-2">{log.src_ip}</td>
                  <td className="p-2">{log.dst_port}</td>
                  <td className={`p-2 font-bold ${log.action === 'deny' || log.action === 'drop' ? 'text-red-500' : ''}`}>
                    {log.action.toUpperCase()}
                  </td>
                  <td className="p-2">
                    <button onClick={() => handleQuickBlock(log.src_ip)} className="bg-red-900/40 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white px-3 py-1 rounded text-xs font-bold transition-colors flex items-center gap-1">
                      <AlertTriangle size={14} /> BLOQUEAR
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}