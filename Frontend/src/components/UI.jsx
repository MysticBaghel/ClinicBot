import { C } from "../constants/theme";

export const Avatar = ({ initials, size = 36, color = C.blueGrad }) => (
  <div style={{ width:size, height:size, borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.33, fontWeight:700, color:"#fff", flexShrink:0, letterSpacing:0.5 }}>
    {initials}
  </div>
);

export const StatusBadge = ({ status }) => {
  const map = {
    confirmed: { bg:C.greenLight,  color:C.green,  dot:C.green,  label:"Confirmed"    },
    pending:   { bg:C.yellowLight, color:C.yellow, dot:C.yellow, label:"Pending"      },
    cancelled: { bg:C.redLight,    color:C.red,    dot:C.red,    label:"Cancelled"    },
    consult:   { bg:C.blueLight,   color:C.blue,   dot:C.blue,   label:"Consultation" },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"5px 13px", borderRadius:20, background:s.bg, fontSize:12, fontWeight:600, color:s.color, whiteSpace:"nowrap" }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:s.dot }} />
      {s.label}
    </span>
  );
};

export const Card = ({ children, style={}, className="", delay=0 }) => (
  <div className={className} style={{ background:C.card, borderRadius:C.radius, boxShadow:C.shadow, padding:"24px", animation:`fadeUp .4s ease ${delay}s both`, ...style }}>
    {children}
  </div>
);

export const StatCard = ({ icon, label, value, sub, color, delay=0 }) => (
  <Card className="card-hover" delay={delay} style={{ padding:"22px 26px", cursor:"default" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
      <div>
        <p style={{ fontSize:13, color:C.textMed, fontWeight:500, marginBottom:10 }}>{label}</p>
        <p style={{ fontSize:32, fontWeight:800, color:C.text, letterSpacing:-1, lineHeight:1 }}>{value}</p>
        {sub && <p style={{ fontSize:12, color:C.textLight, marginTop:7 }}>{sub}</p>}
      </div>
      <div style={{ width:46, height:46, borderRadius:14, background:color+"18", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{icon}</div>
    </div>
  </Card>
);

export const Spinner = () => (
  <div style={{ width:20, height:20, border:`2px solid #fff4`, borderTopColor:"#fff", borderRadius:"50%", animation:"spin .7s linear infinite", display:"inline-block" }} />
);

export const SectionTitle = ({ title, sub }) => (
  <div style={{ marginBottom:22 }}>
    <h2 style={{ fontSize:19, fontWeight:800, color:C.text, letterSpacing:-0.4 }}>{title}</h2>
    {sub && <p style={{ fontSize:13, color:C.textMed, marginTop:3 }}>{sub}</p>}
  </div>
);

export const Divider = () => (
  <div style={{ height:1, background:C.border, margin:"20px 0" }} />
);
