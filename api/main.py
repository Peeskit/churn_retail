"""FastAPI dashboard backend — serves pre-computed pipeline outputs."""
from __future__ import annotations

import json
import pathlib

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

BASE     = pathlib.Path(__file__).parent.parent
RESULTS  = BASE / "outputs" / "results"
MODELS   = BASE / "outputs" / "models"

app = FastAPI(title="Churn Dashboard API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
