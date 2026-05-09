"""FastAPI dashboard backend — serves pre-computed pipeline outputs."""
from __future__ import annotations

import json
import os
import pathlib
from typing import List

from dotenv import load_dotenv
import openai

load_dotenv(pathlib.Path(__file__).parent.parent / ".env")
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

BASE     = pathlib.Path(__file__).parent.parent
RESULTS  = BASE / "outputs" / "results"
MODELS   = BASE / "outputs" / "models"
PLOTS    = BASE / "outputs" / "plots"

app = FastAPI(title="Churn Dashboard API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if PLOTS.exists():
    app.mount("/plots", StaticFiles(directory=str(PLOTS)), name="plots")


# ── helpers ────────────────────────────────────────────────────────────────────

def _json(filename: str) -> dict:
    path = RESULTS / filename
    if not path.exists():
        raise HTTPException(404, f"{filename} not found — re-run main.py first.")
    with open(path) as f:
        return json.load(f)


def _csv(filename: str) -> pd.DataFrame:
    path = RESULTS / filename
    if not path.exists():
        raise HTTPException(404, f"{filename} not found — re-run main.py first.")
    return pd.read_csv(path)


def _safe(df: pd.DataFrame) -> list:
    return df.replace({float("nan"): None, float("inf"): None, float("-inf"): None}).to_dict(orient="records")


# ── endpoints ──────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/summary")
def get_summary():
    return _json("summary_stats.json")


@app.get("/api/model-metrics")
def get_model_metrics():
    df = _csv("model_results.csv")
    df = df.rename(columns={df.columns[0]: "model"})
    return _safe(df)


@app.get("/api/feature-importance")
def get_feature_importance():
    return _json("feature_importance.json")


@app.get("/api/confusion-matrix")
def get_confusion_matrix():
    return _json("confusion_matrices.json")


@app.get("/api/customers")
def get_customers(
    page:     int = Query(1, ge=1),
    limit:    int = Query(20, ge=1, le=200),
    tier:     str = Query(None),
    search:   str = Query(None),
    sort_by:  str = Query("churn_probability"),
    sort_dir: str = Query("desc"),
):
    df = _csv("retention_recommendations.csv")
    if tier:
        df = df[df["value_tier"] == tier]
    if search:
        df = df[df["customer_id"].astype(str).str.contains(search, na=False)]
    if sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=(sort_dir == "asc"))

    total   = len(df)
    start   = (page - 1) * limit
    page_df = df.iloc[start : start + limit]
    return {"total": total, "page": page, "limit": limit, "data": _safe(page_df)}


@app.get("/api/all-probs")
def get_all_probs():
    df = _csv("all_churn_probs.csv")
    return _safe(df)


@app.get("/api/charts/monthly")
def get_monthly():
    df = _csv("monthly_revenue.csv")
    return _safe(df)


@app.get("/api/charts/countries")
def get_countries(top: int = Query(15, ge=1, le=50)):
    df = _csv("churn_by_country.csv")
    return _safe(df.head(top))


@app.get("/api/charts/tiers")
def get_tiers():
    df = _csv("all_churn_probs.csv")
    high_thr = float(df["monetary"].quantile(0.75))
    mid_thr  = float(df["monetary"].quantile(0.40))

    def _tier(m):
        if m >= high_thr: return "High"
        if m >= mid_thr:  return "Medium"
        return "Low"

    df["value_tier"]   = df["monetary"].apply(_tier)
    df["is_churner"]   = (df["churn_probability"] >= 0.5).astype(int)
    df["risk_revenue"] = df["monetary"] * df["is_churner"]

    result = (
        df.groupby("value_tier")
        .agg(
            customer_count  = ("customer_id",       "count"),
            churner_count   = ("is_churner",         "sum"),
            avg_churn_prob  = ("churn_probability",  "mean"),
            total_revenue   = ("monetary",            "sum"),
            revenue_at_risk = ("risk_revenue",        "sum"),
        )
        .reset_index()
    )
    result["churn_rate"] = (result["churner_count"] / result["customer_count"]).round(4)
    tier_order = {"High": 0, "Medium": 1, "Low": 2}
    result["_order"] = result["value_tier"].map(tier_order)
    result = result.sort_values("_order").drop(columns="_order")
    return _safe(result)


# ── Profiling report ──────────────────────────────────────────────────────────

@app.get("/api/profiling", response_class=HTMLResponse)
def get_profiling_report():
    path = RESULTS / "profiling_report.html"
    if not path.exists():
        raise HTTPException(
            404,
            "profiling_report.html not found — re-run: python main.py"
        )
    return FileResponse(str(path), media_type="text/html")


# ── EDA endpoints ──────────────────────────────────────────────────────────────

@app.get("/api/eda/rfm-summary")
def eda_rfm_summary():
    """Mean and median of recency / frequency / monetary split by churn status."""
    df = _csv("all_churn_probs.csv")
    df["churn_actual"] = df["churn_actual"].fillna(0).astype(int)
    result = {}
    for col in ("recency", "frequency", "monetary"):
        grp = (
            df.groupby("churn_actual")[col]
            .agg(mean="mean", median="median")
            .reset_index()
        )
        grp["label"] = grp["churn_actual"].map({0: "Active", 1: "Churned"})
        result[col] = _safe(grp[["label", "mean", "median"]])
    return result


@app.get("/api/eda/churn-by-recency")
def eda_churn_by_recency():
    """Churn rate broken down by recency bucket (days since last purchase)."""
    df = _csv("all_churn_probs.csv")
    df["churn_actual"] = df["churn_actual"].fillna(0).astype(int)
    bins   = [0, 30, 60, 90, 180, 365, 99999]
    labels = ["0–30d", "31–60d", "61–90d", "91–180d", "181–365d", "365d+"]
    df["bucket"] = pd.cut(df["recency"], bins=bins, labels=labels, right=True)
    grp = (
        df.groupby("bucket", observed=True)
        .agg(total=("customer_id", "count"), churners=("churn_actual", "sum"))
        .reset_index()
    )
    grp["churn_rate"] = (grp["churners"] / grp["total"]).round(4)
    grp["bucket"]     = grp["bucket"].astype(str)
    return _safe(grp)


# ── Chatbot ────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]


def _build_system_prompt() -> str:
    """Build a system prompt from available pipeline artifacts."""
    parts = ["You are an expert data science assistant for a Customer Churn Prediction project on the UCI Online Retail II dataset."]

    try:
        summary = _json("summary_stats.json")
        parts.append(f"""
## Dataset Summary
- Total customers: {summary.get('total_customers')}
- Unique countries: {summary.get('unique_countries')}
- Total revenue: £{summary.get('total_revenue', 0):,.0f}
- Churn rate: {summary.get('churn_rate', 0) * 100:.1f}%
- Date range: {summary.get('date_range_start')} to {summary.get('date_range_end')}
""")
    except Exception:
        pass

    try:
        fi = _json("feature_importance.json")
        lgbm_top = sorted(fi.get("lgbm", {}).items(), key=lambda x: -x[1])[:10]
        xgb_top  = sorted(fi.get("xgboost", {}).items(), key=lambda x: -x[1])[:10]
        parts.append(f"""
## Top Features (LightGBM): {', '.join(f'{k}({v:.4f})' for k,v in lgbm_top)}
## Top Features (XGBoost):  {', '.join(f'{k}({v:.4f})' for k,v in xgb_top)}
""")
    except Exception:
        pass

    try:
        df_metrics = _csv("model_results.csv")
        df_metrics = df_metrics.rename(columns={df_metrics.columns[0]: "model"})
        parts.append("\n## Model Performance\n" + df_metrics.to_string(index=False))
    except Exception:
        pass

    try:
        df_recs = _csv("retention_recommendations.csv")
        tier_stats = (
            df_recs.groupby("value_tier")
            .agg(
                customers       = ("customer_id",       "count"),
                avg_churn_prob  = ("churn_probability",  "mean"),
                high_risk_count = ("churn_probability",  lambda x: (x >= 0.7).sum()),
            )
            .reset_index()
        )
        parts.append(f"""
## Retention Recommendations List
- Total customers with recommendations: {len(df_recs)}
- Columns available for export: customer_id, churn_probability, value_tier, top_purchased, recommended_products, promotion
{tier_stats.to_string(index=False)}
""")
    except Exception:
        pass

    parts.append("""
## Pipeline Overview
- Feature engineering: RFM (Recency, Frequency, Monetary), order patterns, cancellation rates, country, day-of-week behaviour
- Feature selection: VIF-based collinearity removal
- Models trained: LightGBM, XGBoost, Artificial Neural Network (ANN/Keras), LSTM
- Evaluation metrics: Accuracy, Precision, Recall, F1, AUC-ROC
- Business segments: High / Medium / Low value tiers based on monetary quartiles
- Association rules: Apriori algorithm on product co-purchases

## Export Capability
You can export a filtered customer whitelist for churn campaigns by calling the export_churn_whitelist function.
Use it whenever the user asks for a list, export, download, whitelist, or campaign target of customers.

Answer concisely and accurately. If asked about something not in the data, say so clearly.
""")

    return "\n".join(parts)


EXPORT_TOOL = {
    "type": "function",
    "function": {
        "name": "export_churn_whitelist",
        "description": (
            "Filter the retention recommendations list and export matching customers "
            "as a churn campaign whitelist. Call this whenever the user asks to export, "
            "download, or get a list of at-risk customers."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "tier": {
                    "type": "string",
                    "enum": ["High", "Medium", "Low", "All"],
                    "description": "Customer value tier to target. Use 'All' for no tier filter.",
                },
                "min_churn_probability": {
                    "type": "number",
                    "description": "Minimum churn probability threshold (0.0–1.0). Default 0.5.",
                },
                "max_customers": {
                    "type": "integer",
                    "description": "Maximum number of customers to include. Default 200.",
                },
            },
            "required": [],
        },
    },
}


def _run_export(tier: str, min_churn_probability: float, max_customers: int) -> list:
    df = _csv("retention_recommendations.csv")
    if tier and tier != "All":
        df = df[df["value_tier"] == tier]
    df = df[df["churn_probability"] >= min_churn_probability]
    df = df.sort_values("churn_probability", ascending=False).head(max_customers)
    return _safe(df)


_OPENAI_CLIENT: openai.OpenAI | None = None

def _get_client() -> openai.OpenAI:
    global _OPENAI_CLIENT
    if _OPENAI_CLIENT is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(500, "OPENAI_API_KEY environment variable not set.")
        _OPENAI_CLIENT = openai.OpenAI(api_key=api_key)
    return _OPENAI_CLIENT


@app.post("/api/chat")
def chat(req: ChatRequest):
    client   = _get_client()
    system_prompt = _build_system_prompt()

    messages = [{"role": "system", "content": system_prompt}]
    messages += [{"role": m.role, "content": m.content} for m in req.messages]

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=1024,
        messages=messages,
        tools=[EXPORT_TOOL],
        tool_choice="auto",
    )

    choice      = response.choices[0]
    export_data = None

    if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
        tool_call = choice.message.tool_calls[0]
        args      = json.loads(tool_call.function.arguments)

        export_data = _run_export(
            tier                  = args.get("tier", "All"),
            min_churn_probability = args.get("min_churn_probability", 0.5),
            max_customers         = args.get("max_customers", 200),
        )

        # Feed tool result back so the model can write a natural reply
        messages.append({
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id":       tool_call.id,
                    "type":     "function",
                    "function": {
                        "name":      tool_call.function.name,
                        "arguments": tool_call.function.arguments,
                    },
                }
            ],
        })
        messages.append({
            "role":         "tool",
            "tool_call_id": tool_call.id,
            "content":      json.dumps({
                "customer_count": len(export_data),
                "tier_filter":    args.get("tier", "All"),
                "min_prob":       args.get("min_churn_probability", 0.5),
            }),
        })

        followup = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=512,
            messages=messages,
        )
        reply = followup.choices[0].message.content
    else:
        reply = choice.message.content

    return {"response": reply, "export": export_data}
