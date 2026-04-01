import httpx
from typing import Optional

WA_API_BASE = "https://graph.facebook.com/v18.0"


async def send_text(phone_number_id: str, access_token: str, to: str, text: str) -> bool:
    """
    Send a plain text message via WhatsApp Cloud API.
    Returns True if sent successfully.
    """
    url = f"{WA_API_BASE}/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text}
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if resp.status_code not in (200, 201):
                print("WhatsApp error:", resp.status_code, resp.text)
            return resp.status_code in (200, 201)
    except Exception as e:
        print("WhatsApp exception:", e)
        return False


async def send_buttons(
    phone_number_id: str,
    access_token: str,
    to: str,
    body_text: str,
    buttons: list[dict],   # [{"id": "btn_1", "title": "Blood Test"}, ...]
) -> bool:
    """
    Send an interactive button message (max 3 buttons).
    Used for service selection, confirmations etc.
    """
    url = f"{WA_API_BASE}/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {"text": body_text},
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": b["id"], "title": b["title"]}}
                    for b in buttons[:3]   # WhatsApp max is 3 buttons
                ]
            }
        }
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if resp.status_code not in (200, 201):
                print("WhatsApp error:", resp.status_code, resp.text)
            return resp.status_code in (200, 201)
    except Exception as e:
        print("WhatsApp exception:", e)
        return False


async def send_list(
    phone_number_id: str,
    access_token: str,
    to: str,
    body_text: str,
    button_label: str,
    items: list[str],
) -> bool:
    """
    Send an interactive list message (for showing services, time slots etc.)
    Good when you have more than 3 options.
    """
    url = f"{WA_API_BASE}/{phone_number_id}/messages"

    # WhatsApp requires title to be a non-empty string — guard against None or non-str values
    # Also: WhatsApp hard-limits list row titles to 24 characters.
    # If ANY item exceeds that, fall back to plain text for the whole list.
    clean_items = [str(item).strip() for item in items if item is not None and str(item).strip()]

    if not clean_items:
        return await send_text(phone_number_id, access_token, to,
                               f"{body_text}\n\n" + "\n".join(f"• {item}" for item in items if item))

    if any(len(item) > 24 for item in clean_items):
        items_text = "\n".join(f"• {item}" for item in clean_items)
        return await send_text(phone_number_id, access_token, to, f"{body_text}\n\n{items_text}")

    rows = [{"id": f"item_{i}", "title": item} for i, item in enumerate(clean_items)]

    if not rows:
        return await send_text(phone_number_id, access_token, to,
                               f"{body_text}\n\n" + "\n".join(f"• {item}" for item in clean_items))

    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "body": {"text": body_text},
            "action": {
                "button": button_label,
                "sections": [{"title": "Options", "rows": rows}]
            }
        }
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if resp.status_code not in (200, 201):
                print("WhatsApp error:", resp.status_code, resp.text)
            return resp.status_code in (200, 201)
    except Exception as e:
        print("WhatsApp exception:", e)
        return False
