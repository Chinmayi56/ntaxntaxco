"""NTAXCO ERP business modules: MongoDB-backed generic CRUD and workflows.

The legacy seed datasets remain in this source only as schema/reference material;
production startup never inserts them unless NTAXCO_ENABLE_DEMO_SEED=true."""
from fastapi import APIRouter, Body, HTTPException, Query, Depends
from datetime import datetime, timezone, timedelta
import uuid

# India Standard Time offset. Attendance check-in/out is always evaluated
# and stamped using server-side IST time (never a client-supplied
# timestamp) so it can't be spoofed and stays consistent regardless of the
# employee's browser timezone/clock. Stored as simple "HH:MM" / "YYYY-MM-DD"
# strings to match the existing seeded attendance format.
IST_OFFSET = timedelta(hours=5, minutes=30)


def _ist_now() -> datetime:
    return datetime.now(timezone.utc) + IST_OFFSET


def _ist_today_str() -> str:
    return _ist_now().strftime("%Y-%m-%d")


def _ist_time_str() -> str:
    return _ist_now().strftime("%H:%M")


def _hours_between(check_in: str, check_out: str) -> str:
    try:
        ih, im = (int(x) for x in check_in.split(":"))
        oh, om = (int(x) for x in check_out.split(":"))
        mins = (oh * 60 + om) - (ih * 60 + im)
        if mins < 0:
            mins = 0
        return f"{mins // 60}h {mins % 60:02d}m"
    except Exception:
        return "-"

READ_ROLES = {
    "employees": {"admin", "employee"}, "customers": {"admin", "employee", "agent", "customer"},
    "bookings": {"admin", "employee", "agent", "customer"}, "projects": {"admin", "employee", "agent", "customer"},
    "invoices": {"admin", "employee", "customer"}, "documents": {"admin", "employee", "agent", "customer"},
    "tickets": {"admin", "employee", "customer"}, "services": {"admin", "employee", "agent", "customer"},
    "gst": {"admin", "employee", "customer"}, "itr": {"admin", "employee", "customer"},
    "tds": {"admin", "employee", "customer"}, "roc": {"admin", "employee", "customer"},
    "attendance": {"admin", "employee"}, "leaves": {"admin", "employee"}, "tasks": {"admin", "employee"},
    "payslips": {"admin", "employee"}, "leads": {"admin", "agent"}, "appointments": {"admin", "employee", "agent"},
    "commissions": {"admin", "agent"}, "journal": {"admin"}, "payments": {"admin", "customer"},
    "agents": {"admin"}, "site-images": {"admin"},
}

WRITE_ROLES = {
    "employees": {"admin"}, "customers": {"admin", "agent"}, "bookings": {"admin", "customer", "agent"},
    "projects": {"admin"}, "invoices": {"admin"}, "documents": {"admin", "employee", "customer"},
    "tickets": {"admin", "customer"}, "services": {"admin"}, "gst": {"admin"}, "itr": {"admin"},
    "tds": {"admin"}, "roc": {"admin"}, "attendance": {"admin", "employee"}, "leaves": {"admin", "employee"},
    "tasks": {"admin", "employee"}, "payslips": {"admin"}, "leads": {"admin", "agent"},
    "appointments": {"admin", "agent"}, "commissions": {"admin"}, "journal": {"admin"},
    "payments": {"admin"}, "agents": {"admin"}, "site-images": {"admin"},
}

# ---------------- Centralized image management ----------------
# Placements an admin-uploaded image can be assigned to on the customer site.
SITE_IMAGE_PLACEMENTS = {"home", "dashboard", "projects", "services"}

# Roughly 5MB of raw image data once base64-encoded (base64 inflates size by
# ~4/3), used to keep a single Mongo document well under the 16MB doc limit
# and to stop an admin from accidentally uploading something huge.
MAX_IMAGE_DATA_LEN = 7_000_000


ALLOWED_DOCUMENT_MIMES = {"application/pdf", "image/jpeg", "image/png", "image/webp", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
MAX_DOCUMENT_DATA_LEN = 7_000_000

def _validate_document_upload(body: dict, user: dict) -> None:
    if "file_data" not in body:
        return
    data = str(body.get("file_data") or "")
    if len(data) > MAX_DOCUMENT_DATA_LEN:
        raise HTTPException(status_code=400, detail="Document is too large. Please upload a file under ~5MB.")
    if not data.startswith("data:") or ";base64," not in data[:120]:
        raise HTTPException(status_code=400, detail="Invalid document upload format")
    mime = data[5:data.find(";base64,")]
    if mime not in ALLOWED_DOCUMENT_MIMES:
        raise HTTPException(status_code=400, detail="Unsupported document type")
    body["mime_type"] = mime
    body["file_data"] = data
    body.setdefault("status", "Uploaded")
    body.setdefault("uploaded_by", user.get("name") or "Customer Upload")
    body.setdefault("uploaded_date", _ist_today_str())

def _validate_site_image(body: dict, *, partial: bool = False) -> None:
    """Normalize + validate a site-image payload in place. When `partial` is
    True (updates), a field is only checked if the caller actually sent it —
    so an edit that only changes the title doesn't need to resend the image."""
    if "placement" in body or not partial:
        placement = str(body.get("placement", "")).strip().lower()
        if placement not in SITE_IMAGE_PLACEMENTS:
            raise HTTPException(
                status_code=400,
                detail=f"Placement must be one of: {', '.join(sorted(SITE_IMAGE_PLACEMENTS))}",
            )
        body["placement"] = placement
    if "image" in body or not partial:
        image = str(body.get("image", "")).strip()
        if not image:
            raise HTTPException(status_code=400, detail="An image (file upload or URL) is required")
        if len(image) > MAX_IMAGE_DATA_LEN:
            raise HTTPException(status_code=400, detail="Image is too large. Please upload an image under ~5MB.")
        body["image"] = image
    if "title" in body:
        body["title"] = str(body.get("title") or "").strip()
    if "status" in body:
        status = str(body.get("status") or "Active").strip() or "Active"
        body["status"] = status

def _ok(data, message="OK", pagination=None):
    return {
        "success": True,
        "message": message,
        "data": data,
        "pagination": pagination,
        "meta": {"count": len(data) if isinstance(data, list) else 1},
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "request_id": str(uuid.uuid4()),
    }

# ---------------- MongoDB collections ----------------
# The second tuple item is intentionally empty: production data is created and
# updated through the authenticated APIs, never through hardcoded seed records.
COLLECTIONS = {
    "employees": ("erp_employees", [], "EMP"),
    "customers": ("erp_customers", [], "CUS"),
    "bookings": ("erp_bookings", [], "BKG"),
    "projects": ("erp_projects", [], "PRJ"),
    "invoices": ("erp_invoices", [], "INV"),
    "documents": ("erp_documents", [], "DOC"),
    "tickets": ("erp_tickets", [], "TKT"),
    "services": ("erp_services", [], "SVC"),
    "gst": ("erp_gst", [], "GST"),
    "itr": ("erp_itr", [], "ITR"),
    "tds": ("erp_tds", [], "TDS"),
    "roc": ("erp_roc", [], "ROC"),
    "attendance": ("erp_attendance", [], "ATT"),
    "leaves": ("erp_leaves", [], "LV"),
    "tasks": ("erp_tasks", [], "TSK"),
    "payslips": ("erp_payslips", [], "PAY"),
    "leads": ("erp_leads", [], "LEAD"),
    "appointments": ("erp_appointments", [], "APT"),
    "commissions": ("erp_commissions", [], "COM"),
    "journal": ("erp_journal", [], "JE"),
    "payments": ("erp_payments", [], "PMT"),
    "agents": ("erp_agents", [], "AG"),
    "site-images": ("erp_site_images", [], "IMG"),
}

PERSONAL_EMPLOYEE_COLLECTIONS = {"attendance", "leaves", "tasks", "payslips"}
CUSTOMER_SCOPED_COLLECTIONS = {"customers", "bookings", "invoices", "documents", "payments", "tickets", "projects", "gst", "itr", "tds", "roc"}
AGENT_SCOPED_COLLECTIONS = {"leads", "customers", "bookings", "projects", "appointments", "commissions", "documents"}


def build_erp_router(db, get_current_user):
    router = APIRouter(prefix="/api")

    async def _notify(role, title, description, category, ntype="information", priority=None, user_id=None):
        prio = priority or {"urgent": "High", "warning": "Medium", "information": "Low"}.get(ntype, "Low")
        targets = [user_id] if user_id else [u.get("id") async for u in db.users.find({"role": role}, {"_id": 0, "id": 1})]
        if not targets and role in {"admin", "all"}:
            targets = [None]
        docs = [{
            "id": f"NTF-{uuid.uuid4().hex[:8].upper()}", "role": role, "user_id": uid, "title": title,
            "description": description, "category": category, "type": ntype,
            "priority": prio, "read": False, "ts": datetime.now(timezone.utc).isoformat(),
        } for uid in targets]
        if docs:
            await db["erp_notifications"].insert_many(docs)

    async def _customer_user_by_id(customer_id):
        if not customer_id:
            return None
        return await db.users.find_one({"role": "customer", "$or": [{"id": customer_id}, {"meta.customer_id": customer_id}]}, {"_id": 0})

    async def _agent_user_by_name(agent_name):
        return await db.users.find_one({"role": "agent", "name": agent_name}, {"_id": 0})

    async def _employee_record_for_user(user: dict):
        """Resolve the erp_employees document that belongs to a logged-in employee user."""
        if user.get("role") != "employee":
            return None
        emp_id = (user.get("meta") or {}).get("employee_id")
        if emp_id:
            emp = await db["erp_employees"].find_one({"id": emp_id}, {"_id": 0})
            if emp:
                return emp
        mobile = user.get("mobile")
        if mobile:
            emp = await db["erp_employees"].find_one({"mobile": mobile}, {"_id": 0})
            if emp:
                return emp
        return None

    async def _sync_employee_user(emp: dict):
        """Keep the auth `users` record for an employee in sync with their erp_employees profile."""
        mobile = emp.get("mobile")
        if not mobile:
            return
        update = {
            "name": emp.get("name") or "Employee",
            "meta.employee_id": emp["id"],
            "meta.department": emp.get("department"),
            "meta.designation": emp.get("designation"),
            "meta.manager": emp.get("manager"),
        }
        existing = await db.users.find_one({"mobile": mobile, "role": "employee"})
        if existing:
            await db.users.update_one({"id": existing["id"]}, {"$set": update})
        else:
            await db.users.insert_one({
                "id": f"EMPLOYEE-{uuid.uuid4().hex[:8].upper()}",
                "name": emp.get("name") or "Employee",
                "email": emp.get("email"),
                "mobile": mobile,
                "role": "employee",
                "password_hash": None,
                "avatar": None,
                "meta": {
                    "employee_id": emp["id"],
                    "department": emp.get("department"),
                    "designation": emp.get("designation"),
                    "manager": emp.get("manager"),
                    "portal_login": True,
                },
            })

    # ---------------- self-service employee profile ----------------
    @router.get("/employees/me")
    async def get_my_employee_profile(user: dict = Depends(get_current_user)):
        if user.get("role") != "employee":
            raise HTTPException(status_code=403, detail="Only employees can access this endpoint")
        emp = await db["erp_employees"].find_one({"email": user.get("email")}, {"_id": 0})
        if not emp:
            raise HTTPException(status_code=404, detail="No employee profile found for this account yet")
        return _ok(emp)

    @router.put("/employees/me")
    async def update_my_employee_profile(body: dict = Body(...), user: dict = Depends(get_current_user)):
        if user.get("role") != "employee":
            raise HTTPException(status_code=403, detail="Only employees can access this endpoint")
        emp = await _employee_record_for_user(user)
        if not emp:
            raise HTTPException(status_code=404, detail="No employee profile found for this account yet")
        # Employees can only edit their own contact/address details, not HR fields.
        allowed_fields = {"email", "address", "state", "avatar"}
        update = {k: v for k, v in body.items() if k in allowed_fields}
        if update:
            await db["erp_employees"].update_one({"id": emp["id"]}, {"$set": update})
            emp = await db["erp_employees"].find_one({"id": emp["id"]}, {"_id": 0})
        return _ok(emp, message="Profile updated")

    def make_crud(name, coll, prefix):
        def guard_write(user):
            allowed = WRITE_ROLES.get(name, {"admin"})
            if user.get("role") not in allowed:
                raise HTTPException(status_code=403, detail=f"Your role is not permitted to modify {name}")

        is_personal = name in PERSONAL_EMPLOYEE_COLLECTIONS
        is_customer_scoped = name in CUSTOMER_SCOPED_COLLECTIONS

        def _owns_booking(item, user):
            return item.get("customer_id") == user.get("id")

        async def _employee_name(user):
            emp = await _employee_record_for_user(user)
            return emp.get("name") if emp else None

        async def _agent_name(user):
            if user.get("role") != "agent":
                return None
            agent_id = (user.get("meta") or {}).get("agent_id")
            if agent_id:
                agent = await db["erp_agents"].find_one({"id": agent_id}, {"_id": 0})
                if agent:
                    return agent.get("name")
            return user.get("name")

        async def _customer_profile(user):
            if user.get("role") != "customer":
                return None
            cid = (user.get("meta") or {}).get("customer_id")
            if cid:
                return await db["erp_customers"].find_one({"id": cid}, {"_id": 0})
            return await db["erp_customers"].find_one({"email": user.get("email")}, {"_id": 0})

        async def _audit(user, action, collection, item_id=None, changes=None):
            try:
                await db["erp_audit_logs"].insert_one({
                    "id": f"AUD-{uuid.uuid4().hex[:10].upper()}",
                    "action": action, "collection": collection, "item_id": item_id,
                    "user_id": user.get("id"), "role": user.get("role"),
                    "changes": changes or {}, "ts": datetime.now(timezone.utc).isoformat(),
                })
            except Exception:
                pass

        @router.get(f"/{name}", name=f"list_{name}")
        async def list_items(search: str = Query(None), status: str = Query(None), page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=500), user: dict = Depends(get_current_user)):
            if user.get("role") not in READ_ROLES.get(name, {"admin"}):
                raise HTTPException(status_code=403, detail=f"Your role is not permitted to view {name}")
            if name == "employees" and user.get("role") not in ("admin", "employee"):
                raise HTTPException(status_code=403, detail="You are not permitted to view employees")
            items = await db[coll].find({}, {"_id": 0}).to_list(2000)
            if is_personal and user.get("role") == "employee":
                emp = await _employee_record_for_user(user)
                emp_id = emp["id"] if emp else "__none__"
                items = [i for i in items if i.get("employee_id") == emp_id]
            if user.get("role") == "employee":
                emp = await _employee_record_for_user(user)
                emp_name = emp.get("name") if emp else None
                if name == "employees":
                    items = [i for i in items if emp and i.get("id") == emp["id"]]
                elif name == "customers":
                    items = [i for i in items if emp_name and i.get("assigned_employee") == emp_name]
                elif name in {"projects", "appointments"}:
                    items = [i for i in items if emp_name and (i.get("assigned_employee") == emp_name or i.get("employee") == emp_name)]
                elif name == "documents":
                    items = [i for i in items if emp_name and (i.get("uploaded_by") == emp_name or i.get("assigned_employee") == emp_name)]
            if user.get("role") == "agent" and name in AGENT_SCOPED_COLLECTIONS:
                agent_name = await _agent_name(user)
                items = [i for i in items if agent_name and (i.get("assigned_agent") == agent_name or i.get("agent") == agent_name or i.get("agent_name") == agent_name)]
                if name == "commissions" and agent_name:
                    items = [i for i in items if not i.get("agent") or i.get("agent") == agent_name]
            if is_customer_scoped and user.get("role") == "customer":
                if name == "customers":
                    profile = await _customer_profile(user)
                    items = [profile] if profile else []
                else:
                    items = [i for i in items if _owns_booking(i, user)]
            if search:
                s = search.lower()
                items = [i for i in items if any(s in str(v).lower() for v in i.values())]
            if status and status != "all":
                items = [i for i in items if str(i.get("status", "")).lower() == status.lower()]
            total = len(items)
            start = (page - 1) * page_size
            items = items[start:start + page_size]
            return _ok(items, pagination={"page": page, "page_size": page_size, "total": total, "pages": (total + page_size - 1) // page_size})

        @router.get(f"/{name}/{{item_id}}", name=f"get_{name}")
        async def get_item(item_id: str, user: dict = Depends(get_current_user)):
            item = await db[coll].find_one({"id": item_id}, {"_id": 0})
            if not item:
                raise HTTPException(status_code=404, detail=f"{name[:-1]} not found")
            if user.get("role") not in READ_ROLES.get(name, {"admin"}):
                raise HTTPException(status_code=403, detail=f"Your role is not permitted to view {name}")
            if user.get("role") == "employee" and (is_personal or name == "employees"):
                emp = await _employee_record_for_user(user)
                own_id = emp["id"] if emp else None
                owner_id = item.get("employee_id") if is_personal else item.get("id")
                if not own_id or owner_id != own_id:
                    raise HTTPException(status_code=403, detail="You can only view your own records")
            elif name == "employees" and user.get("role") not in ("admin",):
                raise HTTPException(status_code=403, detail="You are not permitted to view this employee")
            elif user.get("role") == "employee" and name in {"customers", "projects", "appointments", "documents"}:
                emp = await _employee_record_for_user(user); emp_name = emp.get("name") if emp else None
                allowed = (name == "customers" and item.get("assigned_employee") == emp_name) or (name in {"projects", "appointments"} and (item.get("assigned_employee") == emp_name or item.get("employee") == emp_name)) or (name == "documents" and (item.get("uploaded_by") == emp_name or item.get("assigned_employee") == emp_name))
                if not allowed:
                    raise HTTPException(status_code=404, detail=f"{name[:-1].title()} not found")
            elif user.get("role") == "agent" and name in AGENT_SCOPED_COLLECTIONS:
                agent_name = await _agent_name(user)
                if not (item.get("assigned_agent") == agent_name or item.get("agent") == agent_name or item.get("agent_name") == agent_name):
                    raise HTTPException(status_code=404, detail=f"{name[:-1].title()} not found")
            elif name == "customers" and user.get("role") == "customer":
                profile = await _customer_profile(user)
                if not profile or profile.get("id") != item.get("id"):
                    raise HTTPException(status_code=404, detail="Customer not found")
            elif is_customer_scoped and user.get("role") == "customer" and not _owns_booking(item, user):
                raise HTTPException(status_code=404, detail=f"{name[:-1].title()} not found")
            return _ok(item)

        async def _attach_customer_id(body: dict, user: dict):
            if name not in {"customers", "bookings", "projects", "invoices", "documents", "tickets", "payments", "gst", "itr", "tds", "roc"}:
                return
            if user.get("role") == "customer":
                body["customer_id"] = user.get("id")
                return
            if body.get("customer_id"):
                return
            customer_name = body.get("customer") or body.get("client") or body.get("client_name") or body.get("company") or body.get("business_name")
            if customer_name:
                customer = await db["erp_customers"].find_one({"business_name": customer_name}, {"_id": 0})
                if customer:
                    account = await db.users.find_one({"role": "customer", "meta.customer_id": customer.get("id")}, {"_id": 0})
                    if account:
                        body["customer_id"] = account["id"]

        def _normalize_invoice(body: dict, existing: dict = None):
            if name != "invoices":
                return
            taxable = float(body.get("taxable", (existing or {}).get("taxable", 0)) or 0)
            discount = float(body.get("discount", (existing or {}).get("discount", 0)) or 0)
            rate = float(body.get("rate", (existing or {}).get("rate", 18)) or 18)
            if taxable < 0 or discount < 0 or discount > taxable or rate < 0 or rate > 100:
                raise HTTPException(status_code=400, detail="Invalid taxable amount, discount, or GST rate")
            net = round(taxable - discount, 2)
            gstin = body.get("gst_number", (existing or {}).get("gst_number", ""))
            # Same-state vs interstate is represented by the existing `istate` flag;
            # default to CGST/SGST for local invoices.
            if body.get("istate", (existing or {}).get("istate", False)):
                cgst = sgst = 0; igst = round(net * rate / 100, 2)
            else:
                cgst = round(net * (rate / 2) / 100, 2); sgst = cgst; igst = 0
            body.update({"taxable": taxable, "discount": discount, "rate": rate, "cgst": cgst, "sgst": sgst, "igst": igst, "total": round(net + cgst + sgst + igst, 2)})

        @router.post(f"/{name}", name=f"create_{name}")
        async def create_item(body: dict = Body(...), user: dict = Depends(get_current_user)):
            guard_write(user)
            await _attach_customer_id(body, user)
            if name == "documents":
                _validate_document_upload(body, user)
            _normalize_invoice(body)
            if name == "site-images":
                _validate_site_image(body)
                body.setdefault("status", "Active")
                body["created_at"] = datetime.now(timezone.utc).isoformat()
            emp = None
            if is_personal and user.get("role") == "employee":
                emp = await _employee_record_for_user(user)
                if not emp:
                    raise HTTPException(status_code=404, detail="No employee profile is linked to your account yet. Contact your admin.")
                # Employees may only ever create records under their own identity.
                body["employee_id"] = emp["id"]
                body["employee_name"] = emp.get("name")
                if name == "leaves":
                    body["status"] = "Pending"
                if name == "attendance":
                    # This is a Check In. Never trust a client-supplied date/time —
                    # always stamp with server-side IST time so it can't be spoofed
                    # and can't drift from the server's own duplicate-check below.
                    today = _ist_today_str()
                    existing_today = await db[coll].find_one(
                        {"employee_id": emp["id"], "date": today}, {"_id": 0}
                    )
                    if existing_today:
                        # Already checked in today — this is not an error condition,
                        # just return the existing record so the frontend can show
                        # the correct state instead of surfacing a failure.
                        return _ok(existing_today, message="You have already checked in today")
                    body["date"] = today
                    body["check_in"] = _ist_time_str()
                    body["check_out"] = "-"
                    body["hours"] = "-"
                    body.setdefault("status", "Present")

            new_id = body.get("id")
            if name == "employees":
                # Keep the human-entered Employee ID (emp_id) as the canonical id
                # so it lines up with the ID shown in the UI and used for auth linking.
                candidate = body.get("emp_id") or body.get("id")
                if candidate and not await db[coll].find_one({"id": candidate}):
                    new_id = candidate
                else:
                    new_id = f"{prefix}-{uuid.uuid4().hex[:6].upper()}"
                body["emp_id"] = new_id
            elif not new_id or await db[coll].find_one({"id": new_id}):
                new_id = f"{prefix}-{uuid.uuid4().hex[:6].upper()}"
            body["id"] = new_id

            if name == "bookings":
                body.setdefault("created_at", datetime.now(timezone.utc).isoformat())
                body.setdefault("status", "Pending")
                body.setdefault("payment_status", "Pending")
            if name in CUSTOMER_SCOPED_COLLECTIONS and user.get("role") == "customer":
                # Always trust the logged-in user's identity for ownership — never a
                # client-supplied customer_id, name, or company string.
                body["customer_id"] = user.get("id")
            await db[coll].insert_one({**body})
            body.pop("_id", None)
            await _audit(user, "create", name, new_id, body)

            if name == "employees":
                # Provision / update the real auth account so this employee can log in.
                await _sync_employee_user(body)
            if name == "leaves" and user.get("role") == "employee":
                await _notify("admin", "New leave request", f"{body.get('employee_name', 'An employee')} requested {body.get('leave_type', 'leave')} ({body.get('from_date')} to {body.get('to_date')}).", "Attendance", "warning")
            if name == "bookings":
                cust = body.get("customer", "A customer"); svc = body.get("service", "a service")
                agent = body.get("assigned_agent", "your consultant"); prio = body.get("priority", "Low")
                await _notify("admin", f"New booking {new_id} received", f"{cust} requested {svc}. Priority: {prio}.", "Bookings", "warning")
                agent_user = await _agent_user_by_name(agent)
                cust_user = await _customer_user_by_id(body.get("customer_id"))
                await _notify("agent", f"New booking assigned: {new_id}", f"{cust} — {svc}. Due {body.get('due_date') or 'TBD'}.", "Bookings", "warning", user_id=(agent_user or {}).get("id"))
                await _notify("customer", f"Booking {new_id} submitted", f"{svc} assigned to {agent}. Status: {body.get('status', 'Pending')}.", "Bookings", "information", user_id=(cust_user or {}).get("id"))
            return _ok(body, message=f"{name[:-1].title()} created")

        @router.put(f"/{name}/{{item_id}}", name=f"update_{name}")
        async def update_item(item_id: str, body: dict = Body(...), user: dict = Depends(get_current_user)):
            guard_write(user)
            existing = await db[coll].find_one({"id": item_id}, {"_id": 0})
            if not existing:
                raise HTTPException(status_code=404, detail="Not found")
            _normalize_invoice(body, existing)
            if name == "site-images":
                _validate_site_image(body, partial=True)

            emp = None
            if is_personal and user.get("role") == "employee":
                emp = await _employee_record_for_user(user)
                own_id = emp["id"] if emp else None
                if not own_id or existing.get("employee_id") != own_id:
                    raise HTTPException(status_code=403, detail="You can only update your own records")
                # Employees cannot approve/reject their own leave requests.
                if name == "leaves":
                    body.pop("status", None)
                body["employee_id"] = own_id
                if name == "attendance":
                    # This is a Check Out. Verify the employee actually checked in
                    # first, and always stamp the check-out time server-side rather
                    # than trusting whatever the browser sends.
                    check_in = existing.get("check_in")
                    if not check_in or check_in == "-":
                        raise HTTPException(status_code=400, detail="Please check in first.")
                    if existing.get("check_out") and existing.get("check_out") != "-":
                        # Already checked out today — return the existing record
                        # instead of failing or silently overwriting it.
                        return _ok(existing, message="You have already checked out today")
                    check_out = _ist_time_str()
                    body["check_out"] = check_out
                    body["hours"] = _hours_between(check_in, check_out)
                    body.setdefault("status", existing.get("status") or "Present")

            if is_customer_scoped and user.get("role") == "customer":
                if not _owns_booking(existing, user):
                    raise HTTPException(status_code=404, detail=f"{name[:-1].title()} not found")
                # Customers cannot re-assign ownership or fake payment/status state via edits.
                body.pop("customer_id", None)
                if name == "bookings":
                    body.pop("payment_status", None)

            body.pop("_id", None); body.pop("id", None)
            res = await db[coll].update_one({"id": item_id}, {"$set": body})
            if res.matched_count == 0:
                raise HTTPException(status_code=404, detail="Not found")
            item = await db[coll].find_one({"id": item_id}, {"_id": 0})
            await _audit(user, "update", name, item_id, body)

            if name == "employees":
                await _sync_employee_user(item)
            if name == "leaves" and body.get("status") and user.get("role") == "admin":
                st = body.get("status")
                await _notify("employee", f"Leave request {st.lower()}", f"Your {item.get('leave_type', 'leave')} request ({item.get('from_date')} to {item.get('to_date')}) was {st.lower()}.", "Attendance", "information" if st == "Approved" else "warning")
            if name == "bookings" and body.get("status"):
                st = body.get("status")
                await _notify("customer", f"Booking {item_id} update", f"Your booking status is now '{st}'.", "Bookings", "information")
                await _notify("admin", f"Booking {item_id} → {st}", f"Consultant updated booking {item_id} to '{st}'.", "Bookings", "information")
            return _ok(item, message=f"{name[:-1].title()} updated")

        @router.delete(f"/{name}/{{item_id}}", name=f"delete_{name}")
        async def delete_item(item_id: str, user: dict = Depends(get_current_user)):
            guard_write(user)
            if is_personal and user.get("role") == "employee":
                existing = await db[coll].find_one({"id": item_id}, {"_id": 0})
                emp = await _employee_record_for_user(user)
                own_id = emp["id"] if emp else None
                if not existing or not own_id or existing.get("employee_id") != own_id:
                    raise HTTPException(status_code=403, detail="You can only delete your own records")
            if is_customer_scoped and user.get("role") == "customer":
                existing = await db[coll].find_one({"id": item_id}, {"_id": 0})
                if not existing or not _owns_booking(existing, user):
                    raise HTTPException(status_code=404, detail=f"{name[:-1].title()} not found")
            res = await db[coll].delete_one({"id": item_id})
            if res.deleted_count == 0:
                raise HTTPException(status_code=404, detail="Not found")
            await _audit(user, "delete", name, item_id)
            if name == "employees":
                await db.users.delete_one({"meta.employee_id": item_id, "role": "employee"})
            return _ok({"id": item_id}, message=f"{name[:-1].title()} deleted")

    for name, (coll, seed, prefix) in COLLECTIONS.items():
        make_crud(name, coll, prefix)

    @router.get("/admin/dashboard")
    async def admin_dashboard(user: dict = Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        async def count(name, query=None):
            coll = COLLECTIONS[name][0]
            return await db[coll].count_documents(query or {})
        customers = await count("customers")
        employees = await count("employees")
        agents = await count("agents", {"status": "Active"})
        projects = await db["erp_projects"].find({}, {"_id": 0}).to_list(5000)
        invoices = await db["erp_invoices"].find({}, {"_id": 0}).to_list(5000)
        bookings = await db["erp_bookings"].find({}, {"_id": 0}).to_list(5000)
        compliance = []
        for n in ("gst", "itr", "tds", "roc"):
            compliance.extend(await db[COLLECTIONS[n][0]].find({}, {"_id": 0}).to_list(5000))
        revenue = sum(float(i.get("total") or 0) for i in invoices if i.get("payment_status") == "Paid")
        outstanding = sum(float(i.get("total") or 0) for i in invoices if i.get("payment_status") != "Paid")
        revenue_monthly = {}
        customer_monthly = {}
        filing_monthly = {}
        for inv in invoices:
            m = str(inv.get("invoice_date") or inv.get("issue_date") or "")[:7]
            if m:
                revenue_monthly[m] = revenue_monthly.get(m, 0) + (float(inv.get("total") or 0) if inv.get("payment_status") == "Paid" else 0)
        customer_rows = await db["erp_customers"].find({}, {"_id": 0, "created_at": 1}).to_list(5000)
        for cdoc in customer_rows:
            m = str(cdoc.get("created_at") or "")[:7]
            if m: customer_monthly[m] = customer_monthly.get(m, 0) + 1
        for n in ("gst", "itr"):
            for row in await db[COLLECTIONS[n][0]].find({}, {"_id": 0}).to_list(5000):
                m = str(row.get("period") or row.get("filed_date") or row.get("created_at") or "")[:7]
                if m: filing_monthly.setdefault(m, {"gst": 0, "itr": 0})[n] += 1
        emp_rows = await db["erp_employees"].find({}, {"_id": 0, "name": 1, "performance": 1}).to_list(5000)
        performance = [{"name": e.get("name"), "score": float(e.get("performance") or 0)} for e in emp_rows if e.get("name")]
        return _ok({
            "cards": {"customers": customers, "employees": employees, "active_agents": agents,
                      "running_projects": sum(1 for p in projects if p.get("status") == "Running"),
                      "completed_projects": sum(1 for p in projects if p.get("status") == "Completed"),
                      "pending_projects": sum(1 for p in projects if p.get("status") == "Pending"),
                      "revenue": revenue, "outstanding": outstanding,
                      "paid_invoices": sum(1 for i in invoices if i.get("payment_status") == "Paid"),
                      "pending_invoices": sum(1 for i in invoices if i.get("payment_status") not in ("Paid", "Cancelled")),
                      "bookings": len(bookings), "compliance_open": sum(1 for c in compliance if c.get("status") not in ("Completed", "Filed", "Approved"))},
            "projects": projects, "invoices": invoices, "bookings": bookings, "compliance": compliance,
            "charts": {
                "revenue_monthly": [{"m": k, "revenue": v} for k,v in sorted(revenue_monthly.items())],
                "customer_growth": [{"m": k, "customers": v} for k,v in sorted(customer_monthly.items())],
                "filing_trend": [{"m": k, **v} for k,v in sorted(filing_monthly.items())],
                "performance": performance,
            }},
            message="Dashboard loaded")

    @router.get("/customer/dashboard")
    async def customer_dashboard(user: dict = Depends(get_current_user)):
        if user.get("role") != "customer":
            raise HTTPException(status_code=403, detail="Only customers can access this endpoint")
        cid = user.get("id")

        bookings = await db["erp_bookings"].find({"customer_id": cid}, {"_id": 0}).to_list(2000)
        invoices = await db["erp_invoices"].find({"customer_id": cid}, {"_id": 0}).to_list(2000)
        documents = await db["erp_documents"].find({"customer_id": cid}, {"_id": 0}).to_list(2000)
        tickets = await db["erp_tickets"].find({"customer_id": cid}, {"_id": 0}).to_list(2000)
        notifications = await db["erp_notifications"].find({"$or": [{"user_id": cid}, {"role": "all"}]}, {"_id": 0}).to_list(500)

        completed = [b for b in bookings if b.get("status") == "Completed"]
        active = [b for b in bookings if b.get("status") in ("Pending", "Running", "Confirmed")]
        paid_invoices = [i for i in invoices if i.get("payment_status") == "Paid"]
        pending_invoices = [i for i in invoices if i.get("payment_status") != "Paid"]
        outstanding = sum((i.get("total") or 0) for i in pending_invoices)
        payment_pending_bookings = [b for b in bookings if b.get("payment_status") != "Paid"]
        filings = []
        for n in ("gst", "itr", "tds", "roc"):
            rows = await db[COLLECTIONS[n][0]].find({"customer_id": cid}, {"_id": 0}).to_list(500)
            filings.extend(rows)
        spending = {}
        for i in invoices:
            month = str(i.get("invoice_date") or i.get("issue_date") or "")[:7]
            if month:
                spending[month] = spending.get(month, 0) + float(i.get("total") or 0)
        service_usage = {}
        for b in bookings:
            service_usage[b.get("service") or "Other"] = service_usage.get(b.get("service") or "Other", 0) + 1

        return _ok({
            "cards": {
                "total_services": len(bookings), "active_services": len(active),
                "completed_services": len(completed), "pending_payment": len(payment_pending_bookings),
                "outstanding": outstanding, "payments_done": len(paid_invoices),
                "pending_invoices": len(pending_invoices), "documents": len(documents),
                "notifications": len([n for n in notifications if not n.get("read")]),
                "tickets": len([t for t in tickets if t.get("status") not in ("Closed", "Resolved")]),
            },
            "filings": filings,
            "spending": [{"m": k, "amount": v} for k, v in sorted(spending.items())],
            "service_usage": [{"name": k, "value": v} for k, v in service_usage.items()],
            "due_dates": [{"title": b.get("service") or "Service", "date": b.get("due_date"), "type": "Service"} for b in bookings if b.get("due_date")],
        })

    @router.get("/reminders")
    async def reminders(user: dict = Depends(get_current_user)):
        from datetime import date
        today = date.today()
        out = []
        def add(title, company, due, kind, assigned):
            if not due:
                return
            try:
                d = date.fromisoformat(due)
            except Exception:
                return
            days = (d - today).days
            if days < 0:
                prio, ntype = "Overdue", "urgent"
            elif days <= 3:
                prio, ntype = "High", "warning"
            elif days <= 10:
                prio, ntype = "Medium", "information"
            else:
                prio, ntype = "Low", "information"
            out.append({"title": title, "company": company, "due_date": due, "days_remaining": days, "priority": prio, "type": ntype, "kind": kind, "assigned": assigned})

        for r in await db["erp_gst"].find({"status": {"$ne": "Completed"}}, {"_id": 0}).to_list(100):
            add(f"GST {r.get('return_type')} due", r.get("client"), r.get("due_date"), "GST", r.get("consultant"))
        for r in await db["erp_itr"].find({"status": {"$ne": "Completed"}}, {"_id": 0}).to_list(100):
            add("Income Tax return due", r.get("client"), r.get("due_date"), "Income Tax", r.get("consultant"))
        for r in await db["erp_tds"].find({"status": {"$ne": "Completed"}}, {"_id": 0}).to_list(100):
            add(f"TDS {r.get('form')} {r.get('quarter')} due", r.get("client"), r.get("due_date"), "TDS", "-")
        for r in await db["erp_roc"].find({"status": {"$ne": "Completed"}}, {"_id": 0}).to_list(100):
            add(f"ROC {r.get('form')} due", r.get("company"), r.get("due_date"), "ROC", r.get("consultant"))
        for r in await db["erp_invoices"].find({"payment_status": {"$ne": "Paid"}}, {"_id": 0}).to_list(100):
            add(f"Invoice {r.get('invoice_no')} payment due", r.get("customer"), r.get("invoice_date"), "Invoice", "-")

        out.sort(key=lambda x: x["days_remaining"])
        summary = {
            "today": len([x for x in out if x["days_remaining"] == 0]),
            "this_week": len([x for x in out if 0 <= x["days_remaining"] <= 7]),
            "overdue": len([x for x in out if x["days_remaining"] < 0]),
            "upcoming": len(out),
        }
        return _ok({"reminders": out, "summary": summary})

    @router.get("/accounting/summary")
    async def accounting_summary(user: dict = Depends(get_current_user)):
        income = 300500
        expenses = 425000
        return _ok({
            "income": income, "expenses": expenses, "profit": income - expenses,
            "cash_flow": [
                {"m": "Apr", "in": 610000, "out": 480000}, {"m": "May", "in": 540000, "out": 460000},
                {"m": "Jun", "in": 720000, "out": 505000}, {"m": "Jul", "in": 680000, "out": 425000},
            ],
            "pnl": [
                {"account": "Service Revenue", "amount": 1560000, "type": "Income"},
                {"account": "Consultancy Revenue", "amount": 640000, "type": "Income"},
                {"account": "Salaries", "amount": 380000, "type": "Expense"},
                {"account": "Office Rent", "amount": 45000, "type": "Expense"},
                {"account": "Software & Tools", "amount": 28000, "type": "Expense"},
                {"account": "Marketing", "amount": 62000, "type": "Expense"},
            ],
            "balance_sheet": [
                {"item": "Cash & Bank", "amount": 1240000, "type": "Asset"},
                {"item": "Accounts Receivable", "amount": 685000, "type": "Asset"},
                {"item": "Fixed Assets", "amount": 520000, "type": "Asset"},
                {"item": "Accounts Payable", "amount": 210000, "type": "Liability"},
                {"item": "Loans", "amount": 300000, "type": "Liability"},
                {"item": "Owner's Equity", "amount": 1935000, "type": "Equity"},
            ],
            "trial_balance": [
                {"account": "Bank", "debit": 1240000, "credit": 0},
                {"account": "Accounts Receivable", "debit": 685000, "credit": 0},
                {"account": "Service Revenue", "debit": 0, "credit": 1560000},
                {"account": "Consultancy Revenue", "debit": 0, "credit": 640000},
                {"account": "Salaries", "debit": 380000, "credit": 0},
                {"account": "Office Rent", "debit": 45000, "credit": 0},
            ],
        })

    @router.get("/notifications")
    async def list_notifications(search: str = Query(None), user: dict = Depends(get_current_user)):
        role = user.get("role")
        q = {"$or": [{"user_id": user.get("id")}, {"role": role, "user_id": {"$exists": False}}, {"role": "all"}]}
        items = await db["erp_notifications"].find(q, {"_id": 0}).sort("ts", -1).to_list(500)
        if search:
            s = search.lower()
            items = [i for i in items if s in (i.get("title", "") + i.get("description", "") + i.get("category", "")).lower()]
        unread = len([i for i in items if not i.get("read")])
        return _ok({"notifications": items, "unread": unread})

    @router.post("/notifications/{nid}/read")
    async def mark_read(nid: str, user: dict = Depends(get_current_user)):
        res = await db["erp_notifications"].update_one({"id": nid, "$or": [{"user_id": user.get("id")}, {"role": user.get("role"), "user_id": {"$exists": False}}, {"role": "all"}]}, {"$set": {"read": True}})
        if not res.matched_count:
            raise HTTPException(status_code=404, detail="Notification not found")
        return _ok({"id": nid}, message="Marked read")

    @router.post("/notifications/read-all")
    async def mark_all_read(user: dict = Depends(get_current_user)):
        await db["erp_notifications"].update_many({"$or": [{"user_id": user.get("id")}, {"role": user.get("role"), "user_id": {"$exists": False}}, {"role": "all"}]}, {"$set": {"read": True}})
        return _ok({}, message="All marked read")

    @router.delete("/notifications/{nid}")
    async def del_notification(nid: str, user: dict = Depends(get_current_user)):
        res = await db["erp_notifications"].delete_one({"id": nid, "$or": [{"user_id": user.get("id")}, {"role": user.get("role"), "user_id": {"$exists": False}}, {"role": "all"}]})
        if not res.deleted_count:
            raise HTTPException(status_code=404, detail="Notification not found")
        return _ok({"id": nid}, message="Deleted")

  

    

    # ---------------- Payments (modular Razorpay: real when keys present, else demo test-mock) ----------------
    def _rzp_client():
        kid = os.environ.get("RAZORPAY_KEY_ID"); ksec = os.environ.get("RAZORPAY_KEY_SECRET")
        if kid and ksec:
            try:
                import razorpay
                return razorpay.Client(auth=(kid, ksec)), kid
            except Exception:
                return None, None
        return None, None

    @router.post("/payments/create-order")
    async def create_order(body: dict = Body(...), user: dict = Depends(get_current_user)):
        amount_rupees = float(body.get("amount") or 0)
        if amount_rupees <= 0:
            raise HTTPException(status_code=400, detail="Invalid amount")
        amount_paise = int(round(amount_rupees * 100))
        client, kid = _rzp_client()
        if client:
            order = client.order.create({"amount": amount_paise, "currency": "INR", "payment_capture": 1})
            return _ok({"order_id": order["id"], "amount": amount_paise, "currency": "INR", "key_id": kid, "mode": "live"})
        order_id = f"order_{uuid.uuid4().hex[:14]}"
        return _ok({"order_id": order_id, "amount": amount_paise, "currency": "INR",
                    "key_id": os.environ.get("RAZORPAY_KEY_ID", "rzp_test_DEMO1234567890"), "mode": "test"})

    @router.post("/payments/verify")
    async def verify_payment(body: dict = Body(...), user: dict = Depends(get_current_user)):
        order_id = body.get("order_id")
        if not order_id:
            raise HTTPException(status_code=422, detail="order_id is required")
        payment_id = body.get("payment_id") or f"pay_{uuid.uuid4().hex[:14]}"
        signature = body.get("signature")
        booking_id = body.get("booking_id")
        fee = float(body.get("amount") or 0)
        gst = float(body.get("gst") or 0)
        agent = body.get("agent", "Vikram Singh")

        # Idempotency: if this order was already verified (customer refreshed the
        # page, double-clicked, or retried after a slow response), return the
        # original result instead of creating a second payment/invoice pair.
        existing_payment = await db["erp_payments"].find_one({"order_id": order_id}, {"_id": 0})
        if existing_payment:
            return _ok({
                "payment_id": existing_payment["payment_id"], "order_id": order_id,
                "reference_no": existing_payment["reference_no"], "invoice_no": existing_payment["invoice_no"],
                "receipt_no": existing_payment.get("receipt_no", ""), "amount": existing_payment["amount"],
                "gst": existing_payment["gst"], "total": existing_payment["total"],
                "status": existing_payment["status"], "date": existing_payment["txn_date"],
            }, message="Payment already verified")

        booking = None
        if booking_id:
            booking = await db["erp_bookings"].find_one({"id": booking_id}, {"_id": 0})
            if not booking:
                raise HTTPException(status_code=404, detail="Booking not found")
            # A customer can only ever pay for their own booking — never trust a
            # booking_id blindly, or another customer's pending booking could be
            # marked paid on their behalf.
            if user.get("role") == "customer" and booking.get("customer_id") != user.get("id"):
                raise HTTPException(status_code=403, detail="You can only pay for your own booking")

        # The customer name shown on the invoice/payment record comes from the
        # authenticated user (or the booking they own), never an unauthenticated
        # client-supplied string.
        customer = (booking.get("customer") if booking else None) or user.get("name") or body.get("customer", "Customer")
        customer_id = booking.get("customer_id") if booking else (user.get("id") if user.get("role") == "customer" else None)

        client, _ = _rzp_client()
        if client and signature:
            try:
                client.utility.verify_payment_signature({
                    "razorpay_order_id": order_id, "razorpay_payment_id": payment_id, "razorpay_signature": signature,
                })
            except Exception:
                raise HTTPException(status_code=400, detail="Payment signature verification failed")

        now = datetime.now(timezone.utc)
        total = round(fee + gst)
        inv_no = f"INV-{3200 + int(now.timestamp()) % 800}"
        rcpt_no = f"RCPT-{uuid.uuid4().hex[:8].upper()}"
        txn_ref = f"TXN{int(now.timestamp())}"
        date_str = now.strftime("%Y-%m-%d")

        await db["erp_payments"].insert_one({
            "id": payment_id, "payment_id": payment_id, "order_id": order_id, "reference_no": txn_ref,
            "customer": customer, "customer_id": customer_id, "invoice_no": inv_no,
            "amount": round(fee), "gst": round(gst), "total": total,
            "mode": "Razorpay", "status": "Completed", "txn_date": date_str, "agent": agent,
            "booking_id": booking_id, "receipt_no": rcpt_no, "remarks": "Booking payment via Razorpay (test)",
        })
        await db["erp_invoices"].insert_one({
            "id": inv_no, "invoice_no": inv_no, "customer": customer, "customer_id": customer_id,
            "booking_id": booking_id, "amount": round(fee), "gst": round(gst),
            "total": total, "status": "Paid", "payment_status": "Paid", "issue_date": date_str, "due_date": date_str,
        })
        if booking_id:
            await db["erp_bookings"].update_one({"id": booking_id}, {"$set": {"status": "Confirmed", "payment_status": "Paid"}})

        await _notify("admin", f"Payment received — {txn_ref}", f"{customer} paid ₹{total:,} for booking {booking_id or ''}. Invoice {inv_no}.", "Invoice", "information")
        await _notify("agent", f"Booking {booking_id or ''} paid & confirmed", f"{customer} completed payment of ₹{total:,}. You can begin the work.", "Invoice", "information")
        await _notify("customer", f"Payment successful — {inv_no}", f"Your payment of ₹{total:,} is confirmed. Booking {booking_id or ''} is now Confirmed.", "Invoice", "information")

        return _ok({
            "payment_id": payment_id, "order_id": order_id, "reference_no": txn_ref, "invoice_no": inv_no,
            "receipt_no": rcpt_no, "amount": round(fee), "gst": round(gst), "total": total,
            "status": "Completed", "date": date_str,
        }, message="Payment verified")

    # ---------------- Per-booking chat thread ----------------
    async def _authorize_booking_chat(booking_id: str, user: dict):
        booking = await db["erp_bookings"].find_one({"id": booking_id}, {"_id": 0})
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        role = user.get("role")
        if role == "admin":
            return booking
        if role == "customer" and booking.get("customer_id") == user.get("id"):
            return booking
        if role == "agent" and booking.get("assigned_agent") == (await _agent_name(user)):
            return booking
        if role == "employee":
            emp = await _employee_record_for_user(user)
            if emp and booking.get("assigned_employee") == emp.get("name"):
                return booking
        raise HTTPException(status_code=404, detail="Booking not found")

    @router.get("/bookings/{booking_id}/messages")
    async def list_booking_messages(booking_id: str, user: dict = Depends(get_current_user)):
        await _authorize_booking_chat(booking_id, user)
        msgs = await db["erp_booking_chat"].find({"booking_id": booking_id}, {"_id": 0}).sort("ts", 1).to_list(500)
        return _ok({"messages": msgs})

    @router.post("/bookings/{booking_id}/messages")
    async def add_booking_message(booking_id: str, body: dict = Body(...), user: dict = Depends(get_current_user)):
        await _authorize_booking_chat(booking_id, user)
        text = (body.get("text") or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="Message is required")
        role = user.get("role", "customer")
        name = user.get("name") or {"customer": "Customer", "agent": "Consultant", "admin": "NTAXCO Admin", "employee": "NTAXCO Team"}.get(role, role.title())
        doc = {
            "id": f"MSG-{uuid.uuid4().hex[:8].upper()}", "booking_id": booking_id,
            "sender_role": role, "sender_name": name, "text": text,
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        await db["erp_booking_chat"].insert_one({**doc})
        target = "agent" if role == "customer" else "customer"
        await _notify(target, f"New message on {booking_id}", f"{name}: {text[:60]}", "Bookings", "information")
        return _ok(doc, message="Message sent")


    @router.get("/employee/dashboard")
    async def employee_dashboard(user: dict = Depends(get_current_user)):
        if user.get("role") != "employee":
            raise HTTPException(status_code=403, detail="Employee access required")
        emp = await _employee_record_for_user(user)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee profile not found")
        emp_name, emp_id = emp.get("name"), emp.get("id")
        customers = await db["erp_customers"].count_documents({"assigned_employee": emp_name})
        projects = await db["erp_projects"].find({"assigned_employee": emp_name}, {"_id": 0}).to_list(2000)
        tasks = await db["erp_tasks"].find({"employee_id": emp_id}, {"_id": 0}).to_list(2000)
        attendance = await db["erp_attendance"].find({"employee_id": emp_id}, {"_id": 0}).to_list(500)
        leaves = await db["erp_leaves"].find({"employee_id": emp_id}, {"_id": 0}).to_list(500)
        docs = await db["erp_documents"].find({"$or": [{"uploaded_by": emp_name}, {"assigned_employee": emp_name}]}, {"_id": 0}).to_list(2000)
        return _ok({
            "employee": emp, "cards": {
                "customers": customers, "projects": len(projects),
                "running_projects": sum(1 for p in projects if p.get("status") == "Running"),
                "completed_tasks": sum(1 for t in tasks if str(t.get("status","")).lower() in ("completed","done")),
                "pending_tasks": sum(1 for t in tasks if str(t.get("status","")).lower() not in ("completed","done")),
                "attendance_days": len(attendance), "pending_leaves": sum(1 for l in leaves if l.get("status") == "Pending"),
                "documents": len(docs),
            },
            "projects": projects, "tasks": tasks, "attendance": attendance[-31:], "leaves": leaves,
        })

    @router.get("/agent/dashboard")
    async def agent_dashboard(user: dict = Depends(get_current_user)):
        if user.get("role") != "agent":
            raise HTTPException(status_code=403, detail="Agent access required")
        agent_id = (user.get("meta") or {}).get("agent_id")
        agent_doc = await db["erp_agents"].find_one({"id": agent_id}, {"_id": 0}) if agent_id else None
        agent_name = (agent_doc or {}).get("name") or user.get("name")
        leads = await db["erp_leads"].find({"$or": [{"assigned_agent": agent_name}, {"agent": agent_name}, {"agent_name": agent_name}]}, {"_id": 0}).to_list(2000)
        customers = await db["erp_customers"].count_documents({"assigned_agent": agent_name})
        bookings = await db["erp_bookings"].find({"assigned_agent": agent_name}, {"_id": 0}).to_list(2000)
        projects = await db["erp_projects"].find({"assigned_agent": agent_name}, {"_id": 0}).to_list(2000)
        commissions = await db["erp_commissions"].find({"agent": agent_name}, {"_id": 0}).to_list(2000)
        appointments = await db["erp_appointments"].find({"$or": [{"assigned_agent": agent_name}, {"agent": agent_name}]}, {"_id": 0}).to_list(2000)
        notifications = await db["erp_notifications"].count_documents({"$or": [{"role": "agent", "user_id": user.get("id")}, {"role": "agent", "user_id": {"$exists": False}}, {"role": "all"}]})
        monthly = {}
        for row in commissions:
            period = row.get("period") or str(row.get("created_at",""))[:7] or "Unknown"
            monthly[period] = monthly.get(period, 0) + float(row.get("amount") or 0)
        return _ok({
            "cards": {
                "leads": len(leads), "new_leads": sum(1 for x in leads if str(x.get("status","")).lower() in ("new","open")),
                "qualified_leads": sum(1 for x in leads if str(x.get("status","")).lower() == "qualified"),
                "converted_customers": sum(1 for x in leads if str(x.get("status","")).lower() in ("converted","won")),
                "followups": sum(1 for x in leads if str(x.get("status","")).lower() in ("follow-up","followup")),
                "appointments": sum(1 for x in appointments if str(x.get("status","")).lower() not in ("completed","cancelled")),
                "customers": customers, "projects": len(projects), "bookings": len(bookings),
                "commission": sum(float(x.get("amount") or 0) for x in commissions), "notifications": notifications,
            },
            "leads": leads, "bookings": bookings, "projects": projects, "commissions": commissions,
            "appointments": appointments, "commission_trend": [{"period": k, "amount": v} for k,v in sorted(monthly.items())],
        })

    @router.post("/calculators/gst")
    async def gst_calculator(body: dict = Body(...), user: dict = Depends(get_current_user)):
        if user.get("role") != "customer":
            raise HTTPException(status_code=403, detail="Customer access required")
        try:
            amount = float(body.get("amount", 0)); rate = float(body.get("rate", 0))
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="Amount and GST rate must be numbers")
        if amount < 0 or rate < 0 or rate > 100:
            raise HTTPException(status_code=422, detail="Enter a valid amount and GST rate")
        mode = str(body.get("mode", "exclusive")).lower()
        interstate = bool(body.get("interstate", False))
        if mode == "inclusive":
            base = round(amount / (1 + rate / 100), 2) if rate else round(amount, 2)
            gst = round(amount - base, 2)
            total = round(amount, 2)
        else:
            base = round(amount, 2); gst = round(base * rate / 100, 2); total = round(base + gst, 2)
        return _ok({"base_amount": base, "gst_amount": gst,
                    "cgst": 0 if interstate else round(gst/2,2),
                    "sgst": 0 if interstate else round(gst/2,2),
                    "igst": gst if interstate else 0, "final_amount": total,
                    "mode": mode, "rate": rate}, message="GST estimate calculated")

    @router.post("/calculators/income-tax")
    async def income_tax_calculator(body: dict = Body(...), user: dict = Depends(get_current_user)):
        if user.get("role") != "customer":
            raise HTTPException(status_code=403, detail="Customer access required")
        try:
            annual = max(0.0, float(body.get("annual_income", 0) or 0))
            deductions = max(0.0, float(body.get("deductions", 0) or 0))
            other = max(0.0, float(body.get("other_income", 0) or 0))
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="Income and deductions must be numbers")
        regime = str(body.get("regime", "new")).lower()
        taxable = max(0.0, annual + other - deductions)
        if regime == "old":
            slabs = [(250000,0),(500000,.05),(1000000,.20),(float("inf"),.30)]
            tax = 0.0; prev=0.0
            for upper, rate in slabs:
                taxable_slice=max(0.0,min(taxable,upper)-prev); tax += taxable_slice*rate
                if taxable <= upper: break
                prev=upper
            if taxable <= 500000: tax=max(0.0,tax-12500)
        else:
            slabs = [(400000,0),(800000,.05),(1200000,.10),(1600000,.15),(2000000,.20),(2400000,.25),(float("inf"),.30)]
            tax=0.0; prev=0.0
            for upper, rate in slabs:
                taxable_slice=max(0.0,min(taxable,upper)-prev); tax += taxable_slice*rate
                if taxable <= upper: break
                prev=upper
            if taxable <= 1200000: tax=max(0.0,tax-60000)
        cess = round(tax * .04, 2)
        estimated = round(tax + cess, 2)
        return _ok({"gross_income": round(annual+other,2), "deductions": round(deductions,2),
                    "taxable_income": round(taxable,2), "income_tax": round(tax,2),
                    "cess": cess, "estimated_tax": estimated, "regime": regime,
                    "assessment_year": "2026-27"}, message="Income tax estimate calculated")
    return router


async def seed_erp(db):
    """Optional development seed, disabled by default.

    Real ERP deployments must start with an empty/real MongoDB database and
    create records through the authenticated Admin/portal workflows. Existing
    MongoDB data is never deleted or overwritten by startup.
    """
    import os
    if os.getenv("NTAXCO_ENABLE_DEMO_SEED", "false").lower() != "true":
        return
    for name, (coll, seed, prefix) in COLLECTIONS.items():
        if await db[coll].count_documents({}) == 0 and seed:
            await db[coll].insert_many([{**d} for d in seed])
