import { useState } from "react";
import { C, globalCSS } from "./constants/theme";

const BASE_URL = "http://localhost:8000";

export default function LoginPage({ onLogin }) {
  const [phone, setPhone]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `+91${phone}`, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");

      localStorage.setItem("access_token",  data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("tenant",        JSON.stringify(data.tenant));

      onLogin(data.tenant);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:C.pageBg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:C.font }}>
      <style>{globalCSS}</style>
      <div style={{ background:C.card, borderRadius:C.radius, boxShadow:C.shadow, padding:"48px 44px", width:"100%", maxWidth:420 }}>

        <div style={{ display:"flex", justifyContent:"center", marginBottom:32 }}>
          <div style={{ width:56, height:56, borderRadius:16, background:C.blueGrad, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 16px rgba(99,102,241,.4)" }}>
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
              <rect x="8" y="2" width="4" height="16" rx="2" fill="white"/>
              <rect x="2" y="8" width="16" height="4" rx="2" fill="white"/>
            </svg>
          </div>
        </div>

        <h1 style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:6, textAlign:"center" }}>Welcome back</h1>
        <p style={{ fontSize:13, color:C.textMed, textAlign:"center", marginBottom:32 }}>Login to your clinic dashboard</p>

        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>Phone Number</div>
          <div style={{ display:"flex", alignItems:"center", border:`1.5px solid ${C.border}`, borderRadius:C.radiusSm, overflow:"hidden" }}>
            <span style={{ padding:"12px 12px", background:C.pageBg, fontSize:15, color:C.textMed, borderRight:`1.5px solid ${C.border}` }}>+91</span>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="9876543210"
              maxLength={10}
              style={{ flex:1, padding:"12px 16px", border:"none", outline:"none", fontSize:15, color:C.text, background:C.card, fontFamily:C.font }}
            />
          </div>
        </div>

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>Password</div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder="••••••••"
            style={{ width:"100%", padding:"12px 16px", border:`1.5px solid ${C.border}`, borderRadius:C.radiusSm, fontSize:15, color:C.text, background:C.card, fontFamily:C.font, boxSizing:"border-box" }}
          />
        </div>

        {error && <div style={{ padding:"10px 14px", background:C.redLight, borderRadius:10, fontSize:13, color:C.red, marginBottom:14 }}>{error}</div>}

        <button
          onClick={handleLogin}
          disabled={loading || phone.length !== 10 || !password}
          style={{ width:"100%", padding:14, background:C.blue, border:"none", borderRadius:C.radiusSm, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:C.font, opacity: (phone.length !== 10 || !password) ? 0.5 : 1 }}
        >
          {loading ? "Logging in…" : "Login →"}
        </button>
      </div>
    </div>
  );
}