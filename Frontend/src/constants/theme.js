export const C = {
  pageBg:      "#E8EEF6",
  card:        "#FFFFFF",
  sidebar:     "#FFFFFF",
  blue:        "#3B82F6",
  blueDark:    "#2563EB",
  blueLight:   "#EFF6FF",
  blueGrad:    "linear-gradient(135deg,#3B82F6,#6366F1)",
  green:       "#22C55E",
  greenLight:  "#F0FDF4",
  red:         "#EF4444",
  redLight:    "#FEF2F2",
  yellow:      "#F59E0B",
  yellowLight: "#FFFBEB",
  purple:      "#8B5CF6",
  text:        "#1E293B",
  textMed:     "#64748B",
  textLight:   "#94A3B8",
  border:      "#E2E8F0",
  shadow:      "0 4px 24px rgba(59,130,246,0.07), 0 1px 4px rgba(0,0,0,0.05)",
  shadowHov:   "0 8px 32px rgba(59,130,246,0.14), 0 2px 8px rgba(0,0,0,0.07)",
  radius:      "20px",
  radiusSm:    "12px",
  font:        "'Plus Jakarta Sans', sans-serif",
};

export const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:${C.pageBg};font-family:${C.font};}
  ::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:8px;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes slideRight{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  @keyframes spin{to{transform:rotate(360deg)}}
  input:focus,textarea:focus,select:focus{outline:none;border-color:${C.blue}!important;box-shadow:0 0 0 3px ${C.blueLight}!important;}
  .nav-btn{transition:all .15s;border-radius:14px;}
  .nav-btn:hover{background:${C.blueLight}!important;}
  .nav-btn.active{background:${C.blueGrad}!important;box-shadow:0 4px 14px rgba(99,102,241,.35)!important;}
  .row:hover{background:#F8FBFF!important;}
  .card-hover{transition:box-shadow .2s,transform .2s;}
  .card-hover:hover{box-shadow:${C.shadowHov}!important;transform:translateY(-1px);}
  .btn-blue{transition:all .15s;}
  .btn-blue:hover{background:${C.blueDark}!important;box-shadow:0 4px 16px rgba(59,130,246,.35)!important;}
  .ghost-btn:hover{background:${C.blueLight}!important;border-color:${C.blue}!important;color:${C.blue}!important;}
  .slot-pill{transition:all .15s;cursor:pointer;}
  .slot-pill:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.1)!important;}
  .tab-btn{transition:all .15s;cursor:pointer;}
  .tab-btn:hover{color:${C.blue}!important;}
`;
