from flask import Flask, request, jsonify
from datetime import datetime
import re
import math

app = Flask(__name__)

# =========================================================
# HELPERS: TYPE DETECTORS
# =========================================================

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
    words = re.findall(r"\b\w+\b", q.lower())
    keywords = [
        "pr", "estimate", "estimates", "record", "records",
        "cl", "daily", "progress", "pending", "completed", "amount"
    ]
    return any(k in words for k in keywords)


# =========================================================
# MATH NORMALIZER
# =========================================================

def normalize_math_expression(q):
    q = q.lower()
    q = q.replace("percent", "%")

    # 15% of 1000 => (15/100)*1000
    q = re.sub(r'(\d+)\s*%\s*of\s*(\d+)', r'(\1/100)*\2', q)

    q = q.replace("sqrt", "math.sqrt")
    q = q.replace("sin", "math.sin")
    q = q.replace("cos", "math.cos")
    q = q.replace("tan", "math.tan")
    q = q.replace("log", "math.log")

    q = re.sub(r'[^0-9\.\+\-\*\/\(\)%]', ' ', q)
    return q.strip()

# =========================================================
# DATE HANDLER
# =========================================================

def handle_date_question(q):
    if "time" in q:
        return {"type": "TIME"}

    if "today" in q:
        return {"type": "DATE", "value": "today"}

    if "yesterday" in q:
        return {"type": "DATE", "value": "yesterday"}

    if "tomorrow" in q:
        return {"type": "DATE", "value": "tomorrow"}

    if "day" in q:
        return {"type": "DAY"}

    return {"type": "DATE", "value": "today"}

# =========================================================
# DATABASE / PR / FILTER INTENT ENGINE
# =========================================================

def detect_db_intent(text):
    t = text.lower().strip()
    filters = {}

    # GREETING
    if re.search(r"\b(hi|hello|hey|good morning|good evening)\b", t):
        return {"type": "GREETING"}

    # DIVISION MAP
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

    # STATUS
    if "pending" in t:
        filters["status"] = "Pending"

    if "completed" in t or "closed" in t:
        filters["status"] = "Completed"

    # AMOUNT FILTER
    amt_match = re.search(r"(above|over|greater than)\s+(\d+)", t)
    if amt_match:
        filters["amount_op"] = ">"
        filters["amount"] = int(amt_match.group(2)) * 100000

    amt_match2 = re.search(r"(below|less than)\s+(\d+)", t)
    if amt_match2:
        filters["amount_op"] = "<"
        filters["amount"] = int(amt_match2.group(2)) * 100000

    # DATE FILTER
    if "today" in t:
        filters["date"] = "today"
    if "yesterday" in t:
        filters["date"] = "yesterday"
    if "last week" in t:
        filters["date"] = "last_week"
    if "last month" in t:
        filters["date"] = "last_month"

    # SUMMARY
    if "how many" in t or "count" in t:
        return {"type": "SUMMARY", "target": "count", "filters": filters}

    if "total amount" in t or "sum" in t:
        return {"type": "SUMMARY", "target": "sum", "filters": filters}

    # PR NUMBER
    pr_match = re.search(r"\b10\d{8}\b", t)
    if pr_match:
        prNo = pr_match.group(0)

        if "date" in t:
            return {"type": "PR_COLUMN", "column": "pr_date", "prNo": prNo}
        if "status" in t:
            return {"type": "PR_COLUMN", "column": "status", "prNo": prNo}
        if "amount" in t:
            return {"type": "PR_COLUMN", "column": "amount", "prNo": prNo}

        return {"type": "PR_FULL", "prNo": prNo}

    # ESTIMATE
    est_match = re.search(r"\b(13|21)\d{8}\b", t)
    if est_match:
        return {"type": "ESTIMATE_FULL", "estimateNo": est_match.group(0)}

    # CL
    aad_match = re.search(r"\b\d{12}\b", t)
    if aad_match:
        return {"type": "CL_FULL", "aadhar": aad_match.group(0)}

    if "cl" in t:
        return {"type": "CL_LIST", "filters": filters}

    # DAILY
    if "daily" in t:
        return {"type": "DAILY_LIST", "filters": filters}

    return {"type": "PR_LIST", "filters": filters}

# =========================================================
# MAIN ANALYZE ROUTE (ONLY ONE)
# =========================================================

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.json or {}
    question = (data.get("text") or "").strip().lower()

    if not question:
        return jsonify({"type": "GENERAL", "prompt": "Hello"})

    # MATH
    if is_math_question(question):
        return jsonify({
            "type": "MATH",
            "expression": normalize_math_expression(question)
        })

    # DATE / TIME
    if is_date_question(question):
        return jsonify(handle_date_question(question))

  # WEB
    if is_web_question(question):
        return jsonify({
            "type": "WEB",
            "query": question
        })
    
    # DATABASE / PR / FILTER
    if is_db_question(question):
        return jsonify(detect_db_intent(question))

  

    # GENERAL
    return jsonify({
        "type": "GENERAL",
        "prompt": question
    })

# =========================================================
# HEALTH CHECK
# =========================================================

@app.route("/")
def home():
    return "NTTPS AI Brain is running"

# =========================================================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
