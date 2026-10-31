import { useState, useEffect } from "react";
import { C } from "../constants/theme";
import { Card, SectionTitle, Spinner } from "../components/UI";

const BASE_URL = "http://localhost:8000";

const DAYS_LIST = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const ALL_TIMES = [];

for (let h = 6; h <= 22; h++) {
  ["00", "30"].forEach((m) => {
    if (h === 22 && m === "30") return;

    const ampm = h < 12 ? "AM" : "PM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;

    ALL_TIMES.push({
      value: `${String(h).padStart(2, "0")}:${m}`,
      label: `${h12}:${m} ${ampm}`,
    });
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeDoctor = (name = "") => ({
  id: `${Date.now()}-${Math.random()}`,
  name,
  ranges: [{ from: "09:00", to: "13:00" }],
});

const createDefaultSchedule = () =>
  Object.fromEntries(
    DAYS_LIST.map((day, index) => [
      day,
      {
        open: index < 6,
        doctors: index < 6 ? [makeDoctor()] : [],
      },
    ])
  );

// Normalize backend data before putting it into React state.
// This prevents missing days, doctors, or ranges from crashing the page.
const normalizeSchedule = (data) => {
  const source =
    data?.schedule && typeof data.schedule === "object"
      ? data.schedule
      : data;

  const defaults = createDefaultSchedule();

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return defaults;
  }

  const normalized = {};

  DAYS_LIST.forEach((day) => {
    const incoming = source[day];
    const fallback = defaults[day];

    if (!incoming || typeof incoming !== "object") {
      normalized[day] = fallback;
      return;
    }

    const doctors = Array.isArray(incoming.doctors)
      ? incoming.doctors.map((doctor) => ({
          id: doctor.id || `${Date.now()}-${Math.random()}`,
          name: typeof doctor.name === "string" ? doctor.name : "",
          ranges: Array.isArray(doctor.ranges)
            ? doctor.ranges.map((range) => ({
                from: range?.from || "",
                to: range?.to || "",
              }))
            : [{ from: "09:00", to: "13:00" }],
        }))
      : fallback.doctors;

    normalized[day] = {
      open:
        typeof incoming.open === "boolean"
          ? incoming.open
          : fallback.open,
      doctors,
    };
  });

  return normalized;
};

// Count total 30-minute slots across all doctors for one day.
const totalSlots = (dayObj) => {
  let count = 0;

  const doctors = Array.isArray(dayObj?.doctors)
    ? dayObj.doctors
    : [];

  doctors.forEach((doctor) => {
    const ranges = Array.isArray(doctor?.ranges)
      ? doctor.ranges
      : [];

    ranges.forEach((range) => {
      if (!range?.from || !range?.to || range.from >= range.to) {
        return;
      }

      const [fh, fm] = range.from.split(":").map(Number);
      const [th, tm] = range.to.split(":").map(Number);

      if (
        !Number.isFinite(fh) ||
        !Number.isFinite(fm) ||
        !Number.isFinite(th) ||
        !Number.isFinite(tm)
      ) {
        return;
      }

      let current = fh * 60 + fm;
      const end = th * 60 + tm;

      while (current < end) {
        count++;
        current += 30;
      }
    });
  });

  return count;
};

// ─── Reusable time select ───────────────────────────────────────────────────

function TimeSelect({ value, onChange, minVal }) {
  const options = ALL_TIMES.filter(
    (time) => !minVal || time.value > minVal
  );

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "9px 12px",
        border: `1.5px solid ${C.border}`,
        borderRadius: 9,
        fontSize: 13,
        color: C.text,
        background: "#fff",
        fontFamily: C.font,
        cursor: "pointer",
      }}
    >
      <option value="">Select time</option>

      {options.map((time) => (
        <option key={time.value} value={time.value}>
          {time.label}
        </option>
      ))}
    </select>
  );
}

// ─── Single doctor card ─────────────────────────────────────────────────────

function DoctorCard({
  doctor,
  onNameChange,
  onAddRange,
  onRemoveRange,
  onUpdateRange,
  onRemoveDoctor,
  isOnly,
}) {
  const ranges = Array.isArray(doctor.ranges)
    ? doctor.ranges
    : [];

  return (
    <div
      style={{
        border: `1.5px solid ${C.border}`,
        borderRadius: 14,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "13px 20px",
          background: "#FAFBFC",
          borderBottom: "1.5px solid #F1F5F9",
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "#EFF6FF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          👨‍⚕️
        </div>

        <input
          value={doctor.name || ""}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Enter doctor name…"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: 14,
            fontWeight: 700,
            color: C.text,
            background: "transparent",
            fontFamily: C.font,
          }}
        />

        {!isOnly && (
          <button
            onClick={onRemoveDoctor}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "1.5px solid #FCA5A5",
              background: "transparent",
              color: C.red,
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "16px 20px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#94A3B8",
            letterSpacing: ".5px",
            marginBottom: 10,
          }}
        >
          TIME WINDOWS
        </div>

        {ranges.map((range, ri) => {
          const invalid =
            (range.from || range.to) &&
            (!range.from || !range.to || range.from >= range.to);

          return (
            <div
              key={ri}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                background: C.pageBg,
                borderRadius: 10,
                border: `1.5px solid ${
                  invalid ? "#FCA5A5" : C.border
                }`,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#94A3B8",
                  flexShrink: 0,
                  width: 62,
                }}
              >
                Window {ri + 1}
              </span>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#CBD5E1",
                    marginBottom: 3,
                    letterSpacing: ".5px",
                  }}
                >
                  FROM
                </div>

                <TimeSelect
                  value={range.from}
                  onChange={(value) =>
                    onUpdateRange(ri, "from", value)
                  }
                />
              </div>

              <div
                style={{
                  fontSize: 18,
                  color: "#CBD5E1",
                  paddingTop: 18,
                  flexShrink: 0,
                }}
              >
                →
              </div>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#CBD5E1",
                    marginBottom: 3,
                    letterSpacing: ".5px",
                  }}
                >
                  TO
                </div>

                <TimeSelect
                  value={range.to}
                  minVal={range.from}
                  onChange={(value) =>
                    onUpdateRange(ri, "to", value)
                  }
                />
              </div>

              {ranges.length > 1 && (
                <button
                  onClick={() => onRemoveRange(ri)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    border: "1.5px solid #FCA5A5",
                    background: "transparent",
                    color: C.red,
                    cursor: "pointer",
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={onAddRange}
          style={{
            width: "100%",
            padding: "9px",
            border: `1.5px dashed ${C.border}`,
            borderRadius: 9,
            background: "transparent",
            fontSize: 12,
            fontWeight: 600,
            color: "#94A3B8",
            cursor: "pointer",
            fontFamily: C.font,
            transition: "border-color .15s, color .15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = C.blue;
            e.currentTarget.style.color = C.blue;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = C.border;
            e.currentTarget.style.color = "#94A3B8";
          }}
        >
          + Add time window
        </button>
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function TimeSlotsPage({ tenantId }) {
  const [activeDay, setActiveDay] = useState("Monday");
  const [schedule, setSchedule] = useState(createDefaultSchedule);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("access_token");

  // ── Load schedule ─────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const loadSchedule = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${BASE_URL}/slots`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Could not load schedule (HTTP ${response.status})`
          );
        }

        const data = await response.json();

        if (!cancelled) {
          setSchedule(normalizeSchedule(data));
        }
      } catch (err) {
        console.error("Schedule loading error:", err);

        if (!cancelled) {
          setError(err.message || "Could not load schedule.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSchedule();

    return () => {
      cancelled = true;
    };
  }, [tenantId, token]);

  // ── Day helpers ───────────────────────────────────────────────────────────

  const toggleOpen = () => {
    setSchedule((current) => {
      const day = current[activeDay] || {
        open: false,
        doctors: [],
      };

      const doctors = Array.isArray(day.doctors)
        ? day.doctors
        : [];

      const nowOpen = !day.open;

      return {
        ...current,
        [activeDay]: {
          ...day,
          open: nowOpen,
          doctors:
            nowOpen && doctors.length === 0
              ? [makeDoctor()]
              : doctors,
        },
      };
    });
  };

  // ── Doctor helpers ────────────────────────────────────────────────────────

  const addDoctor = () => {
    setSchedule((current) => {
      const day = current[activeDay];

      return {
        ...current,
        [activeDay]: {
          ...day,
          doctors: [...day.doctors, makeDoctor()],
        },
      };
    });
  };

  const removeDoctor = (doctorIndex) => {
    setSchedule((current) => {
      const day = current[activeDay];

      return {
        ...current,
        [activeDay]: {
          ...day,
          doctors: day.doctors.filter(
            (_, index) => index !== doctorIndex
          ),
        },
      };
    });
  };

  const updateDocName = (doctorIndex, name) => {
    setSchedule((current) => {
      const day = current[activeDay];

      const doctors = day.doctors.map((doctor, index) =>
        index === doctorIndex
          ? { ...doctor, name }
          : doctor
      );

      return {
        ...current,
        [activeDay]: {
          ...day,
          doctors,
        },
      };
    });
  };

  // ── Range helpers ─────────────────────────────────────────────────────────

  const addRange = (doctorIndex) => {
    setSchedule((current) => {
      const day = current[activeDay];

      const doctors = day.doctors.map((doctor, index) =>
        index === doctorIndex
          ? {
              ...doctor,
              ranges: [
                ...doctor.ranges,
                { from: "", to: "" },
              ],
            }
          : doctor
      );

      return {
        ...current,
        [activeDay]: {
          ...day,
          doctors,
        },
      };
    });
  };

  const removeRange = (doctorIndex, rangeIndex) => {
    setSchedule((current) => {
      const day = current[activeDay];

      const doctors = day.doctors.map((doctor, index) =>
        index === doctorIndex
          ? {
              ...doctor,
              ranges: doctor.ranges.filter(
                (_, idx) => idx !== rangeIndex
              ),
            }
          : doctor
      );

      return {
        ...current,
        [activeDay]: {
          ...day,
          doctors,
        },
      };
    });
  };

  const updateRange = (
    doctorIndex,
    rangeIndex,
    field,
    value
  ) => {
    setSchedule((current) => {
      const day = current[activeDay];

      const doctors = day.doctors.map((doctor, index) =>
        index === doctorIndex
          ? {
              ...doctor,
              ranges: doctor.ranges.map((range, idx) =>
                idx === rangeIndex
                  ? { ...range, [field]: value }
                  : range
              ),
            }
          : doctor
      );

      return {
        ...current,
        [activeDay]: {
          ...day,
          doctors,
        },
      };
    });
  };

  // ── Save schedule ─────────────────────────────────────────────────────────

  const saveSlots = async () => {
    setSaving(true);
    setSaved(false);
    setError("");

    try {
      const response = await fetch(`${BASE_URL}/slots`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ schedule }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(
          message || `Could not save schedule (HTTP ${response.status})`
        );
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Schedule saving error:", err);
      setError(err.message || "Could not save schedule.");
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 40, color: C.textMed }}>
        Loading schedule…
      </div>
    );
  }

  // Always resolve the selected day to a valid object.
  const day = schedule[activeDay] || {
    open: false,
    doctors: [],
  };

  const doctors = Array.isArray(day.doctors)
    ? day.doctors
    : [];

  const slots = totalSlots(day);

  // Sidebar indicator colour.
  const dotColor = (dayName) => {
    const currentDay = schedule[dayName];

    if (!currentDay?.open) return C.textLight;

    return totalSlots(currentDay) > 0
      ? C.green
      : C.yellow;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ animation: "fadeUp .3s ease both" }}>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 22,
        }}
      >
        <SectionTitle
          title="Time Slot Manager"
          sub="Set doctors and their available hours per day."
        />

        <button
          onClick={saveSlots}
          disabled={saving}
          style={{
            padding: "10px 24px",
            background: saved ? C.green : C.blue,
            border: "none",
            borderRadius: C.radiusSm,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
            fontFamily: C.font,
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "background .3s",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? <Spinner /> : null}
          {saving
            ? "Saving…"
            : saved
              ? "✓ Saved!"
              : "Save Changes"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            borderRadius: 10,
            border: "1px solid #FCA5A5",
            background: "#FEF2F2",
            color: "#B91C1C",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Main grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Day sidebar */}
        <Card style={{ padding: 8 }}>
          {DAYS_LIST.map((dayName) => {
            const dayConfig = schedule[dayName] || {
              open: false,
              doctors: [],
            };

            return (
              <div
                key={dayName}
                className="tab-btn"
                onClick={() => setActiveDay(dayName)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 14px",
                  borderRadius: 12,
                  marginBottom: 2,
                  background:
                    activeDay === dayName
                      ? C.blueLight
                      : "transparent",
                  color:
                    activeDay === dayName
                      ? C.blue
                      : C.textMed,
                  cursor: "pointer",
                  transition: "all .12s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: dotColor(dayName),
                    }}
                  />

                  <span
                    style={{
                      fontSize: 13,
                      fontWeight:
                        activeDay === dayName ? 700 : 500,
                    }}
                  >
                    {dayName}
                  </span>
                </div>

                <span style={{ fontSize: 11 }}>
                  {dayConfig.open ? "Open" : "Closed"}
                </span>
              </div>
            );
          })}
        </Card>

        {/* Right panel */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Open/closed toggle */}
          <Card style={{ padding: "18px 24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  onClick={toggleOpen}
                  role="switch"
                  aria-checked={day.open}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleOpen();
                    }
                  }}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    background: day.open ? C.blue : "#CBD5E1",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background .2s",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 3,
                      left: day.open ? 23 : 3,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "left .2s",
                      boxShadow: "0 1px 3px rgba(0,0,0,.2)",
                    }}
                  />
                </div>

                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: day.open ? C.text : C.textLight,
                  }}
                >
                  {activeDay} —{" "}
                  {day.open
                    ? "Clinic is Open"
                    : "Clinic is Closed"}
                </span>
              </div>

              {day.open && slots > 0 && (
                <span
                  style={{
                    fontSize: 12,
                    color: C.textMed,
                  }}
                >
                  {slots} slots across {doctors.length} doctor(s)
                </span>
              )}
            </div>
          </Card>

          {/* Open day */}
          {day.open ? (
            <>
              {doctors.map((doctor, doctorIndex) => (
                <DoctorCard
                  key={doctor.id || doctorIndex}
                  doctor={doctor}
                  isOnly={doctors.length === 1}
                  onNameChange={(name) =>
                    updateDocName(doctorIndex, name)
                  }
                  onAddRange={() => addRange(doctorIndex)}
                  onRemoveRange={(rangeIndex) =>
                    removeRange(doctorIndex, rangeIndex)
                  }
                  onUpdateRange={(rangeIndex, field, value) =>
                    updateRange(
                      doctorIndex,
                      rangeIndex,
                      field,
                      value
                    )
                  }
                  onRemoveDoctor={() =>
                    removeDoctor(doctorIndex)
                  }
                />
              ))}

              {/* Add doctor */}
              <button
                onClick={addDoctor}
                style={{
                  width: "100%",
                  padding: 14,
                  border: `2px dashed ${C.border}`,
                  borderRadius: 14,
                  background: "transparent",
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.textMed,
                  cursor: "pointer",
                  fontFamily: C.font,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all .15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = C.blue;
                  e.currentTarget.style.color = C.blue;
                  e.currentTarget.style.background = C.blueLight;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = C.border;
                  e.currentTarget.style.color = C.textMed;
                  e.currentTarget.style.background = "transparent";
                }}
              >
                ＋ Add Doctor
              </button>
            </>
          ) : (
            <Card
              style={{
                padding: "60px 24px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>
                🔒
              </div>

              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: C.text,
                  marginBottom: 8,
                }}
              >
                Clinic is closed on {activeDay}
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: C.textMed,
                  marginBottom: 20,
                }}
              >
                Patients cannot book appointments on this day.
              </div>

              <button
                className="btn-blue"
                onClick={toggleOpen}
                style={{
                  padding: "10px 24px",
                  background: C.blue,
                  border: "none",
                  borderRadius: C.radiusSm,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: C.font,
                }}
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