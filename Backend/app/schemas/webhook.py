from pydantic import BaseModel, Field
from typing import Optional, List


# ── Innermost: message text ───────────────────────────────────────────────────
class WATextContent(BaseModel):
    body: str

# ── Interactive message types ─────────────────────────────────────────────────
class WAButtonReply(BaseModel):
    id: str
    title: str

class WAListReply(BaseModel):
    id: str
    title: str

class WAInteractive(BaseModel):
    type: str  # "button_reply" or "list_reply"
    button_reply: Optional[WAButtonReply] = None
    list_reply: Optional[WAListReply] = None


# ── One WhatsApp message ───────────────────────────────────────────────────────
class WAMessage(BaseModel):
    id: str
    from_: str = Field(alias="from")
    type: str
    timestamp: str
    text: Optional[WATextContent] = None
    interactive: Optional[WAInteractive] = None  # ADD THIS

    model_config = {"populate_by_name": True}


# ── Metadata about which phone number received the message ────────────────────
class WAProfile(BaseModel):
    name: str

class WAContact(BaseModel):
    profile: WAProfile
    wa_id: str

class WAMetadata(BaseModel):
    display_phone_number: str
    phone_number_id: str


# ── The "value" object inside a change ───────────────────────────────────────
class WAChangeValue(BaseModel):
    messaging_product: str
    metadata: WAMetadata
    contacts: Optional[List[WAContact]] = None
    messages: Optional[List[WAMessage]] = None


# ── One change inside an entry ────────────────────────────────────────────────
class WAChange(BaseModel):
    value: WAChangeValue
    field: str          # usually "messages"


# ── One entry (one WhatsApp Business Account) ─────────────────────────────────
class WAEntry(BaseModel):
    id: str
    changes: List[WAChange]


# ── Root payload ──────────────────────────────────────────────────────────────
class WhatsAppWebhookPayload(BaseModel):
    object: str         # always "whatsapp_business_account"
    entry: List[WAEntry]
