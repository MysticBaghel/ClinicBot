import os
import httpx
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant" 

FALLBACK_MESSAGE = (
    "Sorry, I couldn't find an answer to that right now. 🙏\n\n"
    "You can type *help* to speak with our staff, or *book* to book an appointment."
)


async def ask_groq(question: str, system_prompt: str = "") -> str:
    """
    Send a patient question to Groq (Llama 3.1 8B).
    Returns the model's answer, or FALLBACK_MESSAGE on any error.
    system_prompt is the tenant's custom prompt (clinic context / instructions).
    """
    if not GROQ_API_KEY:
        print("[groq] GROQ_API_KEY not set — returning fallback.")
        return FALLBACK_MESSAGE

    system = system_prompt.strip() if system_prompt else (
        "You are a helpful assistant for a medical clinic. "
        "Answer patient questions clearly and concisely. "
        "Do not provide specific medical diagnoses. "
        "Keep answers brief (under 150 words) and suggest the patient consult a doctor for serious concerns."
    )

    user_message = (
        f"{question}\n\n"
        "Answer briefly and helpfully. End by suggesting to type *book* to book an appointment "
        "or *help* to speak with staff if needed."
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user",   "content": user_message},
                    ],
                    "max_tokens": 250,
                    "temperature": 0.4,
                },
            )

        if response.status_code != 200:
            print(f"[groq] API error {response.status_code}: {response.text[:200]}")
            return FALLBACK_MESSAGE

        data = response.json()
        answer = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )
        return answer if answer else FALLBACK_MESSAGE

    except httpx.TimeoutException:
        print("[groq] Request timed out.")
        return FALLBACK_MESSAGE
    except Exception as e:
        print(f"[groq] Unexpected error: {e}")
        return FALLBACK_MESSAGE
