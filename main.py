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
import os
import sys
import warnings
warnings.filterwarnings("ignore")

# Make src/ importable when running from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
sys.path.insert(0, os.path.dirname(__file__))

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


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--file", default=None, help="Path to the .xlsx dataset")
    p.add_argument(
        "--skip-lstm", action="store_true",
        help="Skip LSTM training (faster run without TF/GPU)"
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

    print("\n[Pipeline complete]")
    print(f"  Plots   → {PLOTS_DIR}/")
    print(f"  Results → {RESULTS_DIR}/")
    print(f"  Models  → {MODELS_DIR}/")


if __name__ == "__main__":
    main()
