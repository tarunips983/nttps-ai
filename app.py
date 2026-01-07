from flask import Flask, request, jsonify
import re

app = Flask(__name__)

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
