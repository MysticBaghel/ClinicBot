import { useState, useEffect } from "react";
import { C } from "../constants/theme";
import { Card, SectionTitle, Spinner } from "../components/UI";

const BASE_URL = "http://localhost:8000";

const DAYS_LIST = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const ALL_TIMES = [];
for (let h = 6; h <= 22; h++) {
  ["00","30"].forEach(m => {
    if (h === 22 && m === "30") return;
    const ampm = h < 12 ? "AM" : "PM";
    const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
    ALL_TIMES.push({ value:`${String(h).padStart(2,"0")}:${m}`, label:`${h12}:${m} ${ampm}` });
  });
}

// Count total 30-min slots across all doctors for a given day object
const totalSlots = (dayObj) => {
  let count = 0;
  (dayObj.doctors || []).forEach(doc => {
    doc.ranges.forEach(r => {
      if (!r.from || !r.to || r.from >= r.to) return;
      let [fh, fm] = r.from.split(":").map(Number);
      const [th, tm] = r.to.split(":").map(Number);
      while (fh * 60 + fm < th * 60 + tm) {
        count++;
        fm += 30;
        if (fm >= 60) { fh++; fm = 0; }
      }
    });
  });
  return count;
};

const makeDoctor = (name = "") => ({
  id: `${Date.now()}-${Math.random()}`,
  name,
  ranges: [{ from: "09:00", to: "13:00" }],
});

const DEFAULT_SCHEDULE = Object.fromEntries(DAYS_LIST.map((d, i) => [d, {
  open: i < 6,
  doctors: i < 6 ? [makeDoctor("")] : [],
}]));

// ─── Reusable select ────────────────────────────────────────────────────────
function TimeSelect({ value, onChange, minVal }) {
  const options = ALL_TIMES.filter(t => !minVal || t.value > minVal);
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ width:"100%", padding:"9px 12px", border:`1.5px solid ${C.border}`, borderRadius:9, fontSize:13, color:C.text, background:"#fff", fontFamily:C.font, cursor:"pointer" }}
    >
      <option value="">Select time</option>
      {options.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
    </select>
  );
}

// ─── Single doctor card ──────────────────────────────────────────────────────
function DoctorCard({ doctor, docIndex, onNameChange, onAddRange, onRemoveRange, onUpdateRange, onRemoveDoctor, isOnly }) {
  return (
    <div style={{ border:`1.5px solid ${C.border}`, borderRadius:14, overflow:"hidden", background:"#fff" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 20px", background:"#FAFBFC", borderBottom:`1.5px solid #F1F5F9` }}>
        <div style={{ width:34, height:34, borderRadius:"50%", background:"#EFF6FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
          👨‍⚕️
        </div>
        <input
          value={doctor.name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Enter doctor name…"
          style={{ flex:1, border:"none", outline:"none", fontSize:14, fontWeight:700, color:C.text, background:"transparent", fontFamily:C.font }}
        />
        {!isOnly && (
          <button
            onClick={onRemoveDoctor}
            style={{ width:28, height:28, borderRadius:8, border:`1.5px solid #FCA5A5`, background:"transparent", color:C.red, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}
          >×</button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding:"16px 20px" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", letterSpacing:".5px", marginBottom:10 }}>TIME WINDOWS</div>

        {doctor.ranges.map((range, ri) => {
          const invalid = (range.from || range.to) && (!range.from || !range.to || range.from >= range.to);
          return (
            <div
              key={ri}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", background:C.pageBg, borderRadius:10, border:`1.5px solid ${invalid ? "#FCA5A5" : C.border}`, marginBottom:8 }}
            >
              <span style={{ fontSize:12, fontWeight:600, color:"#94A3B8", flexShrink:0, width:62 }}>Window {ri+1}</span>

              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#CBD5E1", marginBottom:3, letterSpacing:".5px" }}>FROM</div>
                <TimeSelect value={range.from} onChange={v => onUpdateRange(ri, "from", v)} />
              </div>

              <div style={{ fontSize:18, color:"#CBD5E1", paddingTop:18, flexShrink:0 }}>→</div>

              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#CBD5E1", marginBottom:3, letterSpacing:".5px" }}>TO</div>
                <TimeSelect value={range.to} onChange={v => onUpdateRange(ri, "to", v)} minVal={range.from} />
              </div>

              {doctor.ranges.length > 1 && (
                <button
                  onClick={() => onRemoveRange(ri)}
                  style={{ width:26, height:26, borderRadius:7, border:`1.5px solid #FCA5A5`, background:"transparent", color:C.red, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}
                >×</button>
              )}
            </div>
          );
        })}

        <button
          onClick={onAddRange}
          style={{ width:"100%", padding:"9px", border:`1.5px dashed ${C.border}`, borderRadius:9, background:"transparent", fontSize:12, fontWeight:600, color:"#94A3B8", cursor:"pointer", fontFamily:C.font, transition:"border-color .15s, color .15s" }}
          onMouseEnter={e => { e.target.style.borderColor = C.blue; e.target.style.color = C.blue; }}
          onMouseLeave={e => { e.target.style.borderColor = C.border; e.target.style.color = "#94A3B8"; }}
        >
          + Add time window
        </button>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function TimeSlotsPage({ tenantId }) {
  const [activeDay, setActiveDay] = useState("Monday");
  const [schedule, setSchedule]   = useState(DEFAULT_SCHEDULE);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [loading, setLoading]     = useState(true);

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    fetch(`${BASE_URL}/slots`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data && Object.keys(data).length > 0) setSchedule(data);
      })
      .catch(() => {}) // keep defaults on error
      .finally(() => setLoading(false));
  }, [tenantId]);

  // ── Day helpers ────────────────────────────────────────────────────────────
  const toggleOpen = () => {
    setSchedule(s => {
      const day = s[activeDay];
      const nowOpen = !day.open;
      return {
        ...s,
        [activeDay]: {
          ...day,
          open: nowOpen,
          doctors: nowOpen && day.doctors.length === 0 ? [makeDoctor()] : day.doctors,
        },
      };
    });
  };

  // ── Doctor helpers ─────────────────────────────────────────────────────────
  const addDoctor = () =>
    setSchedule(s => ({ ...s, [activeDay]: { ...s[activeDay], doctors: [...s[activeDay].doctors, makeDoctor()] } }));

  const removeDoctor = (di) =>
    setSchedule(s => ({ ...s, [activeDay]: { ...s[activeDay], doctors: s[activeDay].doctors.filter((_, i) => i !== di) } }));

  const updateDocName = (di, name) =>
    setSchedule(s => {
      const doctors = s[activeDay].doctors.map((d, i) => i === di ? { ...d, name } : d);
      return { ...s, [activeDay]: { ...s[activeDay], doctors } };
    });

  // ── Range helpers ──────────────────────────────────────────────────────────
  const addRange = (di) =>
    setSchedule(s => {
      const doctors = s[activeDay].doctors.map((d, i) =>
        i === di ? { ...d, ranges: [...d.ranges, { from: "", to: "" }] } : d
      );
      return { ...s, [activeDay]: { ...s[activeDay], doctors } };
    });

  const removeRange = (di, ri) =>
    setSchedule(s => {
      const doctors = s[activeDay].doctors.map((d, i) =>
        i === di ? { ...d, ranges: d.ranges.filter((_, idx) => idx !== ri) } : d
      );
      return { ...s, [activeDay]: { ...s[activeDay], doctors } };
    });

  const updateRange = (di, ri, field, val) =>
    setSchedule(s => {
      const doctors = s[activeDay].doctors.map((d, i) =>
        i === di ? { ...d, ranges: d.ranges.map((r, idx) => idx === ri ? { ...r, [field]: val } : r) } : d
      );
      return { ...s, [activeDay]: { ...s[activeDay], doctors } };
    });

  // ── Save ───────────────────────────────────────────────────────────────────
  const saveSlots = async () => {
    setSaving(true);
    try {
      await fetch(`${BASE_URL}/slots`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ schedule }),
      });
    } catch (_) {}
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <div style={{ padding:40, color:C.textMed }}>Loading…</div>;

  const day   = schedule[activeDay];
  const slots = totalSlots(day);

  // Dot colour for each day in the sidebar
  const dotColor = (d) => {
    const s = schedule[d];
    if (!s.open) return C.textLight;
    return totalSlots(s) > 0 ? C.green : C.yellow;
  };

  return (
    <div style={{ animation:"fadeUp .3s ease both" }}>

      {/* ── Top bar ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
        <SectionTitle title="Time Slot Manager" sub="Set doctors and their available hours per day." />
        <button
          onClick={saveSlots}
          style={{ padding:"10px 24px", background:saved ? C.green : C.blue, border:"none", borderRadius:C.radiusSm, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:C.font, display:"flex", alignItems:"center", gap:8, transition:"background .3s" }}
        >
          {saving ? <Spinner /> : null}
          {saved ? "✓ Saved!" : "Save Changes"}
        </button>
      </div>

      {/* ── Grid ── */}
      <div style={{ display:"grid", gridTemplateColumns:"220px 1fr", gap:16, alignItems:"start" }}>

        {/* Day sidebar */}
        <Card style={{ padding:8 }}>
          {DAYS_LIST.map(d => {
            const dc = schedule[d];
            return (
              <div
                key={d}
                className="tab-btn"
                onClick={() => setActiveDay(d)}
                style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 14px", borderRadius:12, marginBottom:2, background:activeDay===d ? C.blueLight : "transparent", color:activeDay===d ? C.blue : C.textMed, cursor:"pointer", transition:"all .12s" }}
              >
                <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:dotColor(d) }} />
                  <span style={{ fontSize:13, fontWeight:activeDay===d ? 700 : 500 }}>{d}</span>
                </div>
                <span style={{ fontSize:11 }}>{dc.open ? "Open" : "Closed"}</span>
              </div>
            );
          })}
        </Card>

        {/* Right panel */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

          {/* Toggle card */}
          <Card style={{ padding:"18px 24px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div
                  onClick={toggleOpen}
                  style={{ width:44, height:24, borderRadius:12, background:day.open ? C.blue : "#CBD5E1", cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}
                >
                  <div style={{ position:"absolute", top:3, left:day.open ? 23 : 3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,.2)" }} />
                </div>
                <span style={{ fontSize:14, fontWeight:700, color:day.open ? C.text : C.textLight }}>
                  {activeDay} — {day.open ? "Clinic is Open" : "Clinic is Closed"}
                </span>
              </div>
              {day.open && slots > 0 && (
                <span style={{ fontSize:12, color:C.textMed }}>
                  {slots} slots across {day.doctors.length} doctor(s)
                </span>
              )}
            </div>
          </Card>

          {/* Open state: doctor cards */}
          {day.open ? (
            <>
              {day.doctors.map((doc, di) => (
                <DoctorCard
                  key={doc.id}
                  doctor={doc}
                  docIndex={di}
                  isOnly={day.doctors.length === 1}
                  onNameChange={name => updateDocName(di, name)}
                  onAddRange={() => addRange(di)}
                  onRemoveRange={ri => removeRange(di, ri)}
                  onUpdateRange={(ri, field, val) => updateRange(di, ri, field, val)}
                  onRemoveDoctor={() => removeDoctor(di)}
                />
              ))}

              {/* Add doctor button */}
              <button
                onClick={addDoctor}
                style={{ width:"100%", padding:"14px", border:`2px dashed ${C.border}`, borderRadius:14, background:"transparent", fontSize:13, fontWeight:600, color:C.textMed, cursor:"pointer", fontFamily:C.font, display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"all .15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.color = C.blue; e.currentTarget.style.background = C.blueLight; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMed; e.currentTarget.style.background = "transparent"; }}
              >
                ＋ Add Doctor
              </button>
            </>
          ) : (
            /* Closed state */
            <Card style={{ padding:"60px 24px", textAlign:"center" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
              <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:8 }}>Clinic is closed on {activeDay}</div>
              <div style={{ fontSize:13, color:C.textMed, marginBottom:20 }}>Patients cannot book appointments on this day.</div>
              <button
                className="btn-blue"
                onClick={toggleOpen}
                style={{ padding:"10px 24px", background:C.blue, border:"none", borderRadius:C.radiusSm, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:C.font }}
              >
                Mark as Open
              </button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
