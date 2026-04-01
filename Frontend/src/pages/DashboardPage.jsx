import { useState, useEffect, useCallback } from "react";
import { C } from "../constants/theme";
import { StatCard, Card, Avatar, StatusBadge } from "../components/UI";

const BASE_URL = "http://localhost:8000";

export default function DashboardPage({ tenantId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    fetch(`${BASE_URL}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  if (loading) return <div style={{ color: C.textMed, padding: 40 }}>Loading...</div>;
  if (!data) return <div style={{ color: C.red, padding: 40 }}>Failed to load dashboard.</div>;

  return (
    <div style={{ animation:"fadeUp .3s ease both" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
        <StatCard icon="📅" label="Today's Appointments" value={data.todayAppointments} sub={`${data.confirmedToday} confirmed`} color={C.blue}   delay={0}    />
        <StatCard icon="👤" label="New Patients This Week" value={data.newPatientsWeek}  sub="↑ from last week"              color={C.purple} delay={0.05} />
        <StatCard icon="🔔" label="Reminders Sent"         value={data.remindersSent}    sub="total sent"               color={C.yellow} delay={0.1}  />
        <StatCard icon="📊" label="Appointments This Month" value={data.thisMonth}       sub="this month"             color={C.green}  delay={0.15} />
      </div>

      <Card delay={0.2} style={{ padding:0, overflow:"hidden" }}>
        <div style={{ padding:"20px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:`1px solid ${C.border}` }}>
          <div>
            <h3 style={{ fontSize:16, fontWeight:700, color:C.text }}>Today's Schedule</h3>
            <p style={{ fontSize:12, color:C.textMed, marginTop:2 }}>{new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}</p>
          </div>
        </div>
        {data.todaySchedule.length === 0 && (
          <div style={{ padding:40, textAlign:"center", color:C.textMed, fontSize:14 }}>No appointments today</div>
        )}
        {data.todaySchedule.map((a, i) => (
          <div key={a.id} className="row" style={{ display:"flex", alignItems:"center", padding:"16px 28px", borderBottom:i < data.todaySchedule.length-1 ? `1px solid ${C.border}` : "none", gap:20, transition:"background .12s", cursor:"pointer" }}>
            <div style={{ width:72, flexShrink:0, textAlign:"center" }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.blue }}>{a.time.split(" ")[0]}</div>
              <div style={{ fontSize:11, color:C.textLight }}>{a.time.split(" ")[1]}</div>
            </div>
            <div style={{ width:10, height:10, borderRadius:"50%", background:a.status==="confirmed"?C.green:a.status==="cancelled"?C.red:C.yellow, flexShrink:0, boxShadow:`0 0 0 3px ${a.status==="confirmed"?C.green:a.status==="cancelled"?C.red:C.yellow}28` }} />
            <div style={{ flex:1, display:"flex", alignItems:"center", gap:12 }}>
              <Avatar initials={a.avatar} size={38} color={C.blueGrad} />
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{a.patientName}</div>
                <div style={{ fontSize:12, color:C.textMed }}>{a.service}</div>
              </div>
            </div>
            <StatusBadge status={a.status} />
            <div style={{ fontSize:12, color:a.reminderSent?C.green:C.textLight, fontWeight:500, width:130, textAlign:"right" }}>
              {a.reminderSent ? "✓ Reminder sent" : "— No reminder yet"}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}