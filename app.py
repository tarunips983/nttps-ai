from flask import Flask, request, jsonify
from datetime import datetime, timedelta
import re
import math

app = Flask(__name__)


def is_math_question(q):
    return bool(re.search(r'[\d\+\-\*\/\%\^\(\)]|sqrt|sin|cos|tan|log|percent|%', q))

def is_date_question(q):
    keywords = ["date", "day", "today", "yesterday", "tomorrow", "time", "now"]
    return any(k in q for k in keywords)

def is_web_question(q):
    keywords = [
        "who is", "current", "latest", "news", "price", "population",
        "capital", "minister", "pm", "cm", "weather", "temperature"
    ]
    return any(k in q for k in keywords)

def is_db_question(q):
    keywords = [
        "pr", "estimate", "estimates", "record", "records",
        "cl", "daily", "progress", "pending", "completed", "amount"
    ]
    return any(k in q for k in keywords)

# ----------------------------
# Math parser
# ----------------------------

def normalize_math_expression(q):
    q = q.lower()
    q = q.replace("percent", "%")

    # 15% of 1000 => 15/100 * 1000
    q = re.sub(r'(\d+)\s*%\s*of\s*(\d+)', r'(\1/100)*\2', q)

    # sqrt(625)
    q = q.replace("sqrt", "math.sqrt")
    q = q.replace("sin", "math.sin")
    q = q.replace("cos", "math.cos")
    q = q.replace("tan", "math.tan")
    q = q.replace("log", "math.log")

    # remove words
    q = re.sub(r'[^0-9\.\+\-\*\/\(\)%]', ' ', q)

    return q.strip()

# ----------------------------
# Date / Time logic
# ----------------------------

def handle_date_question(q):
    now = datetime.now()

    if "time" in q:
        return {
            "type": "TIME"
        }

    if "today" in q:
        return {
            "type": "DATE",
            "value": "today"
        }

    if "yesterday" in q:
        return {
            "type": "DATE",
            "value": "yesterday"
        }

    if "tomorrow" in q:
        return {
            "type": "DATE",
            "value": "tomorrow"
        }

    if "day" in q:
        return {
            "type": "DAY"
        }

    return {
        "type": "DATE",
        "value": "today"
    }

# ----------------------------
# Main Analyze Route
# ----------------------------

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.json
    question = (data.get("text") or "").strip().lower()

    if not question:
        return jsonify({
            "type": "GENERAL",
            "prompt": "Hello"
        })

    # 1️⃣ MATH
    if is_math_question(question):
        expr = normalize_math_expression(question)
        return jsonify({
            "type": "MATH",
            "expression": expr
        })

    # 2️⃣ DATE / TIME
    if is_date_question(question):
        return jsonify(handle_date_question(question))

    # 3️⃣ DATABASE
    if is_db_question(question):
        # Simple DB intent detection for now
        # Your Node already handles logic based on words like PR, ESTIMATE, etc.
        return jsonify({
            "type": "DB",
            "query": question
        })

    # 4️⃣ WEB
    if is_web_question(question):
        return jsonify({
            "type": "WEB",
            "query": question
        })

    # 5️⃣ GENERAL AI
    return jsonify({
        "type": "GENERAL",
        "prompt": question
    })

# ----------------------------
# Health Check
# ----------------------------

@app.route("/")
def home():
    return "NTTPS AI Brain is running"


def detect_intent(text):
    t = text.lower().strip()

    # GREETING
    if re.search(r"\b(hi|hello|hey|good morning|good evening)\b", t):
        return {"type": "GREETING"}

    # DIVISION
    div_match = re.search(r"\b(tm&cam|em|c&i|mm|stage[-\s]?v|sd[-\s]?iv)\b", t, re.I)
    division = div_match.group(0).upper() if div_match else None

    # DATE
    date_match = re.search(r"\b\d{2}[-/]\d{2}[-/]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b", t)
    date = date_match.group(0) if date_match else None

    # PR
    pr_match = re.search(r"\b10\d{8}\b", t)
    if pr_match:
        prNo = pr_match.group(0)

        if "date" in t:
            return {"type": "PR_COLUMN", "column": "pr_date", "prNo": prNo}
        if "status" in t:
            return {"type": "PR_COLUMN", "column": "status", "prNo": prNo}
        if "amount" in t or "value" in t:
            return {"type": "PR_COLUMN", "column": "amount", "prNo": prNo}

        return {"type": "PR_FULL", "prNo": prNo}

    # ESTIMATE
    est_match = re.search(r"\b(13|21)\d{8}\b", t)
    if est_match:
        return {"type": "ESTIMATE_FULL", "estimateNo": est_match.group(0)}

    # DAILY
    if "daily" in t:
        return {"type": "DAILY_LIST", "division": division, "date": date}

    # CL
    aad_match = re.search(r"\b\d{12}\b", t)
    if aad_match:
        return {"type": "CL_FULL", "aadhar": aad_match.group(0)}

    if "cl" in t:
        return {"type": "CL_LIST", "division": division}

    return {"type": "UNKNOWN"}

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.json
    text = data.get("text", "")
    intent = detect_intent(text)
    return jsonify(intent)

div_map = {
    "tm": "TM & CAM",
    "tm&cam": "TM & CAM",
    "bm": "BM & AHP",
    "ahp": "BM & AHP",
    "em": "EM",
    "c&i": "C&I"
}

for k, v in div_map.items():
    if k in t:
        filters["division"] = v

if "pending" in t:
    filters["status"] = "Pending"

if "completed" in t or "closed" in t:
    filters["status"] = "Completed"

import re

amt_match = re.search(r"(above|over|greater than)\s+(\d+)", t)
if amt_match:
    filters["amount_op"] = ">"
    filters["amount"] = int(amt_match.group(2)) * 100000  # lakh

amt_match2 = re.search(r"(below|less than)\s+(\d+)", t)
if amt_match2:
    filters["amount_op"] = "<"
    filters["amount"] = int(amt_match2.group(2)) * 100000
from datetime import datetime, timedelta

if "today" in t:
    filters["date"] = "today"

if "yesterday" in t:
    filters["date"] = "yesterday"

if "last week" in t:
    filters["date"] = "last_week"

if "last month" in t:
    filters["date"] = "last_month"
    
if "how many" in t or "count" in t:
    return { "type": "SUMMARY", "target": "count", "filters": filters }

if "total amount" in t or "sum" in t:
    return { "type": "SUMMARY", "target": "sum", "filters": filters }
return {
  "type": "PR_LIST",
  "filters": filters
}







app.run(host="0.0.0.0", port=5000)
