"""
Churn Prediction Pipeline — Online Retail Dataset
==================================================
Columns : Invoice, StockCode, Description, Quantity,
          InvoiceDate, Price, Customer ID, Country
Sheets  : Sheet-1 (2009-2010)  +  Sheet-2 (2010-2011)

Run
---
    python main.py
    python main.py --file data/online_retail.xlsx
"""
import argparse
import json
import os
import sys
import warnings
warnings.filterwarnings("ignore")

# Make src/ importable when running from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
sys.path.insert(0, os.path.dirname(__file__))

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from src.data_loader      import DataLoader
from src.data_cleaner     import DataCleaner
from src.feature_engineer import FeatureEngineer
from src.feature_selector import FeatureSelector
from src.model_trainer    import ModelTrainer
from src.recommender      import Recommender
from src.visualizer       import (
    plot_eda, plot_churn_analysis, plot_feature_importance,
    plot_model_comparison, plot_roc_curves,
    plot_recommendation_summary, save_summary,
)
from config import (
    TEST_SIZE, RANDOM_STATE, RESULTS_DIR, OUTPUT_DIR,
    PLOTS_DIR, MODELS_DIR,
)


def make_dirs():
    for d in (OUTPUT_DIR, PLOTS_DIR, MODELS_DIR, RESULTS_DIR):
        os.makedirs(d, exist_ok=True)


def save_api_artifacts(trainer, selector, feat_df, churn_probs, clean_df):
    """Persist all artefacts needed by the FastAPI dashboard server."""
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(RESULTS_DIR, exist_ok=True)

    # 1. StandardScaler
    joblib.dump(trainer.scaler, os.path.join(MODELS_DIR, "scaler.pkl"))

    # 2. LSTM normalisation params (only if LSTM was trained)
    if hasattr(trainer, "_lstm_norm"):
        mu, sig = trainer._lstm_norm
        joblib.dump({"mu": mu, "sig": sig}, os.path.join(MODELS_DIR, "lstm_norm.pkl"))

    # 3. Selected feature names
    with open(os.path.join(RESULTS_DIR, "selected_features.json"), "w") as f:
        json.dump(selector.selected_features, f)

    # 4. Feature importance (LGBM + XGBoost), normalised to sum = 1
    fi = {}
    for name in ("LGBM", "XGBoost"):
        if name not in trainer.models_:
            continue
        raw = trainer.models_[name].feature_importances_.astype(float)
        total = raw.sum() or 1.0
        fi[name.lower()] = sorted(
            [{"feature": f, "importance": round(float(v / total), 6)}
             for f, v in zip(selector.selected_features, raw)],
            key=lambda x: x["importance"], reverse=True,
        )
    with open(os.path.join(RESULTS_DIR, "feature_importance.json"), "w") as f:
        json.dump(fi, f, indent=2)

    # 5. All customer churn probabilities + key features + country
    customer_country = (
        clean_df.groupby("customer_id")["country"]
        .agg(lambda x: x.mode().iloc[0])
    )
    all_probs_df = pd.DataFrame({
        "customer_id":       churn_probs.index.astype(str),
        "churn_probability": churn_probs.values.round(4),
        "monetary":          feat_df.loc[churn_probs.index, "monetary"].values.round(2),
        "recency":           feat_df.loc[churn_probs.index, "recency"].values,
        "frequency":         feat_df.loc[churn_probs.index, "frequency"].values,
        "churn_actual":      feat_df.loc[churn_probs.index, "churn"].values,
    })
    all_probs_df["country"] = all_probs_df["customer_id"].map(customer_country)
    all_probs_df.to_csv(os.path.join(RESULTS_DIR, "all_churn_probs.csv"), index=False)

    # 6. Monthly revenue time-series
    monthly = (
        clean_df.set_index("invoice_date")
        .resample("ME")
        .agg(revenue=("revenue", "sum"), txn_count=("invoice_id", "nunique"))
        .reset_index()
    )
    monthly["month"] = monthly["invoice_date"].dt.strftime("%Y-%m")
    monthly[["month", "revenue", "txn_count"]].to_csv(
        os.path.join(RESULTS_DIR, "monthly_revenue.csv"), index=False
    )

    # 7. Churn statistics by country
    all_probs_df["is_churner"]    = (all_probs_df["churn_probability"] >= 0.5).astype(int)
    all_probs_df["risk_revenue"]  = all_probs_df["monetary"] * all_probs_df["is_churner"]
    country_agg = (
        all_probs_df.dropna(subset=["country"])
        .groupby("country")
        .agg(
            customer_count=("customer_id", "count"),
            churner_count=("is_churner", "sum"),
            revenue_at_risk=("risk_revenue", "sum"),
        )
        .reset_index()
    )
    country_agg["churn_rate"] = (
        country_agg["churner_count"] / country_agg["customer_count"]
    ).round(4)
    country_agg.sort_values("churner_count", ascending=False).to_csv(
        os.path.join(RESULTS_DIR, "churn_by_country.csv"), index=False
    )

    # 8. Summary KPIs
    churner_mask    = churn_probs >= 0.5
    revenue_at_risk = float(feat_df.loc[churn_probs[churner_mask].index, "monetary"].sum())
    best_m          = trainer.results_[trainer.best_name_]
    summary = {
        "total_customers":  int(len(churn_probs)),
        "churner_count":    int(churner_mask.sum()),
        "churn_rate":       round(float(churner_mask.mean()), 4),
        "revenue_at_risk":  round(revenue_at_risk, 2),
        "total_revenue":    round(float(feat_df["monetary"].sum()), 2),
        "best_model":       trainer.best_name_,
        "best_auc":         float(best_m["AUC"]),
        "best_f1":          float(best_m["F1"]),
        "unique_countries": int(clean_df["country"].nunique()),
    }
    with open(os.path.join(RESULTS_DIR, "summary_stats.json"), "w") as f:
        json.dump(summary, f, indent=2)

    # 9. Confusion matrices (per model, on test split)
    with open(os.path.join(RESULTS_DIR, "confusion_matrices.json"), "w") as f:
        json.dump(trainer.cm_, f, indent=2)

    print("\n[API Artifacts] All dashboard data saved to outputs/results/ and outputs/models/")


def run_ydata_profiling(feat_df: pd.DataFrame) -> None:
    """Generate a YData Profiling HTML report from the feature matrix."""
    try:
        from ydata_profiling import ProfileReport
    except ImportError:
        print("\n[Profiling] ydata-profiling not installed — skipping. "
              "Run: pip install ydata-profiling")
        return

    print("\n[Profiling] Generating YData Profiling report…")
    profile = ProfileReport(
        feat_df.reset_index(),
        title="Churn Feature Matrix — YData Profiling",
        minimal=False,
        explorative=True,
        progress_bar=True,
    )
    out_path = os.path.join(RESULTS_DIR, "profiling_report.html")
    profile.to_file(out_path)
    print(f"[Profiling] Report saved → {out_path}")


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--file", default=None, help="Path to the .xlsx dataset")
    p.add_argument(
        "--skip-lstm", action="store_true",
        help="Skip LSTM training (faster run without TF/GPU)"
    )
    p.add_argument(
        "--skip-profiling", action="store_true",
        help="Skip YData Profiling report generation (faster run)"
    )
    return p.parse_args()


# ══════════════════════════════════════════════════════════════════════════════
def main():
    args = parse_args()
    make_dirs()

    print("\n" + "=" * 60)
    print("   CHURN PREDICTION PIPELINE — ONLINE RETAIL")
    print("=" * 60)

    # ── STEP 1: Load ──────────────────────────────────────────────────────────
    loader     = DataLoader()
    raw_df     = loader.load(filepath=args.file)

    # ── STEP 2: Clean ─────────────────────────────────────────────────────────
    cleaner    = DataCleaner()
    clean_df   = cleaner.clean(raw_df)

    # ── EDA plots ─────────────────────────────────────────────────────────────
    plot_eda(clean_df)

    # ── STEP 3: Feature Engineering ───────────────────────────────────────────
    engineer   = FeatureEngineer()

    # 3a. Tabular features + churn label
    feat_df    = engineer.build_tabular(clean_df)

    # 3b. Sequential features for LSTM (skip if flag set)
    sequences  = None
    if not args.skip_lstm:
        sequences = engineer.build_sequences(clean_df)

    # ── YData Profiling ───────────────────────────────────────────────────────
    if not args.skip_profiling:
        run_ydata_profiling(feat_df)

    # ── Churn analysis plot ───────────────────────────────────────────────────
    plot_churn_analysis(feat_df)

    # Save raw feature matrix
    feat_df.to_csv(os.path.join(RESULTS_DIR, "features_raw.csv"))

    # ── STEP 4: Feature Selection ─────────────────────────────────────────────
    y          = feat_df["churn"]
    X_raw      = feat_df.drop(columns=["churn"])

    selector   = FeatureSelector()
    X_selected = selector.fit_transform(X_raw, y)
    X_selected.to_csv(os.path.join(RESULTS_DIR, "features_selected.csv"))

    print(f"\n  Selected features ({len(selector.selected_features)}): "
          f"{selector.selected_features}")

    # ── STEP 5: Model Training ────────────────────────────────────────────────
    trainer    = ModelTrainer()

    # Build aligned sequence dict (only selected customers)
    seq_aligned = None
    if sequences is not None:
        seq_aligned = {k: v for k, v in sequences.items() if k in X_selected.index}

    results_df = trainer.fit_evaluate(X_selected, y, sequences=seq_aligned)

    # Save results
    results_df.to_csv(os.path.join(RESULTS_DIR, "model_results.csv"))

    # ── Plots ─────────────────────────────────────────────────────────────────
    plot_feature_importance(trainer, selector.selected_features)
    plot_model_comparison(results_df)

    # ROC curves require a held-out test set — re-split deterministically
    X_tr_plot, X_te_plot, y_tr_plot, y_te_plot = train_test_split(
        X_selected, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )
    seq_te = None
    if seq_aligned is not None:
        seq_te = {k: v for k, v in seq_aligned.items() if k in X_te_plot.index}
    plot_roc_curves(trainer, X_te_plot, y_te_plot, seq_te)

    # ── STEP 6: Recommendation ────────────────────────────────────────────────
    recommender = Recommender()
    recommender.fit(clean_df)

    # Use best model's predicted probabilities on ALL customers
    best = trainer.best_name_
    if best == "LSTM" and seq_aligned is not None:
        all_probs_arr = trainer.predict_proba_lstm(seq_aligned, X_selected.index)
    elif best == "ANN":
        X_s = trainer.scaler.transform(X_selected)
        all_probs_arr = trainer.models_["ANN"].predict(X_s, verbose=0).flatten()
    else:
        all_probs_arr = trainer.models_[best].predict_proba(X_selected.values)[:, 1]

    churn_probs = pd.Series(all_probs_arr, index=X_selected.index)
    reco_df     = recommender.recommend(churn_probs, feat_df, clean_df)

    # ── STEP 7: Summary & Plots ───────────────────────────────────────────────
    plot_recommendation_summary(reco_df)
    save_summary(results_df, reco_df)
    save_api_artifacts(trainer, selector, feat_df, churn_probs, clean_df)

    print("\n[Pipeline complete]")
    print(f"  Plots   → {PLOTS_DIR}/")
    print(f"  Results → {RESULTS_DIR}/")
    print(f"  Models  → {MODELS_DIR}/")


if __name__ == "__main__":
    main()
