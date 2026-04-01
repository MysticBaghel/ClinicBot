# 🏥 ClinicBot — WhatsApp Appointment Booking Chatbot

A multi-tenant SaaS platform that lets clinics automate patient appointment booking via WhatsApp. Clinic owners manage everything through a web dashboard; patients interact naturally through WhatsApp.

---

## ✨ Features

### For Patients (WhatsApp)
- Book, cancel, and view appointments via WhatsApp chat
- Interactive button-based flows for easy navigation
- Query available doctors by day
- Duplicate appointment detection and smart warnings
- Handles free-text fallback when slot lists exceed WhatsApp's 10-row limit

### For Clinic Owners (Dashboard)
- Manage doctors, time slots, and services
- View and manage all appointments
- Configure bot settings (welcome messages, services as tags, etc.)
- Doctor-first time slot scheduling with independent time windows per doctor per day
- Mobile block screen (dashboard is desktop-only)

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (async), SQLAlchemy (async), PostgreSQL (asyncpg) |
| Frontend | React + Vite |
| Auth | OTP via SMS (MSG91) + JWT |
| Messaging | WhatsApp Cloud API (Meta) |
| AI / Q&A | Groq API (replaced Gemini due to rate limits) |
| Background Tasks | FastAPI BackgroundTasks |
| Session Storage | PostgreSQL |
| Deployment | Railway (planned) |

---

## ⚙️ Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL
- Meta WhatsApp Business Account with a permanent System User token

### Backend

```bash
cd Backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file:

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost/clinicbot
WHATSAPP_TOKEN=your_meta_system_user_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
VERIFY_TOKEN=your_webhook_verify_token
GROQ_API_KEY=your_groq_api_key
JWT_SECRET=your_jwt_secret
```

Run the server:

```bash
uvicorn main:app --reload
```

### Frontend

```bash
cd Frontend
npm install
npm run dev
```

---

## 📲 WhatsApp Webhook Setup

1. Set your webhook URL in the Meta Developer Console:
   ```
   https://your-domain.com/webhook
   ```
2. Use your `VERIFY_TOKEN` for verification.
3. Subscribe to the `messages` field under WhatsApp Business Account.

---

## 🤖 Bot Flow Overview

```
Patient sends message
        ↓
Intent Detection (keyword matching)
        ↓
  BOOK / CANCEL / STATUS / DOCTORS / GREETING
        ↓
Multi-turn session flow (stored in PostgreSQL)
        ↓
Appointment saved + WhatsApp confirmation sent
```

If no keyword intent is matched, the message is passed to **Groq AI** which:
- Answers questions using data from an **uploaded Excel file** (clinic-specific info like services, pricing, FAQs)
- Falls back to **general knowledge** for anything outside the dataset

### Supported Intents
| Intent | Trigger Keywords |
|---|---|
| `BOOK` | "book", "appointment", "schedule" |
| `CANCEL` | "cancel", "cancellation" (checked before BOOK) |
| `STATUS` | "status", "my appointments" |
| `DOCTORS` | "doctors", "available", "who" |
| `GREETING` | "hi", "hello", "hey" |

---

## 🧠 Key Design Decisions

- **Groq over Gemini** — Gemini's free tier rate limits were too restrictive; Groq offers a much more generous free tier for the same use case
- **No Celery/Redis** — BackgroundTasks + PostgreSQL keeps the stack simple and deploy-friendly
- **No LLM for intent detection** — Pure keyword matching is fast, predictable, and free
- **Session storage in PostgreSQL** — No separate cache layer needed
- **`skip_duplicate_check` flag** — Prevents infinite loops on "Book Another" flows; always cleared on session reset
- **24-hour `HH:MM` time format** — Ensures reliable slot sorting
- **CANCEL checked before BOOK** — More specific intents must be matched first to avoid false positives

---

## 🗺 Roadmap

- [ ] Add `done` field to appointments for tick persistence in dashboard
- [ ] Implement **Pocket · Plus · Prime** pricing plans in dashboard
- [ ] Deploy to Railway
- [ ] Onboard first 2–3 paying clinic clients

---

## 📄 License

Private — all rights reserved.
