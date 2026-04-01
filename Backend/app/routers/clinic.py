import io
import base64
import openpyxl
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.tenant import Tenant
from app.services.auth import decode_token

router = APIRouter()
bearer = HTTPBearer()


async def get_current_tenant(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> Tenant:
    tenant_id = decode_token(credentials.credentials, "access")
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


def parse_clinic_excel(file_bytes: bytes) -> dict:
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.worksheets[0]

    clinic_info = {}
    services    = []
    mode        = None

    for row in ws.iter_rows(values_only=True):
        col0 = str(row[0] or "").strip()

        if not col0 or col0 in ("Field", "Field / Service Name"):
            continue
        if "CLINIC INFO" in col0:
            mode = "clinic"
            continue
        if "SERVICES" in col0 or col0 == "Service Name":
            mode = "services"
            continue

        if mode == "clinic" and row[1] is not None:
            clinic_info[col0] = str(row[1]).strip()

        elif mode == "services":
            services.append({
                "name":     col0,
                "price":    row[1] if row[1] is not None else "",
                "duration": row[2] if row[2] is not None else "",
                "category": str(row[3] or "").strip(),
                "note":     str(row[4] or "").strip(),
            })

    return {"clinic_info": clinic_info, "services": services}


@router.post("/upload-template")
async def upload_clinic_template(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files are supported")

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:  # 5 MB limit
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    try:
        parsed = parse_clinic_excel(contents)
    except Exception:
        raise HTTPException(status_code=422, detail="Failed to parse Excel file. Use the official template.")

    clinic_info = parsed["clinic_info"]
    services    = parsed["services"]

    if not clinic_info and not services:
        raise HTTPException(status_code=422, detail="No data found. Make sure you're using the official clinic template.")

    # Update tenant name if provided
    if clinic_info.get("Clinic Name"):
        tenant.name = clinic_info["Clinic Name"]

    # Build working_hours from opening/closing time + days
    working_hours = dict(tenant.working_hours or {})
    if clinic_info.get("Opening Time"):
        working_hours["opening_time"] = clinic_info["Opening Time"]
    if clinic_info.get("Closing Time"):
        working_hours["closing_time"] = clinic_info["Closing Time"]
    if clinic_info.get("Days Open"):
        working_hours["days_open"] = [d.strip() for d in clinic_info["Days Open"].split(",")]
    if clinic_info.get("Address"):
        working_hours["address"] = clinic_info["Address"]
    if clinic_info.get("Phone"):
        working_hours["clinic_phone"] = clinic_info["Phone"]
    if clinic_info.get("Email"):
        working_hours["email"] = clinic_info["Email"]
    if clinic_info.get("Notes"):
        working_hours["notes"] = clinic_info["Notes"]

    tenant.working_hours = working_hours
    tenant.services      = services
    tenant.working_hours = working_hours
    tenant.services      = services

    # ── Auto-build system_prompt from Excel data ──────────
    prompt_lines = [
        f"You are a helpful assistant for {tenant.name}.",
        "Answer patient questions using ONLY the clinic information provided below.",
        "Keep answers brief (under 150 words). Always end by suggesting *book* to book an appointment or *help* to speak with staff.\n",
    ]
    if working_hours:
        prompt_lines.append("📋 CLINIC DETAILS:")
        if working_hours.get("address"):
            prompt_lines.append(f"- Address: {working_hours['address']}")
        if working_hours.get("clinic_phone"):
            prompt_lines.append(f"- Phone: {working_hours['clinic_phone']}")
        if working_hours.get("email"):
            prompt_lines.append(f"- Email: {working_hours['email']}")
        if working_hours.get("opening_time") and working_hours.get("closing_time"):
            prompt_lines.append(f"- Hours: {working_hours['opening_time']} to {working_hours['closing_time']}")
        if working_hours.get("days_open"):
            prompt_lines.append(f"- Open days: {', '.join(working_hours['days_open'])}")
        if working_hours.get("notes"):
            prompt_lines.append(f"- Notes: {working_hours['notes']}")
    if services:
        prompt_lines.append("\n💊 SERVICES OFFERED:")
        for svc in services:
            line = f"- {svc['name']}"
            if svc.get("price"):  line += f" — ₹{svc['price']}"
            if svc.get("duration"): line += f" ({svc['duration']} min)"
            if svc.get("category"): line += f" [{svc['category']}]"
            if svc.get("note"):   line += f" | Note: {svc['note']}"
            prompt_lines.append(line)
    tenant.system_prompt = "\n".join(prompt_lines)
    # ── End ───────────────────────────────────────────────

    tenant.excel_file     = base64.b64encode(contents).decode("utf-8")
    # Store raw file as base64 so it can be restored on next login
    tenant.excel_file     = base64.b64encode(contents).decode("utf-8")
    tenant.excel_filename = file.filename

    await db.commit()
    await db.refresh(tenant)

    return {
        "message":        "Clinic template uploaded successfully",
        "clinic_name":    tenant.name,
        "services_count": len(services),
        "clinic_info":    clinic_info,
        "services":       services,
    }


@router.get("/file")
async def get_clinic_file(
    tenant: Tenant = Depends(get_current_tenant),
):
    """
    Returns the stored Excel file as base64 so the frontend can
    re-parse and display the preview without re-uploading.
    Returns 404 if no file has been uploaded yet.
    """
    if not tenant.excel_file:
        raise HTTPException(status_code=404, detail="No file uploaded yet")

    return {
        "filename":   tenant.excel_filename,
        "file_base64": tenant.excel_file,
    }
