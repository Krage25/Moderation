from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from pymongo import MongoClient
from fastapi.responses import JSONResponse
from io import BytesIO
import pandas as pd
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from docx import Document
from docx.shared import Pt, RGBColor
import pytz
from dateutil import parser

# === MongoDB setup ===
client = MongoClient("mongodb://cdac:user%40cdac!@13.201.47.59:27017/?authSource=csmart")
db = client["csmart"]
links_col = db["ai_video_links"]
logs_col = db["download_logs"]

app = FastAPI(title="IT Rules Link Logger API")

# === CORS Middleware ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

IST = pytz.timezone("Asia/Kolkata")

# === Pydantic Models ===
class LinkModel(BaseModel):
    url: str
    comments: str | None = None

class LogModel(BaseModel):
    from_date: str
    to_date: str
    count: int
    user: str

# === Platform Detection ===
def detect_platform(url: str) -> str:
    url = url.lower()
    if "twitter.com" in url or "x.com" in url: return "Twitter"
    if "facebook.com" in url: return "Facebook"
    if "instagram.com" in url: return "Instagram"
    if "youtube.com" in url: return "YouTube"
    if "t.me" in url or "telegram.org" in url: return "Telegram"
    if "whatsapp.com" in url: return "WhatsApp"
    if "reddit.com" in url: return "Reddit"
    return "Other"


# === API Endpoints ===

@app.post("/add_link/")
async def add_link(link: LinkModel):
    now = datetime.now(IST)
    platform = detect_platform(link.url.strip())

    existing = links_col.find_one({"url": link.url.strip()})
    if existing:
        return JSONResponse(
            content={"message": "⚠️ This link already exists in the database.", "platform": platform},
            status_code=409
        )

    record = {
        "url": link.url.strip(),
        "platform": platform,
        "comments": link.comments,
        "rule_violation": "3(1)(b) (ii, v)",
        "action_status": "Not Taken Down",
        # ✅ store as datetime object (not string)
        "timestamp": now
    }

    links_col.insert_one(record)
    return {"message": "✅ Link added successfully", "platform": platform}



@app.get("/get_links/")
async def get_links(from_date: str, to_date: str):
    try:
        # ✅ Parse ISO strings from frontend
        from_dt = parser.isoparse(from_date)
        to_dt = parser.isoparse(to_date)

        data = list(links_col.find(
            {"timestamp": {"$gte": from_dt, "$lte": to_dt}},
            {"_id": 0}
        ))
        return {"data": data}
    except Exception as e:
        return {"error": str(e)}


@app.post("/log_download/")
async def log_download(log: LogModel):
    now = datetime.now(IST).isoformat()
    logs_col.insert_one({**log.dict(), "timestamp": now})
    return {"message": "Download log saved."}


@app.get("/get_logs/")
async def get_logs():
    logs = list(logs_col.find({}, {"_id": 0}).sort("timestamp", -1))
    return {"logs": logs}


# === EXPORT SECTION ===
@app.get("/export/")
async def export(from_date: str, to_date: str, file_type: str = "pdf"):
    try:
        from_dt = parser.isoparse(from_date)
        to_dt = parser.isoparse(to_date)

        data = list(links_col.find(
            {"timestamp": {"$gte": from_dt, "$lte": to_dt}},
            {"_id": 0}
        ))
    except Exception as e:
        return JSONResponse(content={"error": f"Invalid date: {str(e)}"}, status_code=400)
    
    if not data:
        return JSONResponse(content={"error": "No records found."}, status_code=404)
    
    # (keep your existing PDF/DOCX export logic here)


    df = pd.DataFrame(data)
    grouped = df.groupby("platform")

    # === PDF Export ===
    if file_type == "pdf":
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=40, leftMargin=40,
            topMargin=60, bottomMargin=40
        )
        elements = []
        styles = getSampleStyleSheet()

        # --- Styles ---
        title_style = ParagraphStyle(
            name="title_style",
            alignment=TA_CENTER,
            fontSize=16,
            textColor=colors.HexColor("#002147"),
            leading=20,
        )
        subtitle_style = ParagraphStyle(
            name="subtitle_style",
            alignment=TA_CENTER,
            fontSize=10,
            leading=14,
            textColor=colors.black,
        )
        platform_style = ParagraphStyle(
            name="platform_style",
            fontSize=12,
            textColor=colors.HexColor("#002147"),
            alignment=TA_LEFT,
            leftIndent=8,
            spaceBefore=4,
            spaceAfter=4,
        )
        url_style = ParagraphStyle(
            name="url_style",
            alignment=TA_LEFT,
            textColor=colors.HexColor("#0000EE"),
            underline=True,
            fontSize=9,
        )

        # --- Header ---
        elements.append(Paragraph("<b>Deepfake or Manipulated Content Report</b>", title_style))
        elements.append(Paragraph("<b>Related to Hon’ble PM Modi – Actionable Report</b>", title_style))
        # elements.append(Paragraph(f"({datetime.now(IST).strftime('%d %B, %Y, %I:%M %p')})", subtitle_style))
        elements.append(Paragraph(f"({datetime.now(IST).strftime('%d %B, %Y')})", subtitle_style))
        elements.append(Spacer(1, 15))

        # --- Platform Sections ---
        for platform, group in grouped:
            elements.append(Paragraph(f"<b>{platform}</b>", platform_style))
            elements.append(Spacer(1, 6))

            # ✅ Bold + Two-line header
            header_style = ParagraphStyle(
                name="header_style",
                parent=styles["Normal"],
                alignment=TA_CENTER,
                fontName="Helvetica-Bold",
                fontSize=9,
                textColor=colors.black,
                leading=12,
            )

            header_text = "<b>Relevant Violation<br/>of IT Rules, 2021</b>"
            table_data = [
                ["S.No", "URL", Paragraph(header_text, header_style), "Action Status", "Comments"]
            ]

            for i, row in enumerate(group.itertuples(), 1):
                url_para = Paragraph(
                    f"<link href='{row.url}' color='blue'><u>{row.url}</u></link>", url_style
                )
                table_data.append([
                    str(i),
                    url_para,
                    row.rule_violation,
                    row.action_status,
                    row.comments or ""
                ])

            # ✅ Adjusted column widths to fix overlap
            t = Table(table_data, colWidths=[35, 180, 115, 90, 80])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#dce6f1")),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('GRID', (0, 0), (-1, -1), 0.4, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7f9fb")]),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(t)
            elements.append(Spacer(1, 12))

        doc.build(elements)
        buffer.seek(0)
        return JSONResponse(
            content={"file": buffer.getvalue().decode("latin1")},
            headers={"Content-Disposition": f"attachment; filename=violations_{from_date}_{to_date}.pdf"},
        )

    # === DOCX Export ===
    elif file_type == "docx":
        doc = Document()
        title = doc.add_heading("Deepfake or Manipulated Content Report", level=1)
        title.alignment = 1
        subtitle = doc.add_heading("Related to Hon’ble PM Modi – Actionable Report", level=1)
        subtitle.alignment = 1
        # doc.add_paragraph(f"({datetime.now(IST).strftime('%d %B, %Y, %I:%M %p')})").alignment = 1
        doc.add_paragraph(f"({datetime.now(IST).strftime('%d %B, %Y')})").alignment = 1
        doc.add_paragraph()

        for platform, group in grouped:
            p = doc.add_paragraph()
            run = p.add_run(platform)
            run.bold = True
            run.font.size = Pt(13)
            run.font.color.rgb = RGBColor(0, 33, 71)
            p.paragraph_format.space_after = Pt(6)

            table = doc.add_table(rows=1, cols=5)
            table.style = 'Table Grid'
            hdr_cells = table.rows[0].cells
            hdr_cells[0].text = "S.No"
            hdr_cells[1].text = "URL"
            hdr_cells[2].text = "Relevant Violation\nof IT Rules, 2021"
            hdr_cells[3].text = "Action Status"
            hdr_cells[4].text = "Comments"

            # ✅ Bold header text for DOCX
            for cell in hdr_cells:
                for paragraph in cell.paragraphs:
                    for run in paragraph.runs:
                        run.bold = True

            for i, row in enumerate(group.itertuples(), 1):
                row_cells = table.add_row().cells
                row_cells[0].text = str(i)
                row_cells[1].text = row.url
                row_cells[2].text = row.rule_violation
                row_cells[3].text = row.action_status
                row_cells[4].text = row.comments or ""
                for paragraph in row_cells[1].paragraphs:
                    for run in paragraph.runs:
                        run.font.color.rgb = RGBColor(0, 0, 255)
                        run.font.underline = True

        buf = BytesIO()
        doc.save(buf)
        buf.seek(0)
        return JSONResponse(
            content={"file": buf.getvalue().decode("latin1")},
            headers={"Content-Disposition": f"attachment; filename=violations_{from_date}_{to_date}.docx"},
        )


@app.get("/")
async def home():
    return {"message": "✅ IT Rules Logger API is running"}
