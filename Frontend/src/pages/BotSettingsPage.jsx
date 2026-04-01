import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";

const BLANK_TEMPLATE_URL = "/clinic_setup_template.xlsx";
const API = "http://localhost:8000";

export default function BotSettingsPage() {
  const [file, setFile]             = useState(null);   // File object (only when freshly picked)
  const [fileBase64, setFileBase64] = useState(null);   // base64 string (from DB or fresh upload)
  const [filename, setFilename]     = useState(null);
  const [clinicInfo, setClinicInfo] = useState(null);
  const [services, setServices]     = useState([]);
  const [uploading, setUploading]   = useState(false);
  const [saved, setSaved]           = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(true);   // initial fetch
  const inputRef = useRef();

  // ── On mount: try to load existing file from backend ──────────────────────
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const res = await fetch(`${API}/clinic/file`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        });
        if (res.ok) {
          const data = await res.json();
          setFilename(data.filename);
          setFileBase64(data.file_base64);
          parseExcelFromBase64(data.file_base64);
          setSaved(true);
        }
        // 404 = no file yet, just show upload UI
      } catch {
        // network error — just show upload UI
      } finally {
        setLoading(false);
      }
    };
    fetchExisting();
  }, []);

  // ── Parse helpers ──────────────────────────────────────────────────────────
  const parseExcelFromBase64 = (b64) => {
    try {
      const binary = atob(b64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const wb   = XLSX.read(bytes, { type: "array" });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      applyParsedRows(rows);
    } catch {
      setError("Failed to parse stored file.");
    }
  };

  const parseExcelFromFile = (f) => {
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb   = XLSX.read(e.target.result, { type: "binary" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        applyParsedRows(rows);
      } catch {
        setError("Failed to parse file. Please upload a valid .xlsx file.");
      }
    };
    reader.readAsBinaryString(f);
  };

  const applyParsedRows = (rows) => {
    const info = {};
    const svcs = [];
    let mode   = null;

    for (const row of rows) {
      const col0 = String(row[0] || "").trim();
      if (!col0 || col0 === "Field" || col0 === "Field / Service Name") continue;
      if (col0.includes("CLINIC INFO"))  { mode = "clinic";   continue; }
      if (col0.includes("SERVICES"))     { mode = "services"; continue; }
      if (col0 === "Service Name")       { mode = "services"; continue; }

      if (mode === "clinic" && col0 && row[1] !== undefined)
        info[col0] = String(row[1] || "").trim();

      if (mode === "services" && col0)
        svcs.push({ name: col0, price: row[1] || "", duration: row[2] || "", category: row[3] || "", note: row[4] || "" });
    }

    setClinicInfo(Object.keys(info).length ? info : null);
    setServices(svcs);
    if (!Object.keys(info).length && !svcs.length)
      setError("Couldn't read data — make sure you're using the official clinic template.");
  };

  // ── File selection ─────────────────────────────────────────────────────────
  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.endsWith(".xlsx")) { setError("Only .xlsx files are supported."); return; }
    setFile(f);
    setFilename(f.name);
    setSaved(false);
    setFileBase64(null);
    parseExcelFromFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  // ── Save to backend ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API}/clinic/upload-template`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      body: formData,
    });
    setUploading(false);
    if (res.ok) {
      setSaved(true);
      // Read back base64 so download works even if user refreshes
      const reader = new FileReader();
      reader.onload = (e) => setFileBase64(btoa(e.target.result));
      reader.readAsBinaryString(file);
    } else {
      setError("Upload failed. Try again.");
    }
  };

  // ── Download ───────────────────────────────────────────────────────────────
  const downloadFile = () => {
    if (file) {
      // freshly picked, not yet saved — use object URL
      const url = URL.createObjectURL(file);
      const a   = document.createElement("a");
      a.href    = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } else if (fileBase64) {
      // loaded from DB — decode base64
      const binary = atob(fileBase64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = filename || "clinic_setup.xlsx"; a.click();
      URL.revokeObjectURL(url);
    }
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = () => {
    setFile(null); setFileBase64(null); setFilename(null);
    setClinicInfo(null); setServices([]); setSaved(false); setError("");
  };

  const hasFile = file || fileBase64;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }}>

      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0F172A" }}>Bot Settings</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "#64748B" }}>
            Upload your clinic setup file to configure services and clinic info.
          </p>
        </div>

        {/* Download button */}
        <a
          href={hasFile ? undefined : BLANK_TEMPLATE_URL}
          download={hasFile ? undefined : "clinic_setup_template.xlsx"}
          onClick={hasFile ? downloadFile : undefined}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: hasFile ? "#F0FDF4" : "#EFF6FF",
            color: hasFile ? "#16A34A" : "#3B82F6",
            border: `1.5px solid ${hasFile ? "#BBF7D0" : "#BFDBFE"}`,
            cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap",
            transition: "all 0.2s",
          }}
        >
          <span style={{ fontSize: 16 }}>{hasFile ? "📗" : "📥"}</span>
          {hasFile ? "Download My File" : "Download Blank Template"}
        </a>
      </div>

      {/* Upload Card */}
      <div style={{
        background: "#fff", borderRadius: 14, padding: 28,
        boxShadow: "0 1px 4px rgba(0,0,0,0.07)", marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 18 }}>📂</span>
          <span style={{ fontWeight: 600, fontSize: 15, color: "#0F172A" }}>Clinic Setup File</span>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>
          Upload the <strong>clinic_setup_template.xlsx</strong> file. It should contain your clinic info and services.
          The bot will use this to answer patient queries.
        </p>

        {loading ? (
          <div style={{ padding: "30px 0", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
            Loading...
          </div>
        ) : !hasFile ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current.click()}
            style={{
              border: `2px dashed ${dragOver ? "#3B82F6" : "#CBD5E1"}`,
              borderRadius: 10, padding: "40px 20px", textAlign: "center",
              cursor: "pointer", transition: "all 0.2s",
              background: dragOver ? "#EFF6FF" : "#F8FAFC",
            }}
          >
            <div style={{ fontSize: 34, marginBottom: 10 }}>⬆️</div>
            <p style={{ margin: 0, fontWeight: 600, color: "#334155", fontSize: 14 }}>
              Drag & drop your .xlsx file here
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#94A3B8" }}>or click to browse</p>
            <input ref={inputRef} type="file" accept=".xlsx"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])} />
          </div>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#F0FDF4", border: "1px solid #BBF7D0",
            borderRadius: 10, padding: "14px 18px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>📗</span>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#166534" }}>{filename}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#16A34A" }}>
                  {services.length} services · {clinicInfo ? Object.keys(clinicInfo).length : 0} clinic fields parsed
                  {saved && " · Saved to database"}
                </p>
              </div>
            </div>
            <button onClick={reset} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#94A3B8", fontSize: 20, lineHeight: 1, padding: 0,
            }}>✕</button>
          </div>
        )}

        {error && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "#DC2626" }}>⚠️ {error}</p>
        )}
      </div>

      {/* Preview Section */}
      {(clinicInfo || services.length > 0) && (
        <>
          {clinicInfo && (
            <div style={{
              background: "#fff", borderRadius: 14, padding: 24,
              boxShadow: "0 1px 4px rgba(0,0,0,0.07)", marginBottom: 20,
            }}>
              <p style={{ margin: "0 0 16px", fontWeight: 600, fontSize: 15, color: "#0F172A" }}>🏥 Clinic Info</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
                {Object.entries(clinicInfo).map(([key, val]) => (
                  <div key={key} style={{
                    background: "#F8FAFC", borderRadius: 8, padding: "10px 14px",
                    border: "1px solid #E2E8F0",
                  }}>
                    <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{key}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 13, fontWeight: 500, color: "#1E293B" }}>{val || "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {services.length > 0 && (
            <div style={{
              background: "#fff", borderRadius: 14, padding: 24,
              boxShadow: "0 1px 4px rgba(0,0,0,0.07)", marginBottom: 24,
            }}>
              <p style={{ margin: "0 0 16px", fontWeight: 600, fontSize: 15, color: "#0F172A" }}>
                💊 Services ({services.length})
              </p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#F1F5F9" }}>
                      {["Service Name", "Price (₹)", "Duration", "Category", "Note for Patient"].map(h => (
                        <th key={h} style={{
                          padding: "10px 14px", textAlign: "left", fontWeight: 600,
                          color: "#475569", fontSize: 12, whiteSpace: "nowrap",
                          borderBottom: "1px solid #E2E8F0",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((s, i) => (
                      <tr key={i} style={{
                        borderBottom: "1px solid #F1F5F9",
                        background: i % 2 === 0 ? "#fff" : "#FAFBFC",
                      }}>
                        <td style={{ padding: "10px 14px", fontWeight: 500, color: "#1E293B" }}>{s.name}</td>
                        <td style={{ padding: "10px 14px", color: "#16A34A", fontWeight: 600 }}>
                          {s.price ? `₹${s.price}` : "—"}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#64748B" }}>{s.duration ? `${s.duration} min` : "—"}</td>
                        <td style={{ padding: "10px 14px" }}>
                          {s.category
                            ? <span style={{ background: "#EFF6FF", color: "#3B82F6", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 500 }}>{s.category}</span>
                            : "—"}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#64748B", fontStyle: s.note ? "normal" : "italic" }}>
                          {s.note || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Save button — only show if fresh file picked (not yet saved) */}
          {!saved && file && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 32 }}>
              <button
                onClick={handleSave}
                disabled={uploading}
                style={{
                  background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8,
                  padding: "11px 28px", fontWeight: 600, fontSize: 14,
                  cursor: uploading ? "default" : "pointer",
                  opacity: uploading ? 0.8 : 1, transition: "background 0.2s",
                }}
              >
                {uploading ? "Saving..." : "Save to Database"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
