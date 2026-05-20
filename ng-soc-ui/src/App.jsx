import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import Globe from 'react-globe.gl';
import {
  ShieldAlert, Server, Activity, TerminalSquare, AlertTriangle,
  Monitor, Bell, FileWarning, X, CheckCircle, Clock, Wifi,
  Mail, Plus, Trash2, Shield, Zap, Search, Target, FileText, Cpu, 
  ListChecks, Download, Eye, Sun, Moon, Lock, User, LogOut, BarChart2, Database, LayoutDashboard, Map, Crosshair, Menu, Send
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend } from 'recharts';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_URL = 'http://localhost:8000/api';

// --- CORES DO TEMA SECURITYONE (NEON DARK) ---
const COLORS = {
  bgBase: '#0b0914',      // Fundo principal
  cardBg: '#151221',      // Fundo dos cards
  cardBorder: '#231f36',  // Borda dos cards
  pink: '#ff007f',        // Crítico
  cyan: '#00f0ff',        // Baixo / Linhas
  purple: '#7000ff',      // Médio
  amber: '#f59e0b',       // Alto
  green: '#10b981',       // Safe
  textMuted: '#8b8a96',   // Texto secundário
  textWhite: '#ffffff'    // Títulos
};

const PORT_NAMES = {
  '22': 'SSH', '23': 'Telnet', '80': 'HTTP', '443': 'HTTPS',
  '3389': 'RDP', '445': 'SMB', '1433': 'MSSQL', '3306': 'MySQL',
  '21': 'FTP', '53': 'DNS'
};

function classifyThreat(log) {
  const port = String(log.dst_port);
  const action = log.action?.toLowerCase();
  const portName = PORT_NAMES[port] || `Port ${port}`;

  // 1. Força Bruta em serviços remotos (SSH, RDP, Telnet)
  if (['3389', '22', '23', '5900'].includes(port)) {
    return { 
      type: 'Brute Force Attack', label: portName, severity: 'CRITICAL',
      mitreTactic: 'TA0006: Credential Access', mitreTechnique: 'T1110: Brute Force'
    };
  }
  // 2. Movimentação Lateral via SMB/RPC
  if (['445', '139'].includes(port)) {
    return { 
      type: 'Lateral Movement', label: 'SMB Scan', severity: 'HIGH',
      mitreTactic: 'TA0008: Lateral Movement', mitreTechnique: 'T1021: Remote Services'
    };
  }
  // 3. Risco de Exfiltração de Dados em Banco de Dados
  if (['1433', '3306', '5432', '27017', '6379'].includes(port)) {
    return { 
      type: 'Data Exfil Risk', label: portName, severity: 'HIGH',
      mitreTactic: 'TA0009: Collection', mitreTechnique: 'T1119: Automated Collection'
    };
  }
  // 4. Exploração de Aplicações Web (Ataque barrado pelo FW)
  if (['80', '443', '8080'].includes(port) && (action === 'deny' || action === 'drop')) {
    return { 
      type: 'Web Application Exploit', label: portName, severity: 'HIGH',
      mitreTactic: 'TA0001: Initial Access', mitreTechnique: 'T1190: Exploit Public-Facing App'
    };
  }
  // 5. Comportamento Padrão: Varredura de Rede (Nmap/Masscan)
  return { 
    type: 'Reconnaissance Scan', label: portName, severity: 'MEDIUM',
    mitreTactic: 'TA0043: Reconnaissance', mitreTechnique: 'T1046: Network Service Scanning'
  };
}

// ─── COMPONENTES VISUAIS REUTILIZÁVEIS ───
const Panel = ({ children, title, subtitle, className = "", rightAction }) => (
  <div className={`bg-[#151221] border border-[#231f36] rounded-xl p-5 flex flex-col relative overflow-hidden ${className}`}>
    {(title || rightAction) && (
      <div className="flex justify-between items-center mb-4 z-10">
        <div>
          {title && <h3 className="text-white font-bold text-sm tracking-wide">{title}</h3>}
          {subtitle && <p className="text-[#8b8a96] text-[10px] mt-1">{subtitle}</p>}
        </div>
        {rightAction && <div>{rightAction}</div>}
      </div>
    )}
    <div className="flex-1 relative z-10">{children}</div>
  </div>
);

const ProgressBar = ({ percent, colorClass, bgClass = "bg-[#231f36]" }) => (
  <div className={`w-full h-1.5 rounded-full ${bgClass} overflow-hidden`}>
    <div className={`h-full ${colorClass}`} style={{ width: `${percent}%` }}></div>
  </div>
);

const SeverityBadge = ({ severity }) => {
  const isCrit = severity === 'CRITICAL';
  const isHigh = severity === 'HIGH';
  const isMed = severity === 'MEDIUM';
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-[10px] px-2 py-0.5 rounded border font-medium uppercase ${isCrit ? 'text-[#ff007f] border-[#ff007f]/30 bg-[#ff007f]/10' : isHigh ? 'text-[#f59e0b] border-[#f59e0b]/30 bg-[#f59e0b]/10' : isMed ? 'text-[#7000ff] border-[#7000ff]/30 bg-[#7000ff]/10' : 'text-[#00f0ff] border-[#00f0ff]/30 bg-[#00f0ff]/10'}`}>
        {severity}
      </span>
      <div className="flex gap-0.5">
        {[1,2,3,4].map(i => <div key={i} className={`w-1 h-2 rounded-sm ${isCrit ? 'bg-[#ff007f]' : isHigh && i<=3 ? 'bg-[#f59e0b]' : isMed && i<=2 ? 'bg-[#7000ff]' : i===1 ? 'bg-[#00f0ff]' : 'bg-[#231f36]'}`}></div>)}
      </div>
    </div>
  );
};

// ─── COMPONENTE POPUP DE INCIDENTE ───
function IncidentPopup({ incident, onClose, onBlock }) {
  const isCritical = incident.severity === 'CRITICAL';
  useEffect(() => { const t = setTimeout(onClose, 15000); return () => clearTimeout(t); }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 w-96 animate-slide-in">
      <div className={`border ${isCritical ? 'border-[#ff007f]/50 bg-[#ff007f]/10' : 'border-[#f59e0b]/50 bg-[#f59e0b]/10'} backdrop-blur-xl p-5 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.8)]`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap size={18} className={`${isCritical ? 'text-[#ff007f]' : 'text-[#f59e0b]'} animate-pulse`} />
            <span className={`font-bold text-sm ${isCritical ? 'text-[#ff007f]' : 'text-[#f59e0b]'}`}>INCIDENTE {incident.severity}</span>
          </div>
          <button onClick={onClose} className="text-[#8b8a96] hover:text-white"><X size={16} /></button>
        </div>
        <div className="space-y-1 text-sm mb-5">
          <p className="text-white font-bold">{incident.type}</p>
          <p className="text-[#8b8a96]">Origem: <span className="text-[#00f0ff] font-mono">{incident.src_ip}</span></p>
          <p className="text-[#8b8a96]">Alvo: <span className="text-white">{incident.label} → {incident.dst_ip}</span></p>
        </div>
        <button onClick={() => { onBlock(incident.src_ip); onClose(); }} className={`w-full ${isCritical ? 'bg-[#ff007f] hover:bg-[#d6006b]' : 'bg-[#f59e0b] hover:bg-[#d97706]'} text-white text-xs font-bold py-2.5 rounded-lg transition-all shadow-lg`}>
          BLOQUEAR AGORA
        </button>
      </div>
    </div>
  );
}

// ==========================================
// ABA 1: HOME (Risco Dinâmico, Tabela sem L7, Mapa Animado)
// ==========================================
function HomeTab({ stats, incidents }) {
  // O Risco agora é reativo: reflete o alerta mais grave em tempo real
  const maxRecentRisk = incidents.length > 0 ? Math.max(...incidents.slice(0, 5).map(inc => inc.risk_score)) : 0;
  const riskLevel = maxRecentRisk > 0 ? maxRecentRisk : (stats.total_threats > 0 ? 10 : 0);
  const riskPie = [{ name: 'Risk', value: riskLevel, fill: COLORS.pink }, { name: 'Safe', value: 100 - riskLevel, fill: COLORS.cardBorder }];

  // Referência para animar o globo
  const globeRef = useRef();
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 1.2;
    }
  }, []);

  return (
    <div className="grid grid-cols-12 gap-5 h-full">
      {/* COLUNA ESQUERDA */}
      <div className="col-span-12 xl:col-span-3 flex flex-col gap-5">
        <Panel title="Nível de Risco" rightAction={<span className="bg-[#0b0914] text-[#8b8a96] border border-[#231f36] text-[10px] rounded px-2 py-1">Tempo Real</span>}>
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#7000ff]/20 blur-[50px] rounded-full pointer-events-none"></div>
           <div className="h-48 relative flex justify-center items-center mt-2">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie data={riskPie} cx="50%" cy="50%" innerRadius={65} outerRadius={80} startAngle={180} endAngle={0} dataKey="value" stroke="none" />
               </PieChart>
             </ResponsiveContainer>
             <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-[20%] text-center">
                <AlertTriangle size={16} className={`${riskLevel >= 80 ? 'text-[#ff007f] animate-pulse' : riskLevel >= 50 ? 'text-[#f59e0b]' : 'text-[#00f0ff]'} mx-auto mb-1`} />
                <span className="text-4xl font-bold text-white">{riskLevel}%</span>
             </div>
           </div>
           <div className="flex justify-between items-center text-[10px] text-[#8b8a96] mt-4">
              <div className="flex items-center gap-2">
                 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00f0ff]"></span>Baixo</span>
                 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span>Médio</span>
                 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ff007f]"></span>Crítico</span>
              </div>
           </div>
        </Panel>

        <Panel title="Últimos incidentes" className="flex-1" rightAction={<span className="bg-[#0b0914] text-[#8b8a96] border border-[#231f36] text-[10px] rounded px-2 py-1">Live</span>}>
          <div className="overflow-x-auto mt-2 max-h-[350px]">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="text-[#8b8a96] border-b border-[#231f36]">
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium">Risk</th>
                  <th className="pb-3 font-medium">IP Origem</th>
                  <th className="pb-3 font-medium">Assinatura / Evento</th>
                  <th className="pb-3 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {incidents.slice(0, 8).map((log, i) => (
                  <tr key={i} className="border-b border-[#231f36]/50 hover:bg-[#0b0914] transition-colors">
                    <td className="py-3 text-[#8b8a96] text-xs">{log.timestamp.split(' ')[1]}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs ${log.risk_score > 80 ? 'bg-[#ff007f]/20 text-[#ff007f]' : log.risk_score > 40 ? 'bg-[#f59e0b]/20 text-[#f59e0b]' : 'bg-[#10b981]/20 text-[#10b981]'}`}>
                        {log.risk_score}
                      </span>
                    </td>
                    <td className="py-3 text-white">
                       {log.src_ip}
                    </td>
                    <td className="py-3 text-[#8b8a96] text-xs truncate max-w-[150px]" title={log.threat_msg}>{log.threat_msg}</td>
                    <td className={`py-3 text-right uppercase text-xs font-bold ${log.action === 'deny' || log.action === 'drop' ? 'text-[#ff007f]' : 'text-[#10b981]'}`}>{log.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {incidents.length === 0 && <div className="text-center text-[#8b8a96] text-xs py-10">Fila Limpa</div>}
          </div>
        </Panel>
      </div>

      {/* COLUNA CENTRAL */}
      <div className="col-span-12 xl:col-span-6 flex flex-col gap-5">
        <Panel title="Mapa de ataque (Global Threat Map)" className="h-[350px]" rightAction={<span className="text-[10px] text-[#00f0ff] animate-pulse">Live Telemetry</span>}>
           <div className="absolute inset-0 top-12 flex justify-center items-center opacity-90 cursor-move">
             <Globe 
                ref={globeRef}
                width={550} 
                height={320} 
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg" 
                backgroundColor="rgba(0,0,0,0)" 
                showAtmosphere={true}
                atmosphereColor="#7000ff"
                atmosphereAltitude={0.15}
                arcsData={stats.map_data || []} 
                arcColor="color" 
                arcDashLength={0.6} 
                arcDashGap={0.2} 
                arcDashAnimateTime={1500} 
                arcStroke={2} 
                arcAltitude={0.25}
             />
           </div>
        </Panel>
        
        <Panel title="Tendência de Volume de Casos (Ataques por Hora)" className="flex-1">
          <div className="flex gap-6 mb-4 text-xs">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#00f0ff]"></span>Volume <span className="text-white font-bold ml-1 text-lg">{stats.total_threats}</span></div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#ff007f]"></span>Bloqueados <span className="text-white font-bold ml-1 text-lg">{stats.blocked_attacks}</span></div>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.timeline} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00f0ff" stopOpacity={0.3}/><stop offset="95%" stopColor="#00f0ff" stopOpacity={0}/></linearGradient>
                <linearGradient id="colorBlock" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff007f" stopOpacity={0.4}/><stop offset="95%" stopColor="#ff007f" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#231f36" />
              <XAxis dataKey="time" stroke="#8b8a96" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis stroke="#8b8a96" fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{backgroundColor: '#0b0914', borderColor: '#231f36', color: '#fff'}} />
              <Area type="monotone" dataKey="attacks" name="Volume Total" stroke="#00f0ff" strokeWidth={3} fillOpacity={1} fill="url(#colorVol)" />
              <Area type="monotone" dataKey="blocked" name="Drops (FW)" stroke="#ff007f" strokeWidth={3} fillOpacity={1} fill="url(#colorBlock)" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* COLUNA DIREITA */}
      <div className="col-span-12 xl:col-span-3 flex flex-col gap-5">
        <Panel title="Top IPs Atacantes (Origem)" rightAction={<span className="text-xs font-bold text-white">{stats.epm} EPM</span>}>
          <div className="space-y-5 mt-4">
            {stats.top_attackers?.map((c, i) => {
               const colors = ['bg-[#ff007f]', 'bg-[#7000ff]', 'bg-[#00f0ff]', 'bg-[#f59e0b]'];
               return (
                 <div key={i}>
                   <div className="flex justify-between text-xs mb-1.5"><span className="text-white font-mono">{c[0]}</span><span className="text-[#8b8a96] font-mono">{c[1]} drops</span></div>
                   <ProgressBar percent={90 - (i*15)} colorClass={colors[i%4]} />
                 </div>
               )
            })}
            {(!stats.top_attackers || stats.top_attackers.length === 0) && <div className="text-xs text-[#8b8a96] text-center mt-5">Aguardando telemetria...</div>}
          </div>
        </Panel>

        <Panel title="Top Portas Alvo (Firewall)" className="flex-1">
           <div className="flex justify-between text-[10px] text-[#8b8a96] mb-3 pb-2 border-b border-[#231f36]"><span>Porta / Serviço</span><span>Hits</span></div>
           <div className="space-y-4">
             {stats.top_ports?.map((p, i) => (
               <div key={i} className="flex justify-between items-center">
                 <div className="w-2/3">
                    <span className="text-xs text-white block mb-1 font-mono">Porta {p.port} ({PORT_NAMES[p.port] || 'Outro'})</span>
                    <div className="flex h-1.5 rounded-sm overflow-hidden">
                       <div className="bg-[#7000ff] h-full" style={{width: `${Math.min(100, (p.count/500)*100)}%`}}></div>
                    </div>
                 </div>
                 <span className="text-xs font-bold text-[#00f0ff] font-mono">{p.count}</span>
               </div>
             ))}
           </div>
        </Panel>
      </div>
    </div>
  );
}

// ==========================================
// ABA 2: NÍVEL DE RISCO (Corrigida)
// ==========================================
function RiskTab({ stats, hosts }) {
  const [data, setData] = useState({ pieData: [], riskData: [], barData: [] });
  const [recentLogs, setRecentLogs] = useState([]);
  
  useEffect(() => { 
    axios.get(`${API_URL}/analytics`).then(res => setData(res.data)).catch(() => {});
    axios.get(`${API_URL}/logs?limit=5`).then(res => setRecentLogs(res.data.logs || [])).catch(() => {});
  }, []);

  const crits = stats.blocked_attacks;
  const altos = Math.floor(stats.total_threats * 0.15);
  const medios = Math.floor(stats.total_threats * 0.25);
  const baixos = stats.total_threats - crits - altos - medios;
  
  // Lógica de Risco Real
  const maxRecentRisk = recentLogs.length > 0 ? Math.max(...recentLogs.map(inc => inc.risk_score)) : 0;
  const riskLevel = maxRecentRisk > 0 ? maxRecentRisk : (stats.total_threats > 0 ? 10 : 0);

  return (
    <div className="flex flex-col gap-5 h-full">
      <Panel className="flex-none">
        <div className="grid grid-cols-12 gap-6 items-center">
          <div className="col-span-3">
             <h3 className="text-white font-bold text-sm mb-4">Nível de alertas<br/>na base de dados</h3>
             <div className="text-4xl font-bold text-white">{stats.total_threats} <span className="text-sm font-normal text-[#8b8a96]">totais</span></div>
             <p className="text-[10px] text-[#ff007f] mt-1">+ Telemetria em tempo real</p>
          </div>
          
          <div className="col-span-5 flex gap-4">
             {Object.entries({Crítico: [crits, '#ff007f'], Alto: [altos, '#f59e0b'], Médio: [medios, '#7000ff'], Baixo: [baixos, '#00f0ff']}).map(([k, v], i) => (
                <div key={i} className="bg-[#0b0914] border border-[#231f36] p-4 rounded-xl flex-1 flex flex-col items-center">
                  <span className={`text-[10px] px-2 py-0.5 rounded border bg-opacity-10 mb-2`} style={{color: v[1], borderColor: `${v[1]}50`, backgroundColor: `${v[1]}15`}}>{k}</span>
                  <span className="text-2xl font-bold text-white font-mono">{v[0] > 0 ? v[0] : 0}</span>
                </div>
             ))}
          </div>

          <div className="col-span-4 relative flex justify-center items-center h-40">
             <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 ${riskLevel >= 80 ? 'bg-[#ff007f]/20' : 'bg-[#00f0ff]/10'} blur-[50px] rounded-full pointer-events-none`}></div>
             <ResponsiveContainer width="100%" height="100%">
               <PieChart><Pie data={[{value: riskLevel, fill: riskLevel >= 80 ? '#ff007f' : riskLevel >= 50 ? '#f59e0b' : '#00f0ff'}, {value: 100-riskLevel, fill: '#231f36'}]} cx="50%" cy="50%" innerRadius={60} outerRadius={75} startAngle={180} endAngle={0} dataKey="value" stroke="none" /></PieChart>
             </ResponsiveContainer>
             <div className="absolute top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <span className="text-[10px] text-[#8b8a96] uppercase tracking-widest block mb-1">Score de Risco</span>
                <span className="text-4xl font-bold text-white">{riskLevel}%</span>
             </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-3 gap-5 flex-1">
        <Panel title="Ameaças por Categoria (Portas)">
           <div className="flex justify-between text-[10px] text-[#8b8a96] mb-3 pb-2 border-b border-[#231f36]"><span>Categoria</span><span>Alertas</span></div>
           <div className="space-y-4">
             {data.pieData.map((a, i) => (
               <div key={i} className="flex justify-between items-center">
                 <span className="text-xs text-white flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{backgroundColor: a.color}}></span>{a.name}</span>
                 <span className="text-xs text-white font-bold">{a.value}</span>
               </div>
             ))}
           </div>
        </Panel>

        <Panel title="Top Ativos Alvo (Distribuição)">
           <div className="flex justify-between text-[10px] text-[#8b8a96] mb-3 pb-2 border-b border-[#231f36]"><span>IP Destino</span><span>Volume de Ataque</span></div>
           <div className="space-y-4">
             {data.barData.map((a, i) => (
               <div key={i} className="relative bg-[#0b0914] rounded-md h-8 flex items-center overflow-hidden border border-[#231f36]">
                 <div className="absolute top-0 left-0 h-full bg-[#7000ff] opacity-20" style={{width: `${Math.min(100, (a.count/1000)*100)}%`}}></div>
                 <div className="w-full flex justify-between px-3 z-10 relative">
                   <span className="text-xs text-white font-mono">{a.category}</span>
                   <span className="text-xs font-bold text-[#00f0ff]">{a.count}</span>
                 </div>
               </div>
             ))}
           </div>
        </Panel>

        <div className="flex flex-col gap-5">
           <Panel title="Ações do FortiGate" className="flex-1">
             <div className="flex items-center gap-6 h-full">
               <div className="w-24 h-24 relative">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart><Pie data={data.riskData} cx="50%" cy="50%" innerRadius={30} outerRadius={40} dataKey="value" stroke="none"><Cell fill="#ef4444"/><Cell fill="#10b981"/></Pie></PieChart>
                 </ResponsiveContainer>
               </div>
               <div>
                 <div className="text-[10px] text-[#8b8a96] space-y-2">
                    {data.riskData.map((r,i) => <div key={i}><span style={{color: r.color}}>●</span> {r.name}: <strong className="text-white">{r.value}</strong></div>)}
                 </div>
               </div>
             </div>
           </Panel>

           <Panel title="Controle de incidentes" className="flex-1">
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={stats.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#231f36" />
                 <XAxis dataKey="time" stroke="#8b8a96" fontSize={10} axisLine={false} tickLine={false} />
                 <YAxis stroke="#8b8a96" fontSize={10} axisLine={false} tickLine={false} />
                 <Tooltip contentStyle={{backgroundColor: '#0b0914', borderColor: '#231f36'}} />
                 <Line type="monotone" dataKey="attacks" stroke="#ff007f" strokeWidth={2} dot={{r:3, fill:'#ff007f'}} />
                 <Line type="monotone" dataKey="blocked" stroke="#7000ff" strokeWidth={2} dot={{r:3, fill:'#7000ff'}} />
               </LineChart>
             </ResponsiveContainer>
           </Panel>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// ABA 3: MAPA DE ATAQUE (Animado e Interativo)
// ==========================================
function MapTab({ stats, onBlock }) {
  const [data, setData] = useState({ pieData: [] });
  const globeRef = useRef();

  useEffect(() => { 
    axios.get(`${API_URL}/analytics`).then(res => setData(res.data)).catch(() => {}); 
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 2.0; // Roda um pouco mais rápido aqui para dar impacto
    }
  }, []);

  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden bg-[#0b0914] border border-[#231f36]">
      <div className="absolute inset-0 flex justify-center items-center opacity-90 cursor-move">
         <Globe 
            ref={globeRef}
            width={1000} 
            height={700} 
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg" 
            backgroundColor="rgba(0,0,0,0)" 
            arcsData={stats.map_data || []} 
            arcColor="color" 
            arcDashLength={0.4} 
            arcDashGap={0.2} 
            arcDashAnimateTime={1000} 
            arcStroke={2} 
            arcAltitude={0.3} // Aumentado para as linhas saltarem mais do globo
            showAtmosphere={true} 
            atmosphereColor="#ff007f"
            atmosphereAltitude={0.2}
         />
      </div>

      <div className="absolute top-5 left-5 bottom-5 w-72 flex flex-col gap-5 z-10 pointer-events-none">
        <Panel title="Top Portas Atacadas" className="bg-[#151221]/80 backdrop-blur-md pointer-events-auto shadow-2xl">
           <div className="space-y-4 mt-2">
             {stats.top_ports?.map((a, i) => {
               const colors = ['bg-[#ff007f]', 'bg-[#7000ff]', 'bg-[#00f0ff]', 'bg-[#f59e0b]'];
               return (
                 <div key={i}>
                   <div className="flex justify-between text-xs text-[#8b8a96] mb-1"><span className="text-white">Porta {a.port}</span><span className="font-mono">{a.count}</span></div>
                   <ProgressBar percent={90-(i*15)} colorClass={colors[i%4]} />
                 </div>
               )
             })}
           </div>
        </Panel>
        <Panel title="Top Ameaças por tipo" className="bg-[#151221]/80 backdrop-blur-md flex-1 pointer-events-auto flex items-center justify-center shadow-2xl">
           <div className="flex items-center gap-4 w-full">
             <div className="w-20 h-20 relative">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart><Pie data={data.pieData} cx="50%" cy="50%" innerRadius={25} outerRadius={35} dataKey="value" stroke="none"><Cell fill="#00f0ff"/><Cell fill="#7000ff"/><Cell fill="#f59e0b"/><Cell fill="#ff007f"/></Pie></PieChart>
               </ResponsiveContainer>
             </div>
             <div className="text-[10px] text-[#8b8a96] space-y-1">
                {data.pieData.map((p, i) => <div key={i}><span style={{color: p.color}}>■</span> {p.name.split(' ')[0]}</div>)}
             </div>
           </div>
        </Panel>
      </div>

      <div className="absolute top-5 right-5 w-72 flex flex-col gap-5 z-10 pointer-events-none">
         <Panel title="Top IPs Atacantes" className="bg-[#151221]/80 backdrop-blur-md pointer-events-auto shadow-2xl">
            <div className="space-y-4 mt-2">
              {stats.top_attackers?.map((p, i) => {
                const colors = ['bg-[#ff007f]', 'bg-[#7000ff]', 'bg-[#00f0ff]', 'bg-[#f59e0b]'];
                return (
                 <div key={i}>
                   <div className="flex justify-between text-xs text-white mb-1"><span className="font-mono">{p[0]}</span><span className="text-[#8b8a96]">{p[1]}</span></div>
                   <ProgressBar percent={90 - (i*15)} colorClass={colors[i%4]} />
                 </div>
                )
              })}
            </div>
         </Panel>

         <Panel title="Gravidade da ameaça" className="bg-[#151221]/80 backdrop-blur-md pointer-events-auto shadow-2xl">
            <div className="text-3xl font-bold text-white mb-4">{stats.blocked_attacks} <span className="text-xs text-[#8b8a96] font-normal">Bloqueios Críticos</span></div>
            <div className="space-y-3 text-xs">
               <div className="flex justify-between text-[#8b8a96]"><span><span className="text-[#ff007f]">●</span> Drops de Firewall</span><span className="text-[#ff007f]">{stats.blocked_attacks}</span></div>
               <div className="flex justify-between text-[#8b8a96]"><span><span className="text-[#00f0ff]">●</span> Pacotes Permitidos</span><span className="text-[#00f0ff]">{stats.total_threats - stats.blocked_attacks}</span></div>
            </div>
         </Panel>
      </div>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[600px] bg-[#151221]/90 backdrop-blur-md border border-[#231f36] rounded-xl p-4 z-10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
         <h4 className="text-xs text-white flex items-center justify-center gap-2 mb-3"><span className="text-[#ff007f] animate-pulse">((•))</span> Painel de Ação Rápida SOC</h4>
         <div className="flex justify-between text-[10px] text-[#8b8a96] px-4 py-2 bg-[#0b0914] rounded-lg">
            <span>Último IP Atacante</span><span>Status</span><span>Ação</span>
         </div>
         {stats.top_attackers && stats.top_attackers[0] && (
           <div className="flex justify-between items-center text-xs text-white px-4 py-3 mt-2 hover:bg-[#231f36] rounded-lg transition-colors">
              <span className="font-mono text-[#00f0ff]">{stats.top_attackers[0][0]}</span>
              <span className="text-[#ff007f] font-bold animate-pulse">Ataque em Curso</span>
              <button onClick={() => onBlock(stats.top_attackers[0][0])} className="bg-[#ff007f] hover:bg-[#d6006b] px-3 py-1 rounded text-[10px] font-bold shadow-[0_0_10px_rgba(255,0,127,0.5)]">SOAR BLOCK</button>
           </div>
         )}
      </div>
    </div>
  );
}

// ─── ABA: ACTIVE HOSTS ───
function ActiveHostsTab({ hosts }) {
  return (
    <div className="bg-[#151221] border border-[#231f36] p-6 rounded-2xl h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold">Inventário de Rede (Active Hosts)</h2>
        <span className="flex items-center gap-1 text-xs text-[#10b981]"><span className="w-2 h-2 bg-[#10b981] rounded-full animate-pulse"></span> Live</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[#8b8a96] border-b border-[#231f36]">
            <tr><th className="pb-3">IP / Host</th><th className="pb-3">Último Evento</th><th className="pb-3">Pacotes (Logs)</th></tr>
          </thead>
          <tbody>
            {(hosts || []).length === 0 && (<tr><td colSpan={3} className="p-8 text-center text-[#8b8a96]">Nenhum host ativo.</td></tr>)}
            {(hosts || []).map((host, i) => (
              <tr key={i} className="border-b border-[#231f36] hover:bg-[#231f36]/30">
                <td className="py-4 font-mono text-[#00f0ff]">{host.ip}</td>
                <td className="py-4 text-[#8b8a96]">{host.last_seen}</td>
                <td className="py-4 text-white font-bold">{host.packet_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// ABA: POLÍTICAS DO FIREWALL (Visão Corporativa)
// ==========================================
function FirewallRulesTab() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/firewall-rules`)
      .then(res => {
        setRules(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-5 h-full">
      <Panel 
        title="Políticas de Segurança Ativas - FortiGate Core" 
        rightAction={<span className="bg-[#0b0914] text-[#00f0ff] border border-[#231f36] text-[10px] rounded px-2 py-1 animate-pulse font-mono">Sincronizado via API</span>}
      >
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="text-[#8b8a96] border-b border-[#231f36] text-xs uppercase tracking-wider">
                <th className="pb-3 font-medium">ID</th>
                <th className="pb-3 font-medium">Nome da Regra</th>
                <th className="pb-3 font-medium">Origem (Source)</th>
                <th className="pb-3 font-medium">Destino (Destination)</th>
                <th className="pb-3 font-medium">Serviço</th>
                <th className="pb-3 font-medium">Ação</th>
                <th className="pb-3 font-medium">Hits (Contador)</th>
                <th className="pb-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {rules.map((rule, i) => (
                <tr key={i} className="border-b border-[#231f36]/40 hover:bg-[#0b0914] transition-colors">
                  <td className="py-4 text-[#8b8a96] font-bold">#{rule.id}</td>
                  <td className="py-4 text-white font-sans font-medium">
                    {rule.name || <span className="text-[#524e6e] italic">implicit_deny</span>}
                  </td>
                  <td className="py-4">
                    <span className={`px-2 py-0.5 rounded text-[11px] ${
                      rule.source.includes('SOC_BLOCKLIST') 
                        ? 'bg-[#ff007f]/10 text-[#ff007f] border border-[#ff007f]/30 font-bold animate-pulse' 
                        : 'bg-[#231f36] text-[#c3c2cc]'
                    }`}>
                      {rule.source}
                    </span>
                  </td>
                  <td className="py-4 text-[#c3c2cc]">{rule.destination}</td>
                  <td className="py-4">
                    <span className="text-[#00f0ff] bg-[#00f0ff]/5 px-2 py-0.5 rounded border border-[#00f0ff]/10">
                      {rule.service}
                    </span>
                  </td>
                  <td className="py-4">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      rule.action === 'ACCEPT' ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#ff007f]/10 text-[#ff007f]'
                    }`}>
                      {rule.action}
                    </span>
                  </td>
                  <td className="py-4 text-white font-bold">{rule.hits}</td>
                  <td className="py-4 text-right">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      rule.status === 'enable' ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#8b8a96]/10 text-[#8b8a96]'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${rule.status === 'enable' ? 'bg-[#10b981] animate-pulse' : 'bg-[#8b8a96]'}`}></span>
                      {rule.status === 'enable' ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {loading && (
            <div className="text-center text-[#8b8a96] text-xs py-10 animate-pulse">
              Consultando tabelas CMDB do FortiOS Daemon...
            </div>
          )}
          
          {!loading && rules.length === 0 && (
            <div className="text-center text-[#8b8a96] text-xs py-10">
              Nenhuma regra retornada ou falha na comunicação com o Firewall.
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

// ─── ABA: THREAT INTEL ───
function ThreatIntelTab() {
  const [ip, setIp] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLookup = async () => {
    if (!ip) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/threat-intel/${ip}`);
      setResult(res.data);
    } catch (e) { 
      alert("Falha ao buscar inteligência do IP."); 
    }
    setLoading(false);
  };

  return (
    <div className="bg-[#151221] border border-[#231f36] rounded-2xl p-6 h-full flex flex-col">
      <h2 className="text-lg font-bold text-white mb-4">Threat Intelligence</h2>
      <div className="flex gap-4 max-w-xl mb-6">
        <input type="text" value={ip} onChange={e => setIp(e.target.value)} placeholder="IP Alvo (Ex: 192.168.1.5)" className="flex-1 bg-[#0b0914] border border-[#231f36] focus:border-[#7000ff] text-white p-3 rounded-xl outline-none font-mono" />
        <button onClick={handleLookup} disabled={loading} className="bg-[#7000ff] hover:bg-[#5b00cc] text-white font-bold px-6 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50">
          <Search size={16} /> {loading ? 'Buscando...' : 'Pesquisar'}
        </button>
      </div>
      
      {loading && <div className="text-[#00f0ff] animate-pulse font-mono text-sm">Analisando inteligência e reputação...</div>}
      
      {result && !loading && (
        <div className="bg-[#0b0914] border border-[#231f36] p-6 rounded-xl grid grid-cols-2 gap-6 w-full max-w-4xl">
          <div>
            <p className="text-[#8b8a96] text-xs mb-1 uppercase tracking-widest">Target IP</p>
            <p className="text-2xl text-white font-mono">{result.ip}</p>
            <p className="text-[#00f0ff] mt-4 text-xs uppercase tracking-widest">Localização / ISP</p>
            <p className="text-white">{result.country} — {result.isp}</p>
          </div>
          <div>
            <p className="text-[#8b8a96] text-xs mb-1 uppercase tracking-widest">Risk Reputation Score</p>
            <div className="flex items-end gap-2">
              <span className={`text-4xl font-bold ${result.reputation > 80 ? 'text-[#ff007f]' : result.reputation > 50 ? 'text-[#f59e0b]' : 'text-[#10b981]'}`}>
                {result.reputation}
              </span>
              <span className="text-[#8b8a96] mb-1">/ 100</span>
            </div>
            <p className="text-[#00f0ff] mt-4 text-xs mb-2 uppercase tracking-widest">Threat Tags</p>
            <div className="flex gap-2">
              {(result.tags || []).map(t => (
                <span key={t} className={`px-2 py-1 rounded text-xs font-bold border ${t === 'Clean' ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30' : 'bg-[#ff007f]/10 text-[#ff007f] border-[#ff007f]/30'}`}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ABA: ALERT CONFIG (NOVA VERSÃO COM INTEGRAÇÃO DE API RESEND) ───
function AlertConfigTab() {
  const [emails, setEmails] = useState(() => { 
    try { 
      return JSON.parse(localStorage.getItem('soc_alert_emails') || '[]'); 
    } catch { 
      return []; 
    } 
  });
  const [newEmail, setNewEmail] = useState('');
  const [threshold, setThreshold] = useState(() => localStorage.getItem('soc_threshold') || '85');
  const [isSaving, setIsSaving] = useState(false);

  // Adiciona o e-mail à lista visual e salva no LocalStorage imediatamente
  const addEmail = () => { 
    if(newEmail && newEmail.includes('@')) { 
      const updatedEmails = [...emails, { email: newEmail }]; 
      setEmails(updatedEmails); 
      localStorage.setItem('soc_alert_emails', JSON.stringify(updatedEmails)); 
      setNewEmail(''); 
    } else {
      Swal.fire({ title: 'Aviso', text: 'Insira um endereço de e-mail válido.', icon: 'warning', background: '#151221', color: '#fff' });
    }
  };

  // Remove o e-mail da lista e atualiza o LocalStorage
  const removeEmail = (index) => { 
    const updatedEmails = emails.filter((_, idx) => idx !== index); 
    setEmails(updatedEmails); 
    localStorage.setItem('soc_alert_emails', JSON.stringify(updatedEmails)); 
  };
  
  // Envia a lista completa para o Backend do NG-SOC
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const emailsToSend = emails.map(e => e.email);
      const response = await axios.post(`${API_URL}/alert-config`, { 
        emails: emailsToSend, 
        threshold: parseInt(threshold) 
      });

      if (response.data.status === 'ok') {
        Swal.fire({ 
          title: 'Configuração Salva!', 
          text: 'Os destinatários e gatilhos foram sincronizados com o motor de alertas.', 
          icon: 'success', 
          background: '#151221', 
          color: '#fff', 
          confirmButtonColor: '#7000ff' 
        });
      } else {
        throw new Error("O backend não retornou status ok.");
      }
    } catch (err) {
      console.error("Erro ao salvar configuração:", err);
      Swal.fire({ 
        title: 'Erro de Sincronização', 
        text: 'Não foi possível salvar as configurações no servidor. Verifique a conexão com a API.', 
        icon: 'error', 
        background: '#151221', 
        color: '#fff' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto gap-6 w-full">
      <div className="bg-[#151221] border border-[#231f36] rounded-2xl p-8 flex flex-col shadow-lg">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><Mail size={22} className="text-[#7000ff]"/> Destinatários (CISO / Equipe SOC)</h2>
        <p className="text-[#8b8a96] text-sm mb-6">Adicione os e-mails corporativos que receberão os relatórios automáticos e os alertas de contenção via Resend API.</p>
        
        <div className="flex gap-3 mb-6">
          <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEmail()} placeholder="ciso@empresa.com" className="flex-1 bg-[#0b0914] border border-[#231f36] focus:border-[#7000ff] text-white p-4 rounded-xl outline-none text-sm transition-colors" />
          <button onClick={addEmail} className="bg-[#7000ff] hover:bg-[#5b00cc] text-white px-8 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(112,0,255,0.2)]">ADICIONAR</button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-3 mb-8 max-h-[200px] pr-2">
          {emails.length === 0 ? <p className="text-[#8b8a96] text-sm text-center py-6 border border-dashed border-[#231f36] rounded-xl">Lista vazia. A automação de e-mails está inativa.</p> :
            emails.map((e, i) => (
              <div key={i} className="flex justify-between items-center bg-[#0b0914] p-4 rounded-xl border border-[#231f36] hover:border-[#7000ff]/50 transition-colors group">
                <span className="text-sm text-white font-mono">{e.email}</span>
                <button onClick={() => removeEmail(i)} className="text-[#8b8a96] hover:text-[#ff007f] opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18}/></button>
              </div>
            ))
          }
        </div>

        <div className="border-t border-[#231f36] pt-6 mb-8">
          <div className="flex justify-between items-end mb-4">
             <div>
                <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2"><Activity size={18} className="text-[#ff007f]"/> Gatilho de Alerta Crítico</h2>
                <p className="text-[#8b8a96] text-xs">Ameaças com pontuação superior a esta linha dispararão um aviso imediato.</p>
             </div>
             <div className="bg-[#ff007f]/10 border border-[#ff007f]/30 px-3 py-1.5 rounded-lg text-[#ff007f] font-mono font-bold text-sm">Risk: {threshold}</div>
          </div>
          
          <input type="range" min="50" max="100" value={threshold} onChange={e => {setThreshold(e.target.value); localStorage.setItem('soc_threshold', e.target.value)}} className="w-full accent-[#ff007f]" />
        </div>
        
        <button onClick={handleSave} disabled={isSaving || emails.length === 0} className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-bold px-6 py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          {isSaving ? 'Sincronizando com o Servidor...' : 'SALVAR CONFIGURAÇÕES DE ALERTA'}
        </button>
      </div>
    </div>
  );
}

// ─── NOVA ABA: RELATÓRIOS (COM DISPARO API + PDF EM ANEXO) ───
function ReportsTab({ logs }) {
  const [schedule, setSchedule] = useState(() => localStorage.getItem('soc_report_schedule') || '0');
  const [isSending, setIsSending] = useState(false);
  
  // Função unificada que constrói o PDF para evitar código duplicado
  const buildPdfDoc = () => {
    const doc = new jsPDF();
    doc.setFontSize(20); 
    doc.setTextColor(112, 0, 255); 
    doc.text("NG-SOC: Shift Report", 14, 20);

    const dataToPrint = (logs && logs.length > 0) ? logs : [];

    autoTable(doc, { 
      startY: 30, 
      head: [['Time', 'Risk', 'Action', 'Source IP', 'Port']], 
      body: dataToPrint.slice(0, 30).map(inc => [ 
        inc.timestamp || 'N/A', 
        inc.risk_score || 0, 
        inc.action || 'N/A', 
        inc.src_ip || 'N/A', 
        inc.dst_port || 'N/A' 
      ])
    });
    return doc;
  };

  const handleGeneratePDF = () => {
    try {
      const doc = buildPdfDoc();
      doc.save(`SOC_Report_${new Date().getTime()}.pdf`);
    } catch (e) { alert("Erro ao gerar PDF."); }
  };

  const saveSchedule = async (val) => {
    setSchedule(val);
    localStorage.setItem('soc_report_schedule', val);
    try {
      await axios.post(`${API_URL}/report-config`, { interval_minutes: parseInt(val) });
      Swal.fire({ title: 'Agendado', text: val === '0' ? 'Relatórios automáticos desativados.' : `Os relatórios chegarão no e-mail a cada ${val} minuto(s).`, icon: 'success', background: '#151221', color: '#fff', confirmButtonColor: '#7000ff' });
    } catch (err) {
      Swal.fire({ title: 'Erro', text: 'Falha na comunicação.', icon: 'error', background: '#151221', color: '#fff' });
    }
  };

  const handleSendNow = async () => {
    setIsSending(true);
    try {
      // 1. Gera o PDF silenciosamente
      const doc = buildPdfDoc();
      // 2. Converte para Base64 para enviar no payload do JSON
      const pdfBase64 = doc.output('datauristring').split(',')[1];

      // 3. Dispara para o backend do Python
      const res = await axios.post(`${API_URL}/send-report-now`, { pdf_data: pdfBase64 });
      
      if(res.data.status === "error") {
        Swal.fire({ title: 'Atenção', text: res.data.message, icon: 'warning', background: '#151221', color: '#fff', confirmButtonColor: '#7000ff' });
      } else {
        Swal.fire({ title: 'Enviado!', text: 'O relatório em PDF foi processado e anexado no e-mail com sucesso.', icon: 'success', background: '#151221', color: '#fff', confirmButtonColor: '#10b981' });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ title: 'Erro de Servidor', text: 'Ocorreu uma falha ao tentar enviar o relatório via API.', icon: 'error', background: '#151221', color: '#fff' });
    }
    setIsSending(false);
  };

  return (
    <div className="bg-[#151221] border border-[#231f36] rounded-2xl p-12 flex flex-col items-center justify-center text-center h-full shadow-lg">
      <FileText size={48} className="text-[#00f0ff] mb-4" />
      <h3 className="text-2xl font-bold text-white mb-2">Central de Relatórios</h3>
      <p className="text-[#8b8a96] mb-8 max-w-lg">Exporte a telemetria do turno via PDF offline ou dispare diretamente para a equipe via API de e-mail com anexo.</p>
      
      <div className="bg-[#0b0914] border border-[#231f36] p-6 rounded-xl mb-8 max-w-md w-full shadow-inner">
        <h4 className="text-white font-bold mb-3 flex items-center justify-center gap-2"><Clock size={16} className="text-[#7000ff]" /> Automação de Disparo (Cron)</h4>
        <select value={schedule} onChange={(e) => saveSchedule(e.target.value)} className="w-full bg-[#151221] border border-[#231f36] text-[#00f0ff] p-3 rounded-lg outline-none font-bold text-center appearance-none cursor-pointer">
          <option value="0">Desativado (Modo Manual)</option>
          <option value="1">A cada 1 minuto (Demonstração)</option>
          <option value="60">A cada 1 Hora</option>
          <option value="720">A cada 12 Horas (Fim de Turno)</option>
        </select>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <button onClick={handleGeneratePDF} className="bg-[#231f36] hover:bg-[#2a2542] text-white font-bold px-6 py-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-[#7000ff]/30 w-full sm:w-auto">
          <Download size={18} /> Exportar PDF Local
        </button>
        
        <button onClick={handleSendNow} disabled={isSending} className="bg-[#7000ff] hover:bg-[#5b00cc] text-white font-bold px-6 py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(112,0,255,0.4)] disabled:opacity-50 w-full sm:w-auto">
          <Send size={18} /> {isSending ? 'Anexando PDF...' : 'Enviar PDF por E-mail Agora'}
        </button>
      </div>
    </div>
  );
}

// ─── ABA: PLAYBOOKS SOAR (COM INTEGRAÇÃO MITRE ATT&CK E ZERO-DAY) ───
function PlaybooksTab({ logs, runPlaybook }) {
  // Processa o MITRE ATT&CK e a Heurística Zero-Day em tempo real para os incidentes
  const pendingIncidents = (logs || [])
    .filter(l => l.risk_score >= 50 || l.is_zero_day === 1)
    .map(l => ({ ...l, ...classifyThreat(l) }));

  return (
    <div className="bg-[#151221] border border-[#231f36] rounded-2xl p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Fila de Incidentes & Playbooks</h2>
          <p className="text-xs text-[#00f0ff] font-mono mt-1">MITRE ATT&CK® & Zero-Day Heuristics Active</p>
        </div>
        <span className="bg-[#ff007f]/10 border border-[#ff007f]/30 text-[#ff007f] text-xs font-bold px-3 py-1.5 rounded-lg">
          {pendingIncidents.length} Alertas Requerem Ação
        </span>
      </div>
      
      <div className="space-y-4 overflow-y-auto flex-1 pr-2">
        {pendingIncidents.length === 0 ? (
          <p className="text-[#10b981] text-sm text-center py-10">Sem incidentes pendentes. A rede está segura.</p>
        ) : (
          pendingIncidents.map((inc, i) => (
            <div key={i} className={`bg-[#0b0914] border p-5 rounded-xl flex flex-col md:flex-row justify-between items-center transition-all shadow-lg ${inc.is_zero_day === 1 ? 'border-[#ff007f] shadow-[0_0_15px_rgba(255,0,127,0.2)]' : 'border-[#231f36] hover:border-[#ff007f]/40'}`}>
              <div className="w-full md:w-3/4">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-white text-[10px] font-bold px-2 py-0.5 rounded ${inc.is_zero_day === 1 ? 'bg-[#ff007f] animate-pulse' : inc.risk_score >= 80 ? 'bg-[#ff007f]' : 'bg-[#f59e0b]'}`}>
                    {inc.is_zero_day === 1 ? '🚨 0-DAY DETECTED' : `RISK ${inc.risk_score}`}
                  </span>
                  <span className={`text-base font-bold ${inc.is_zero_day === 1 ? 'text-[#ff007f]' : 'text-white'}`}>
                    {inc.type}
                  </span>
                </div>
                
                <p className="text-xs text-[#8b8a96] font-mono mb-3">
                  Target: <span className="text-white">{inc.dst_ip}:{inc.dst_port}</span> <span className="mx-2 text-[#231f36]">|</span> 
                  Source: <span className="text-[#00f0ff]">{inc.src_ip}</span>
                </p>

                {/* TAGS DO MITRE ATT&CK */}
                <div className="flex flex-wrap gap-2">
                  <span className="bg-[#231f36]/50 border border-[#7000ff]/50 text-[#b5b5b5] text-[10px] px-2 py-1 rounded font-mono flex items-center gap-1">
                    🛡️ <span className="text-[#00f0ff]">{inc.mitreTactic}</span>
                  </span>
                  <span className="bg-[#231f36]/50 border border-[#ff007f]/50 text-[#b5b5b5] text-[10px] px-2 py-1 rounded font-mono flex items-center gap-1">
                    ⚔️ <span className="text-[#ff007f]">{inc.mitreTechnique}</span>
                  </span>
                </div>
              </div>
              
              <div className="mt-4 md:mt-0">
                <button onClick={() => runPlaybook(inc.src_ip)} className={`font-bold px-6 py-3 rounded-lg text-xs transition-all flex items-center gap-2 ${inc.is_zero_day === 1 ? 'bg-[#ff007f] text-white hover:bg-[#d6006b] shadow-[0_0_20px_rgba(255,0,127,0.6)]' : 'bg-[#231f36] hover:bg-[#ff007f] text-[#00f0ff] hover:text-white border border-[#231f36] shadow-[0_0_10px_rgba(255,0,127,0)] hover:shadow-[0_0_15px_rgba(255,0,127,0.4)]'}`}>
                  <Shield size={16}/> INICIAR SOAR
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── TELA DE LOGIN ───
const LoginScreen = ({ onLogin }) => {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');

  const handleAuth = (e) => {
    e.preventDefault();
    if ((user.toLowerCase() === 'admin' || user.toLowerCase() === 'kaua') && pass === 'admin') { onLogin(user); } 
    else { alert('Acesso Negado'); }
  };

return (
    <div className="min-h-screen bg-[#0b0914] flex items-center justify-center font-sans p-4 relative overflow-hidden">
      {/* Brilho de fundo roxo */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#7000ff]/10 rounded-full blur-[120px]"></div>
      
      <div className="max-w-md w-full bg-[#151221] border border-[#231f36] rounded-2xl p-10 shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-[#7000ff]/10 border border-[#7000ff]/30 flex items-center justify-center rounded-2xl mb-4 shadow-[0_0_20px_rgba(112,0,255,0.2)]">
            <ShieldAlert className="text-[#7000ff]" size={40} />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tighter">ELYSIUM<span className="text-[#7000ff]">.</span></h1>
          <p className="text-[#7000ff] text-[10px] mt-2 uppercase tracking-[0.4em] font-bold">Cyber Defense Intelligence</p>
        </div>
        <form onSubmit={handleAuth} className="space-y-4">
          <input type="text" value={user} onChange={e => setUser(e.target.value)} placeholder="Operator ID" className="w-full bg-[#0b0914] border border-[#231f36] focus:border-[#7000ff] text-white p-4 rounded-xl outline-none transition-all placeholder:text-[#8b8a96]" />
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Passphrase" className="w-full bg-[#0b0914] border border-[#231f36] focus:border-[#7000ff] text-white p-4 rounded-xl outline-none transition-all placeholder:text-[#8b8a96]" />
          <button type="submit" className="w-full bg-[#7000ff] hover:bg-[#5b00cc] text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_15px_rgba(112,0,255,0.4)] mt-2"><Lock size={18} className="inline mr-2 mb-1" /> Acessar</button>
        </form>
      </div>
    </div>
  );
};

// ─── APP PRINCIPAL ───
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [popup, setPopup] = useState(null);
  
  const [stats, setStats] = useState({ total_threats: 0, posture_score: 100, active_playbooks: 0, epm: 0, system_health: {cpu:0, ram:0}, timeline: [], map_data: [], top_ports: [], top_attackers: [] });
  const [logs, setLogs] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [status, setStatus] = useState({ api: 'Connecting...' });
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState([{ role: 'ai', text: 'NG-SOC AI Copilot Online. Monitorando telemetria FortiGate.' }]);
  const [isTyping, setIsTyping] = useState(false);

  const seenIds = useRef(new Set());

  const handleLogout = () => { setIsAuthenticated(false); setCurrentUser(null); };

  const runPlaybook = useCallback((ip) => {
    if(!ip) return;
    Swal.fire({ title: 'Ativar SOAR?', text: `Bloquear IP ${ip} no FortiGate?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Executar Bloqueio', confirmButtonColor: '#ff007f', background: '#151221', color: '#fff' })
    .then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await axios.post(`${API_URL}/block`, { ip_address: ip });
          Swal.fire({ title: 'Sucesso', text: res.data.result, icon: 'success', background: '#151221', color: '#fff', confirmButtonColor: '#7000ff' });
        } catch { alert('Erro na comunicação com a API.'); }
      }
    });
  }, []);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [statusRes, statsRes, logsRes, hostsRes] = await Promise.all([ axios.get(`${API_URL}/status`), axios.get(`${API_URL}/stats`), axios.get(`${API_URL}/logs?limit=25`), axios.get(`${API_URL}/active-hosts`) ]);
      setStatus(statusRes.data); setStats(statsRes.data); setHosts(hostsRes.data);
      const newLogs = logsRes.data.logs || []; setLogs(newLogs);
      newLogs.forEach(log => {
        if (seenIds.current.has(log.id)) return;
        seenIds.current.add(log.id);
        if (log.risk_score >= 80) { 
          const incident = { ...log, ...classifyThreat(log) };
          setIncidents(prev => [incident, ...prev].slice(0, 100));
          setPopup(incident);
        }
      });
    } catch (err) {}
  }, [isAuthenticated]);

  useEffect(() => { fetchData(); const interval = setInterval(fetchData, 4000); return () => clearInterval(interval); }, [fetchData]);

  const handleChat = async (e) => {
    e.preventDefault(); if (!chatInput.trim()) return;
    setChatLog(prev => [...prev, { role: 'user', text: chatInput }]); setChatInput(''); setIsTyping(true);
    try {
      const res = await axios.post(`${API_URL}/chat`, { message: chatInput });
      setChatLog(prev => [...prev, { role: 'ai', text: res.data.response }]);
    } catch { setChatLog(prev => [...prev, { role: 'ai', text: 'Error connecting to AI.' }]); }
    setIsTyping(false);
  };

if (!isAuthenticated) return <LoginScreen onLogin={(user) => { setIsAuthenticated(true); setCurrentUser(user); }} />;

  return (
    <div className="min-h-screen bg-[#0b0914] text-[#8b8a96] font-sans flex overflow-hidden selection:bg-[#7000ff]/30">
      
      {/* 🚀 INÍCIO DO ESTILO CUSTOMIZADO DAS BARRAS DE ROLAGEM 🚀 */}
      <style>
        {`
          * { scrollbar-width: thin; scrollbar-color: #ff007f #0b0914; }
          *::-webkit-scrollbar { width: 6px; height: 6px; }
          *::-webkit-scrollbar-track { background: #0b0914; border-radius: 10px; }
          *::-webkit-scrollbar-thumb { background: #ff007f; border-radius: 10px; box-shadow: 0 0 5px rgba(255, 0, 127, 0.5); }
          *::-webkit-scrollbar-thumb:hover { background: #d6006b; }
        `}
      </style>
      {/* 🚀 FIM DO ESTILO CUSTOMIZADO 🚀 */}

      {popup && <IncidentPopup incident={popup} onClose={() => setPopup(null)} onBlock={runPlaybook} />}

      {/* SIDEBAR LATERAL */}
      <aside className="w-[70px] bg-[#151221] border-r border-[#231f36] flex flex-col items-center py-6 z-20">
         <div className="mb-8 flex flex-col items-center gap-1">
          <div className="w-10 h-10 bg-[#7000ff]/10 border border-[#7000ff]/30 flex items-center justify-center rounded-lg shadow-[0_0_15px_rgba(112,0,255,0.2)]">
            <ShieldAlert size={22} className="text-[#7000ff]" />
          </div>
          <span className="text-[8px] font-bold text-[#7000ff] tracking-tighter">ELYSIUM</span>
        
           {[
             { id: 'home', icon: <LayoutDashboard size={20} />, title: 'Dashboard' },
             { id: 'risk', icon: <Activity size={20} />, title: 'Nível de Risco' },
             { id: 'map', icon: <Map size={20} />, title: 'Mapa de Ataque' },
             { id: 'incidents', icon: <Crosshair size={20} />, title: 'Playbooks' },
             { id: 'hosts', icon: <Monitor size={20} />, title: 'Hosts' },
             { id: 'firewall', icon: <Shield size={20} />, title: 'Firewall' },
             { id: 'intel', icon: <Target size={20} />, title: 'Threat Intel' },
             { id: 'alerts', icon: <Bell size={20} />, title: 'Alertas' },
             { id: 'reports', icon: <FileText size={20} />, title: 'Relatórios' }
           ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} title={t.title} className={`p-3 rounded-xl transition-all w-full flex justify-center ${activeTab === t.id ? 'bg-[#7000ff] text-white shadow-[0_0_15px_rgba(112,0,255,0.4)]' : 'text-[#8b8a96] hover:text-white hover:bg-[#231f36]'}`}>
                {t.icon}
              </button>
           ))}
         </div>
         <button onClick={handleLogout} className="mt-auto p-3 text-[#8b8a96] hover:text-[#ff007f] w-full flex justify-center hover:bg-[#231f36] transition-colors"><LogOut size={20}/></button>
      </aside>

      {/* CONTEÚDO PRINCIPAL E CHAT AI */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* HEADER TOP */}
        <header className="h-[70px] border-b border-[#231f36] bg-[#0b0914]/80 backdrop-blur-md flex justify-between items-center px-8 z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[#7000ff] font-black text-2xl tracking-tighter">E</span>
              <h2 className="text-white font-bold text-xl uppercase tracking-[0.2em]">
                ELYSIUM<span className="text-[#7000ff]">.</span>SOC
              </h2>
          </div>
          <span className="text-[10px] text-[#00f0ff] font-mono border border-[#00f0ff]/30 bg-[#00f0ff]/10 px-2 py-1 rounded ml-2">CORE_ENGINE: v2.5</span>
             <Menu size={20} className="text-[#8b8a96]" />
             <h2 className="text-white font-bold text-xl uppercase tracking-widest">
               {activeTab === 'home' ? 'Home' : 
                activeTab === 'risk' ? 'Nível de Risco' : 
                activeTab === 'map' ? 'Mapa de Ataque' : 
                activeTab === 'incidents' ? 'Playbooks SOAR' :
                activeTab === 'hosts' ? 'Inventário' :
                activeTab === 'firewall' ? 'Políticas Firewall' :
                activeTab === 'intel' ? 'Threat Intel' :
                activeTab === 'alerts' ? 'Configuração' : 'Relatórios'}
             </h2>
             <span className="text-[10px] text-[#00f0ff] font-mono border border-[#00f0ff]/30 bg-[#00f0ff]/10 px-2 py-1 rounded ml-2">API: {status.api}</span>
          </div>
          <div className="flex items-center gap-6 text-xs">
             <span className="flex items-center gap-2 text-white font-bold"><span className="w-8 h-8 rounded-full bg-[#7000ff] flex items-center justify-center"><User size={14}/></span> OP. {currentUser}</span>
          </div>
        </header>

        {/* ÁREA DE TELAS E CHAT LATERAL */}
        <div className="flex-1 flex overflow-hidden p-6 gap-6">
          
          {/* RENDERIZAÇÃO DAS 8 ABAS */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'home' && <HomeTab stats={stats} incidents={incidents} />}
            {activeTab === 'risk' && <RiskTab stats={stats} hosts={hosts} />}
            {activeTab === 'map' && <MapTab stats={stats} onBlock={runPlaybook} />}
            {activeTab === 'incidents' && <PlaybooksTab logs={logs} runPlaybook={runPlaybook} />}
            {activeTab === 'hosts' && <ActiveHostsTab hosts={hosts} />}
            {activeTab === 'firewall' && <FirewallRulesTab />}
            {activeTab === 'intel' && <ThreatIntelTab />}
            {activeTab === 'alerts' && <AlertConfigTab />}
            {activeTab === 'reports' && <ReportsTab logs={logs} />}
          </div>

          {/* AI COPILOT LATERAL DIREITO */}
          <div className="w-[300px] flex flex-col gap-6">
            <div className="bg-[#151221] border border-[#231f36] rounded-2xl flex flex-col h-[400px] overflow-hidden shadow-lg">
              <div className="p-4 border-b border-[#231f36] bg-[#0b0914] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#00f0ff] font-bold text-xs uppercase tracking-widest"><TerminalSquare size={16}/> AI Copilot</div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[11px] font-mono">
                {chatLog.map((m, i) => (
                  <div key={i} className={`p-4 rounded-xl border mb-3 ${m.role==='ai' ? 'bg-[#151221] border-[#7000ff]/30' : 'bg-[#231f36] border-transparent'}`}>
                    <div className={`font-bold text-xs mb-2 flex items-center gap-2 ${m.role==='ai'?'text-[#00f0ff]':'text-[#ff007f]'}`}>
                      {m.role === 'ai' ? <ShieldAlert size={14}/> : <User size={14}/>}
                      {m.role === 'ai' ? 'ELYSIUM_CO_PILOT' : 'OPERATOR'}
                    </div>
                    <div className="text-[12px] text-white leading-relaxed font-mono whitespace-pre-wrap">
                      {m.text}
                    </div>
                  </div>
                ))}
                {isTyping && <div className="text-[#00f0ff] animate-pulse">Consultando heurísticas...</div>}
              </div>
              <form onSubmit={handleChat} className="p-3 bg-[#0b0914] border-t border-[#231f36] flex gap-2">
                 <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Comando Tático..." className="flex-1 bg-transparent text-white outline-none px-2 placeholder:text-[#8b8a96]" />
                 <button type="submit" className="bg-[#7000ff] text-white p-2 rounded-lg hover:bg-[#5b00cc] transition-colors"><Search size={14}/></button>
              </form>
            </div>

            {/* LIVE FEED DE LOGS */}
            <div className="bg-[#151221] border border-[#231f36] rounded-2xl flex-1 flex flex-col overflow-hidden shadow-lg">
              <div className="p-4 border-b border-[#231f36]"><h3 className="text-white text-[10px] font-bold uppercase tracking-widest">Telemetria Real (FortiGate)</h3></div>
              <div className="overflow-y-auto flex-1 p-2">
                <table className="w-full text-left text-[10px] font-mono">
                  <tbody>
                    {logs.slice(0, 15).map((log, i) => (
                      <tr key={i} className="border-b border-[#231f36] text-[#8b8a96]">
                        <td className="py-2 px-1"><span className={`font-bold ${log.risk_score > 80 ? 'text-[#ff007f]' : 'text-[#10b981]'}`}>{log.risk_score}</span></td>
                        <td className="py-2 px-1 text-[#00f0ff]">{log.src_ip}</td>
                        <td className="py-2 px-1 text-right">{log.action.toUpperCase()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}