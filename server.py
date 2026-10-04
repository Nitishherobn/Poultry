import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv, set_key, unset_key
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from icalendar import Calendar
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(ENV_PATH)

app = FastAPI(title="Daymark Local API", docs_url=None, redoc_url=None)


class StudyQuestion(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    tasks: list[str] = Field(default_factory=list, max_length=20)


class IntegrationSettings(BaseModel):
    canvas_ics_url: str | None = Field(default=None, max_length=4096)
    gemini_api_key: str | None = Field(default=None, max_length=256)
    gemini_model: str | None = Field(default=None, max_length=80)
    clear_canvas: bool = False
    clear_gemini: bool = False


def is_local_or_private(host: str) -> bool:
    if host in {"127.0.0.1", "::1", "localhost"}:
        return True
    return host.startswith(("192.168.", "10.", "172.", "141.215.", "169.254."))


def require_local_same_origin(request: Request) -> None:
    client_host = request.client.host if request.client else ""
    if not is_local_or_private(client_host):
        raise HTTPException(status_code=403, detail="Integration settings can only be changed from your local Daymark network.")


def save_environment_value(key: str, value: str | None) -> None:
    if value is None:
        unset_key(str(ENV_PATH), key)
        os.environ.pop(key, None)
        return
    set_key(str(ENV_PATH), key, value, quote_mode="always")
    os.environ[key] = value


def canvas_feed_url() -> str:
    feed_url = os.getenv("CANVAS_ICS_URL", "").strip()
    if not feed_url:
        raise HTTPException(status_code=503, detail="Canvas is not connected yet. Use Connect tools in Daymark to add a Canvas calendar feed.")
    parsed = urlparse(feed_url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise HTTPException(status_code=500, detail="Canvas feed configuration must be an HTTPS URL without embedded credentials.")
    return feed_url


def fetch_canvas_ics(feed_url: str) -> bytes:
    request = urllib.request.Request(feed_url, headers={"User-Agent": "Daymark/1.0 calendar import"})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            if urlparse(response.geturl()).hostname != urlparse(feed_url).hostname:
                raise HTTPException(status_code=502, detail="Canvas redirected the feed to a different host; import was stopped.")
            content = response.read(4 * 1024 * 1024 + 1)
    except HTTPException:
        raise
    except (urllib.error.URLError, TimeoutError) as error:
        raise HTTPException(status_code=502, detail="Could not reach the Canvas calendar feed. Check the URL and network connection.") from error
    if len(content) > 4 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Canvas calendar feed is larger than the 4 MB import limit.")
    return content


def event_datetime(value) -> datetime:
    if isinstance(value, datetime):
        result = value
    elif isinstance(value, date):
        result = datetime.combine(value, datetime.min.time())
    else:
        result = datetime.fromisoformat(str(value))
    if result.tzinfo is None:
        result = result.replace(tzinfo=timezone.utc)
    return result


def assignment_events(calendar_data: bytes) -> list[dict[str, str]]:
    try:
        calendar = Calendar.from_ical(calendar_data)
    except Exception as error:
        raise HTTPException(status_code=502, detail="Canvas returned an invalid calendar feed.") from error

    assignment_terms = re.compile(r"assignment|homework|quiz|exam|test|project|paper|due|discussion|lab|midterm|final", re.IGNORECASE)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=7)
    events: list[dict[str, str]] = []
    for component in calendar.walk("VEVENT"):
        summary = str(component.get("SUMMARY", "Canvas assignment")).strip()
        if not assignment_terms.search(summary):
            continue
        start = component.get("DTSTART")
        if start is None:
            continue
        due = event_datetime(start.dt)
        if due < cutoff:
            continue
        uid = str(component.get("UID", f"{summary}-{due.isoformat()}"))
        title = re.sub(r"^(assignment|quiz|event|calendar event)\s*:\s*", "", summary, flags=re.IGNORECASE).strip()
        events.append({"uid": uid, "title": title or summary, "due": due.date().isoformat()})
    events.sort(key=lambda item: (item["due"], item["title"].casefold()))
    return events


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/integrations/status")
def integrations_status():
    return {
        "canvas_configured": bool(os.getenv("CANVAS_ICS_URL", "").strip()),
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY", "").strip()),
        "gemini_model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
    }


@app.post("/api/integrations/configure")
def configure_integrations(settings: IntegrationSettings, request: Request):
    require_local_same_origin(request)

    canvas_url = settings.canvas_ics_url.strip() if settings.canvas_ics_url else None
    if canvas_url:
        parsed = urlparse(canvas_url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise HTTPException(status_code=422, detail="Canvas calendar feed must be an HTTPS URL without embedded username or password.")
    gemini_key = settings.gemini_api_key.strip() if settings.gemini_api_key else None
    model = settings.gemini_model.strip() if settings.gemini_model else None
    if model:
        if not re.fullmatch(r"[A-Za-z0-9._-]{1,80}", model):
            raise HTTPException(status_code=422, detail="Gemini model name contains unsupported characters.")

    if canvas_url:
        save_environment_value("CANVAS_ICS_URL", canvas_url)
    elif settings.clear_canvas:
        save_environment_value("CANVAS_ICS_URL", None)
    if gemini_key:
        save_environment_value("GEMINI_API_KEY", gemini_key)
    elif settings.clear_gemini:
        save_environment_value("GEMINI_API_KEY", None)
    if model:
        save_environment_value("GEMINI_MODEL", model)

    try:
        os.chmod(ENV_PATH, 0o600)
    except OSError:
        pass
    return integrations_status()


@app.get("/api/canvas/events")
def canvas_events():
    events = assignment_events(fetch_canvas_ics(canvas_feed_url()))
    return {"events": events, "count": len(events)}


@app.post("/api/study/chat")
def study_chat(question: StudyQuestion):
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini is not connected yet. Use Connect tools in Daymark to add an API key.")

    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"
    task_context = "\n".join(f"- {task[:200]}" for task in question.tasks[:20]) or "No current tasks provided."
    prompt = (
        "You are Daymark, a kind and concise study tutor. Help the student learn by explaining concepts, "
        "asking useful follow-up questions, and giving hints before complete answers. Do not claim to know "
        "their course materials unless included below.\n\n"
        f"Current tasks:\n{task_context}\n\nStudent question:\n{question.message.strip()}"
    )
    endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" + urllib.parse.quote(model, safe="") + ":generateContent"
    payload = json.dumps({
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 900},
    }).encode("utf-8")
    request = urllib.request.Request(endpoint, data=payload, headers={"Content-Type": "application/json", "x-goog-api-key": api_key}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            result = json.loads(response.read(1024 * 1024))
    except urllib.error.HTTPError as error:
        if error.code in (400, 401, 403, 404):
            raise HTTPException(status_code=502, detail="Gemini rejected the request. Check the API key, model name, and API access.") from error
        raise HTTPException(status_code=502, detail="Gemini is temporarily unavailable. Try again shortly.") from error
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=502, detail="Could not get a response from Gemini. Try again shortly.") from error

    try:
        answer = "\n".join(part["text"] for part in result["candidates"][0]["content"]["parts"] if "text" in part).strip()
    except (KeyError, IndexError, TypeError) as error:
        raise HTTPException(status_code=502, detail="Gemini returned an empty or unsupported response.") from error
    if not answer:
        raise HTTPException(status_code=502, detail="Gemini returned an empty response. Try asking in a different way.")
    return {"answer": answer, "model": model}


@app.get("/")
def index():
    return FileResponse(BASE_DIR / "index.html")


@app.get("/{asset_name}")
def frontend_asset(asset_name: str):
    if asset_name not in {"app.css", "app-details.css", "app.js", "colleges.js", "colleges.json"}:
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(BASE_DIR / asset_name)