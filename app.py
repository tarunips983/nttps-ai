from flask import Flask, request, jsonify
from datetime import datetime, timedelta
import re
import math

app = Flask(__name__)

# =========================
# MAIN INTENT DETECTOR
# =========================

def detect_intent(text):
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

    # COUNT / SUM
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

    # WEB QUESTIONS
    if any(k in t for k in ["who is", "capital", "minister", "pm", "cm", "price", "weather"]):
        return {"type": "WEB", "query": t}

    # MATH
    if re.search(r"[\d\+\-\*\/\%]", t):
        return {"type": "MATH", "expression": t}

    # DEFAULT
    return {"type": "GENERAL", "prompt": t}


# =========================
# ROUTES
# =========================



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

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.json or {}
    text = data.get("text", "")
    intent = detect_intent(text)
    return jsonify(intent)


# =========================================================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
