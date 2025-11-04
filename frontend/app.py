import streamlit as st
import requests
import pandas as pd
from datetime import datetime, time
import pytz
import os

# --- Backend API ---
API_URL = "http://10.226.49.29:8080"

# --- Timezone ---
IST = pytz.timezone("Asia/Kolkata")

# --- Page Config ---
st.set_page_config(page_title="IT Rules Logger", layout="wide")

# --- Sidebar Navigation ---
st.sidebar.title("📋 Navigation")

if "page" not in st.session_state:
    st.session_state.page = "add_links"

if st.sidebar.button("➕ Add / Download Links"):
    st.session_state.page = "add_links"
if st.sidebar.button("📜 Download Logs"):
    st.session_state.page = "logs"

page = st.session_state.page

# ===============================================================
# 🧾 PAGE 1: ADD & DOWNLOAD LINKS
# ===============================================================
if page == "add_links":
    st.markdown(
        "<h1 style='color:#FFFFFF;'>🧾 Social Media Link Logger (IT Rules, 2021)</h1>",
        unsafe_allow_html=True,
    )

    st.markdown("### ➕ Add New Link")

    # --- Initialize state for message/clearing ---
    if "show_success" not in st.session_state:
        st.session_state.show_success = None
    if "clear_next" not in st.session_state:
        st.session_state.clear_next = False

    # --- Clear inputs if flagged ---
    if st.session_state.clear_next:
        st.session_state.url_input = ""
        st.session_state.comments_input = ""
        st.session_state.clear_next = False

    # --- Input Fields ---
    url = st.text_input("Enter Social Media Link:", key="url_input")
    comments = st.text_area("Comments (optional):", key="comments_input")

    # --- Show success message if available ---
    if st.session_state.show_success:
        st.success(st.session_state.show_success)
        st.session_state.show_success = None

    # ===============================================================
    # ✅ Add Link button logic
    # ===============================================================
    if st.button("Add Link", use_container_width=True):
        if url.strip():
            try:
                resp = requests.post(
                    f"{API_URL}/add_link/",
                    json={"url": url.strip(), "comments": comments.strip()},
                    timeout=10,
                )
                try:
                    r = resp.json()
                except Exception:
                    r = {"message": "Response parsing failed", "platform": "Unknown"}

                if resp.status_code == 200:
                    # ✅ Save message & flag clear for next render
                    st.session_state.show_success = f"✅ {r.get('message','Saved')} (Platform: {r.get('platform','-')})"
                    st.session_state.clear_next = True
                    st.rerun()

                elif resp.status_code == 409:
                    st.warning(f"⚠️ {r.get('message','Already exists')} (Platform: {r.get('platform','-')})")
                else:
                    st.error(f"❌ Failed to save link. Status: {resp.status_code}")
            except requests.exceptions.RequestException as e:
                st.error(f"🚨 Network error: {str(e)}")
            except Exception as e:
                st.error(f"🚨 Error: {str(e)}")
        else:
            st.warning("Please enter a valid URL.")

    st.divider()

    # ===============================================================
    # 📅 Download Data by Date & Time Range
    # ===============================================================
    st.markdown("### 📅 Download Data by Date & Time Range")

    col1, col2 = st.columns(2)
    now = datetime.now(IST)
    with col1:
        from_date = st.date_input("From Date", now.date())
        from_time = st.time_input("From Time", time(0, 0))
    with col2:
        to_date = st.date_input("To Date", now.date())
        to_time = st.time_input("To Time", now.time())

    from_dt = IST.localize(datetime.combine(from_date, from_time))
    to_dt = IST.localize(datetime.combine(to_date, to_time))

    file_type = st.selectbox("Select Export Format", ["pdf", "docx"])

    if st.button("📥 Fetch & Download", use_container_width=True):
        try:
            resp = requests.get(
                f"{API_URL}/get_links/",
                params={"from_date": from_dt.isoformat(), "to_date": to_dt.isoformat()},
                timeout=10,
            )
            data = resp.json().get("data", [])

            if not data:
                st.warning("⚠️ No records found for the selected range.")
            else:
                df = pd.DataFrame(data)

                st.markdown("### 📊 Retrieved Records")
                st.dataframe(
                    df.style.set_properties(
                        **{
                            "color": "black",
                            "border-color": "#ccc",
                            "background-color": "#f8f9fa",
                            "font-size": "14px",
                        }
                    )
                )

                download_resp = requests.get(
                    f"{API_URL}/export/",
                    params={
                        "from_date": from_dt.isoformat(),
                        "to_date": to_dt.isoformat(),
                        "file_type": file_type,
                    },
                    timeout=20,
                )

                if download_resp.status_code == 200:
                    file_bytes = download_resp.json()["file"].encode("latin1")
                    st.download_button(
                        f"⬇️ Download {file_type.upper()} Report",
                        data=file_bytes,
                        file_name=f"violations_{from_date}_{to_date}.{file_type}",
                        mime="application/octet-stream",
                        use_container_width=True,
                    )

                    # Log the download
                    requests.post(
                        f"{API_URL}/log_download/",
                        json={
                            "from_date": from_dt.isoformat(),
                            "to_date": to_dt.isoformat(),
                            "count": len(df),
                            "user": "Streamlit_User",
                        },
                    )
                else:
                    st.error("❌ Failed to generate file. Please try again.")
        except Exception as e:
            st.error(f"🚨 Error: {str(e)}")


# ===============================================================
# 📜 PAGE 2: DOWNLOAD LOGS
# ===============================================================
elif page == "logs":
    st.markdown(
        "<h1 style='color:#FFFFFF;'>📜 Download Logs History</h1>",
        unsafe_allow_html=True,
    )

    try:
        resp = requests.get(f"{API_URL}/get_logs/", timeout=10)
        logs = resp.json().get("logs", [])
    except Exception as e:
        logs = []
        st.error(f"🚨 Failed to fetch logs: {str(e)}")

    if not logs:
        st.info("No logs found yet.")
    else:
        for i, log in enumerate(logs, 1):
            with st.container(border=True):
                st.markdown(
                    f"<h3 style='color:#FFFFFF;'>🧾 Log #{i}</h3>",
                    unsafe_allow_html=True,
                )
                st.write(f"🗓 **From:** {log['from_date']}")
                st.write(f"🕒 **To:** {log['to_date']}")
                st.write(f"📊 **Records:** {log['count']}")
                st.write(f"👤 **User:** {log['user']}")
                st.write(f"🕰 **Timestamp:** {log['timestamp']}")

                col1, col2 = st.columns(2)

                # --- PDF Download
                with col1:
                    try:
                        export_pdf = requests.get(
                            f"{API_URL}/export/",
                            params={
                                "from_date": log["from_date"],
                                "to_date": log["to_date"],
                                "file_type": "pdf",
                            },
                            timeout=20,
                        )
                        if export_pdf.status_code == 200:
                            pdf_bytes = export_pdf.json()["file"].encode("latin1")
                            st.download_button(
                                label=f"📄 Download PDF (Log #{i})",
                                data=pdf_bytes,
                                file_name=f"log_{i}.pdf",
                                mime="application/pdf",
                                use_container_width=True,
                            )
                        else:
                            st.error("❌ Failed to load PDF.")
                    except Exception as e:
                        st.error(f"🚨 {str(e)}")

                # --- DOCX Download
                with col2:
                    try:
                        export_docx = requests.get(
                            f"{API_URL}/export/",
                            params={
                                "from_date": log["from_date"],
                                "to_date": log["to_date"],
                                "file_type": "docx",
                            },
                            timeout=20,
                        )
                        if export_docx.status_code == 200:
                            docx_bytes = export_docx.json()["file"].encode("latin1")
                            st.download_button(
                                label=f"📝 Download DOCX (Log #{i})",
                                data=docx_bytes,
                                file_name=f"log_{i}.docx",
                                mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                use_container_width=True,
                            )
                        else:
                            st.error("❌ Failed to load DOCX.")
                    except Exception as e:
                        st.error(f"🚨 {str(e)}")
