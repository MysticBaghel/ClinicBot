import { useState, useEffect, useCallback } from "react";
import { C } from "../constants/theme";
import { Avatar, StatusBadge, Card, SectionTitle, Spinner, Divider } from "../components/UI";

const BASE_URL = "http://localhost:8000";

export default function AppointmentsPage({ tenantId }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatus]       = useState("confirmed");
  const [dateFilter, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selected, setSelected]         = useState(null);
  const [loadingId, setLoadingId]       = useState(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate]           = useState("");
  const [newTime, setNewTime]           = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  const token = localStorage.getItem("access_token");

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.append("status", statusFilter);
    if (dateFilter) params.append("date", dateFilter);
    if (search) params.append("search", search);

    const res = await fetch(`${BASE_URL}/appointments?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setAppointments(data);
    setLoading(false);
  }, [statusFilter, dateFilter, search, token]);

  useEffect(() => {
    const t = setTimeout(fetchAppointments, 300);
    const interval = setInterval(fetchAppointments, 30000);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, [fetchAppointments]);

  const toggleDone = async (id, e) => {
    e.stopPropagation();
    const res = await fetch(`${BASE_URL}/appointments/${id}/complete`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setAppointments(prev =>
        prev.map(a => a.id === id ? { ...a, completed: data.completed } : a)
      );
    }
  };

  const handleReminder = async (appt) => {
    setLoadingId(appt.id);
    await fetch(`${BASE_URL}/appointments/${appt.id}/remind`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setLoadingId(null);
    setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, reminderSent: true } : a));
    if (selected?.id === appt.id) setSelected({ ...appt, reminderSent: true });
    alert(`Reminder sent to ${appt.patientName} via WhatsApp!`);
  };

  const handleReschedule = async () => {
    if (!newDate || !newTime) return alert("Please select both date and time.");
    setRescheduling(true);
    const res = await fetch(`${BASE_URL}/appointments/${selected.id}/reschedule`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ date: newDate, time: newTime }),
    });
    setRescheduling(false);
    if (res.ok) {
      await fetchAppointments();
      setShowReschedule(false);
      setNewDate("");
      setNewTime("");
      alert(`Appointment rescheduled and patient notified via WhatsApp!`);
    } else {
      alert("Failed to reschedule. Please try again.");
    }
  };

  const inp = { width:"100%", padding:"10px 14px", border:`1.5px solid ${C.border}`, borderRadius:C.radiusSm, fontSize:13, color:C.text, background:C.card, fontFamily:C.font, boxSizing:"border-box" };

  return (
    <div style={{ display:"flex", gap:20, height:"calc(100vh - 110px)", animation:"fadeUp .3s ease both" }}>
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        <SectionTitle title="Appointments" sub={`${appointments.length} records found`} />

        <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
          <div style={{ position:"relative", flex:1, minWidth:220 }}>
            <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:15, color:C.textLight }}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search patient, phone or service…" style={{ width:"100%", padding:"11px 14px 11px 40px", border:`1.5px solid ${C.border}`, borderRadius:C.radiusSm, fontSize:13, color:C.text, background:C.card, fontFamily:C.font, boxShadow:C.shadow }} />
          </div>
          <input type="date" value={dateFilter} onChange={e=>setDate(e.target.value)} style={{ padding:"11px 14px", border:`1.5px solid ${C.border}`, borderRadius:C.radiusSm, fontSize:13, color:C.text, background:C.card, fontFamily:C.font, boxShadow:C.shadow }} />
          <select value={statusFilter} onChange={e=>setStatus(e.target.value)} style={{ padding:"11px 14px", border:`1.5px solid ${C.border}`, borderRadius:C.radiusSm, fontSize:13, color:C.text, background:C.card, fontFamily:C.font, boxShadow:C.shadow }}>
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <Card style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column", padding:0 }}>
          <div style={{ display:"grid", gridTemplateColumns:".9fr 1.8fr 1.2fr 90px .95fr .65fr 60px", padding:"12px 24px", background:C.pageBg, gap:10, borderBottom:`1px solid ${C.border}` }}>
            {["Date","Patient","Service","Time","Status","Reminder","Done"].map(h=>(
              <div key={h} style={{ fontSize:11, fontWeight:700, color:C.textLight, textTransform:"uppercase", letterSpacing:.7 }}>{h}</div>
            ))}
          </div>
          <div style={{ flex:1, overflowY:"auto" }}>
            {loading && <div style={{ padding:40, textAlign:"center", color:C.textMed }}>Loading...</div>}
            {!loading && appointments.map((a,i)=>(
              <div key={a.id} className="row" onClick={()=>{ setSelected(a); setShowReschedule(false); }} style={{ display:"grid", gridTemplateColumns:".9fr 1.8fr 1.2fr 90px .95fr .65fr 60px", padding:"14px 24px", borderBottom:`1px solid ${C.border}`, gap:10, alignItems:"center", cursor:"pointer", transition:"background .12s" }}>
                <div style={{ fontSize:13, color:C.textMed }}>{a.date ? new Date(a.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short"}) : "—"}</div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:a.status==="confirmed"?C.green:a.status==="cancelled"?C.red:C.yellow, flexShrink:0 }} />
                  <Avatar initials={a.avatar} size={34} color={C.blueGrad} />
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{a.patientName}</div>
                    <div style={{ fontSize:11, color:C.textLight }}>{a.phone}</div>
                  </div>
                </div>
                <div style={{ fontSize:13, color:C.text }}>{a.service}</div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.blue }}>{a.time.split(" ")[0]}</div>
                  <div style={{ fontSize:11, color:C.textLight }}>{a.time.split(" ")[1]}</div>
                </div>
                <StatusBadge status={a.status} />
                <div style={{ fontSize:13, fontWeight:600, color:a.reminderSent?C.green:C.textLight }}>{a.reminderSent?"✓ Yes":"—"}</div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {a.status !== "cancelled" && <input type="checkbox" checked={!!a.completed} onClick={e=>toggleDone(a.id,e)} onChange={()=>{}} style={{ width:16, height:16, cursor:"pointer" }} />}
                </div>
              </div>
            ))}
            {!loading && appointments.length===0 && <div style={{ padding:"60px 24px", textAlign:"center", color:C.textLight, fontSize:14 }}>No appointments found.</div>}
          </div>
          <div style={{ padding:"12px 24px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:12, color:C.textLight }}>Displaying {appointments.length} entries</span>
          </div>
        </Card>
      </div>

      {selected && (
        <div style={{ width:310, flexShrink:0, animation:"slideRight .25s ease both" }}>
          <Card style={{ height:"100%", overflow:"auto", padding:0, borderTop:`4px solid ${selected.status==="confirmed"?C.green:selected.status==="cancelled"?C.red:C.yellow}` }}>
            <div style={{ padding:"18px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:14, fontWeight:700, color:C.text }}>Appointment Details</span>
              <button onClick={()=>{ setSelected(null); setShowReschedule(false); }} style={{ width:28, height:28, borderRadius:8, border:`1.5px solid ${C.border}`, background:"transparent", cursor:"pointer", fontSize:14, color:C.textMed }}>✕</button>
            </div>
            <div style={{ padding:20 }}>
              <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
                <Avatar initials={selected.avatar} size={52} color={C.blueGrad} />
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{selected.patientName}</div>
                  <div style={{ fontSize:12, color:C.textMed }}>{selected.phone}</div>
                </div>
              </div>
              <StatusBadge status={selected.status} />
              <Divider />
              {[["Service",selected.service],["Date", selected.date ? new Date(selected.date).toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"}) : "—"],["Time",selected.time],["Reminder",selected.reminderSent?"Sent via WhatsApp":"Not sent yet"]].map(([l,v])=>(
                <div key={l} style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.textLight, textTransform:"uppercase", letterSpacing:.7, marginBottom:3 }}>{l}</div>
                  <div style={{ fontSize:13, fontWeight:500, color:C.text }}>{v}</div>
                </div>
              ))}
              <Divider />
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {selected.status !== "cancelled" && (
                  <button className="btn-blue" onClick={()=>handleReminder(selected)} disabled={!!loadingId} style={{ width:"100%", padding:11, background:C.blue, border:"none", borderRadius:C.radiusSm, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:C.font, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                    {loadingId===selected.id ? <Spinner /> : "📲"} Send WhatsApp Reminder
                  </button>
                )}
                {selected.status !== "cancelled" && (
                  <button onClick={()=>setShowReschedule(!showReschedule)} style={{ width:"100%", padding:11, background:"transparent", border:`1.5px solid ${C.border}`, borderRadius:C.radiusSm, color:C.textMed, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:C.font }}>
                    📅 Reschedule
                  </button>
                )}
                {showReschedule && selected.status !== "cancelled" && (
                  <div style={{ padding:"14px", background:C.pageBg, borderRadius:12, border:`1.5px solid ${C.border}`, display:"flex", flexDirection:"column", gap:10 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.text }}>New Date & Time</div>
                    <input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)} style={inp} />
                    <input type="time" value={newTime} onChange={e=>setNewTime(e.target.value)} style={inp} />
                    <button onClick={handleReschedule} disabled={rescheduling} style={{ width:"100%", padding:10, background:C.green, border:"none", borderRadius:C.radiusSm, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:C.font, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                      {rescheduling ? <Spinner /> : "✓"} Confirm & Notify Patient
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}