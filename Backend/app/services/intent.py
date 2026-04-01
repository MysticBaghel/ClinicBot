from typing import Optional

# ── Intent labels ─────────────────────────────────────────────────────────────
BOOK         = "BOOK"
CANCEL       = "CANCEL"
SERVICES = "SERVICES"  # add with other labels at top
ASK_AI       = "ASK_AI"          # replaces FAQ — routes to Gemini
HANDOFF      = "HANDOFF"
GREETING     = "GREETING"
OUT_OF_SCOPE = "OUT_OF_SCOPE"
DOCTORS      = "DOCTORS"

# ── Keyword rules ─────────────────────────────────────────────────────────────
# IMPORTANT: More specific intents (CANCEL, DOCTORS) must be listed BEFORE
# broader ones (BOOK) so they are matched first.
KEYWORD_RULES = {
    CANCEL:  ["cancel", "cancellation", "drop", "remove appointment", "cancel appointment",
              "btn_cancel", "❌ cancel"],
    BOOK:    ["book", "schedule", "booking", "slot", "fix appointment", "buk", "new appointment",
              "btn_book", "📅 book"],
    HANDOFF: ["human", "agent", "talk to someone", "real person", "staff", "doctor directly", "help"],
    GREETING:["hi", "hello", "hey", "hlo", "hii", "good morning", "good evening", "namaste", "start"],
    DOCTORS: ["doctor", "doctors", "who's available", "whos available", "which doctor",
              "available doctor", "dr available", "today's doctor", "todays doctor",
              "btn_doctors", "👨‍⚕️ doctors"],
    # Add BEFORE ASK_AI in KEYWORD_RULES
    SERVICES: ["services", "service list", "what services", "all services", "tell all services",
                "what do you offer", "what you offer", "offerings", "treatments available",
                "what treatments", "list services", "show services"],
    ASK_AI:  ["what is", "what are", "how does", "how do", "how is", "how to",
              "tell me about", "explain", "is it", "can i", "should i",
              "does it", "why is", "why does", "ask", "question",
              "treatment", "symptom", "cure", "safe", "side effect", "cost", "price", "?"],
}


def _keyword_match(text: str) -> Optional[str]:
    lowered = text.lower().strip()
    for intent, keywords in KEYWORD_RULES.items():
        for kw in keywords:
            if kw in lowered:
                return intent
    return None


async def detect_intent(text: str, history: list, system_prompt: str = "") -> str:
    if not text:
        return OUT_OF_SCOPE
    matched = _keyword_match(text)
    return matched if matched else OUT_OF_SCOPE
