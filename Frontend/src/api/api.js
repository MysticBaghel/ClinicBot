const BASE_URL = "https://your-api.com/api/v1"; // 🔌 CHANGE THIS

const API = {
  // AUTH
  login:           (email, password) => fetch(`${BASE_URL}/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ email, password }) }),
  logout:          ()                => fetch(`${BASE_URL}/auth/logout`, { method:"POST" }),
  getMe:           ()                => fetch(`${BASE_URL}/auth/me`),

  // DASHBOARD
  getDashboard:    (tenantId)        => fetch(`${BASE_URL}/tenants/${tenantId}/dashboard`),

  // APPOINTMENTS
  getAppointments: (tenantId, filters) => fetch(`${BASE_URL}/tenants/${tenantId}/appointments?${new URLSearchParams(filters)}`),
  getAppointment:  (tenantId, id)      => fetch(`${BASE_URL}/tenants/${tenantId}/appointments/${id}`),
  updateAppointment:(tenantId, id, data) => fetch(`${BASE_URL}/tenants/${tenantId}/appointments/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(data) }),
  cancelAppointment:(tenantId, id)     => fetch(`${BASE_URL}/tenants/${tenantId}/appointments/${id}/cancel`, { method:"POST" }),
  sendReminder:    (tenantId, id)      => fetch(`${BASE_URL}/tenants/${tenantId}/appointments/${id}/remind`, { method:"POST" }),

  // TIME SLOTS
  getSlots:        (tenantId, day)   => fetch(`${BASE_URL}/tenants/${tenantId}/slots?day=${day}`),
  updateSlots:     (tenantId, data)  => fetch(`${BASE_URL}/tenants/${tenantId}/slots`, { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify(data) }),

  // BOT CONFIG
  getBotConfig:    (tenantId)        => fetch(`${BASE_URL}/tenants/${tenantId}/config`),
  updateBotConfig: (tenantId, data)  => fetch(`${BASE_URL}/tenants/${tenantId}/config`, { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify(data) }),
  uploadServicesDoc:(tenantId, form) => fetch(`${BASE_URL}/tenants/${tenantId}/services/upload`, { method:"POST", body: form }),

  // PATIENTS
  getPatients:     (tenantId, filters) => fetch(`${BASE_URL}/tenants/${tenantId}/patients?${new URLSearchParams(filters)}`),

  // SUPER ADMIN
  getTenants:      ()                => fetch(`${BASE_URL}/admin/tenants`),
  createTenant:    (data)            => fetch(`${BASE_URL}/admin/tenants`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(data) }),
  toggleTenant:    (id, active)      => fetch(`${BASE_URL}/admin/tenants/${id}/status`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ active }) }),
};

export default API;
