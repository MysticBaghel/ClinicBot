import { useState, useEffect } from "react";
import { C, globalCSS } from "./constants/theme";
import { Avatar } from "./components/UI";

import LoginPage        from "./LoginPage";
import DashboardPage    from "./pages/DashboardPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import TimeSlotsPage    from "./pages/TimeSlotsPage";
import BotSettingsPage  from "./pages/BotSettingsPage";

const BASE_URL = "http://localhost:8000";

const CalendarIcon = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="5" width="22" height="19" rx="4" fill="white" stroke="#000000" strokeWidth="1.5"/>
    <rect x="2" y="5" width="22" height="7" rx="4" fill="#3B82F6"/>
    <rect x="8" y="2" width="3" height="6" rx="1.5" fill="#2563EB"/>
    <rect x="15" y="2" width="3" height="6" rx="1.5" fill="#2563EB"/>
    <text x="13" y="21" textAnchor="middle" fontSize="10" fontWeight="800" fill="#3B82F6" fontFamily="sans-serif">21</text>
  </svg>
);

const NAV = [
  { id:"dashboard",    icon:"⊞",             label:"Dashboard"   },
  { id:"appointments", icon:<CalendarIcon />, label:"Appointments"},
  { id:"slots",        icon:"🕐",             label:"Time Slots"  },
  { id:"settings",     icon:"⚙️",             label:"Bot Settings"},
];

function MobileBlock() {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", padding:32, textAlign:"center", background:"#F1F5F9", fontFamily:"system-ui, sans-serif" }}>
      <div style={{ fontSize:52, marginBottom:20 }}>🖥️</div>
      <div style={{ fontSize:20, fontWeight:800, color:"#1E293B", marginBottom:10 }}>Desktop Only</div>
      <div style={{ fontSize:14, color:"#64748B", maxWidth:280, lineHeight:1.6 }}>
        This dashboard is designed for desktop use. Please open it on a laptop or computer for the best experience.
      </div>
    </div>
  );
}

export default function App() {
  const [tenant, setTenant]     = useState(null);
  const [page, setPage]         = useState("dashboard");
  const [checking, setChecking] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const token        = localStorage.getItem("access_token");
    const storedTenant = localStorage.getItem("tenant");

    if (token && storedTenant) {
      fetch(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setTenant(data);
            localStorage.setItem("tenant", JSON.stringify(data));
          } else {
            localStorage.clear();
          }
        })
        .catch(() => localStorage.clear())
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  if (isMobile) return <MobileBlock />;

  const handleLogin  = (tenantData) => { setTenant(tenantData); setPage("dashboard"); };
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("tenant");
    setTenant(null);
  };

  if (checking) {
    return (
      <div style={{ minHeight:"100vh", background:C.pageBg, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <style>{globalCSS}</style>
        <div style={{ width:40, height:40, border:`3px solid ${C.blueLight}`, borderTopColor:C.blue, borderRadius:"50%", animation:"spin .7s linear infinite" }} />
      </div>
    );
  }

  if (!tenant) return <LoginPage onLogin={handleLogin} />;

  const today = new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

  return (
    <div style={{ display:"flex", height:"100vh", background:C.pageBg, fontFamily:C.font, overflow:"hidden" }}>
      <style>{globalCSS}</style>

      {/* Sidebar */}
      <div style={{ width:72, background:C.sidebar, display:"flex", flexDirection:"column", alignItems:"center", padding:"20px 0", gap:6, boxShadow:"2px 0 16px rgba(0,0,0,0.06)", zIndex:10, flexShrink:0 }}>
        <div style={{ width:44, height:44, borderRadius:14, background:C.blueGrad, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:18, boxShadow:"0 4px 14px rgba(99,102,241,.4)" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="8" y="2" width="4" height="16" rx="2" fill="white"/>
            <rect x="2" y="8" width="16" height="4" rx="2" fill="white"/>
          </svg>
        </div>
        {NAV.map(item => (
          <button key={item.id} title={item.label} className={`nav-btn ${page===item.id?"active":""}`} onClick={()=>setPage(item.id)} style={{ width:48, height:48, border:"none", cursor:"pointer", background:"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, position:"relative" }}>
            {item.icon}
            {page===item.id && <div style={{ position:"absolute", right:0, top:"50%", transform:"translateY(-50%)", width:3, height:22, background:C.blue, borderRadius:"3px 0 0 3px" }} />}
          </button>
        ))}
        <div style={{ flex:1 }} />
        <div style={{ width:10, height:10, borderRadius:"50%", background:C.green, marginBottom:8, animation:"pulse 2s infinite", boxShadow:`0 0 0 3px ${C.green}30` }} />
        <div title="Logout" onClick={handleLogout} style={{ width:38, height:38, borderRadius:"50%", background:C.blueGrad, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer" }}>
          {tenant.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Topbar */}
        <div style={{ background:C.card, padding:"0 32px", height:64, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, boxShadow:"0 1px 8px rgba(0,0,0,0.05)" }}>
          <div>
            <span style={{ fontSize:16, fontWeight:800, color:C.text, letterSpacing:-.3 }}>{tenant.name}</span>
            <span style={{ fontSize:12, color:C.textMed, marginLeft:12 }}>{today}</span>
          </div>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:14, color:C.textLight }}>🔍</span>
            <input placeholder="Search patients, appointments…" style={{ padding:"9px 18px 9px 38px", border:`1.5px solid ${C.border}`, borderRadius:30, fontSize:13, color:C.text, background:C.pageBg, fontFamily:C.font, width:280, boxShadow:C.shadow }} />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, padding:"7px 14px", background:C.greenLight, borderRadius:20 }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:C.green, animation:"pulse 2s infinite" }} />
              <span style={{ fontSize:12, fontWeight:700, color:C.green }}>Bot Active</span>
            </div>
            <div style={{ width:38, height:38, borderRadius:12, background:C.pageBg, border:`1.5px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:16 }}>🔔</div>
            <Avatar initials={tenant.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()} size={38} color={C.blueGrad} />
          </div>
        </div>

        {/* Page */}
        <div style={{ flex:1, overflowY:"auto", padding:"28px 32px" }}>
          {page==="dashboard"    && <DashboardPage    tenantId={tenant.id} />}
          {page==="appointments" && <AppointmentsPage tenantId={tenant.id} />}
          {page==="slots"        && <TimeSlotsPage    tenantId={tenant.id} />}
          {page==="settings"     && <BotSettingsPage  tenantId={tenant.id} />}
        </div>
      </div>
    </div>
  );
}
