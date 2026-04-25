"""Step 7 – All visualisations and summary reporting."""
import os
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import seaborn as sns
from sklearn.metrics import roc_curve, auc, ConfusionMatrixDisplay, confusion_matrix
from sklearn.preprocessing import label_binarize

warnings.filterwarnings("ignore")

from config import PLOTS_DIR, RESULTS_DIR

sns.set_theme(style="whitegrid", palette="muted", font_scale=1.1)
COLORS = sns.color_palette("tab10")


def _save(fig, name):
    os.makedirs(PLOTS_DIR, exist_ok=True)
    path = os.path.join(PLOTS_DIR, name)
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


# ── 1. EDA ─────────────────────────────────────────────────────────────────────
def plot_eda(df: pd.DataFrame) -> None:
    print("\n[Visualizer] EDA plots …")

    # Revenue over time
    monthly = (
        df.set_index("invoice_date")
        .resample("ME")["revenue"]
        .sum()
        .reset_index()
    )
    fig, ax = plt.subplots(figsize=(12, 4))
    ax.fill_between(monthly["invoice_date"], monthly["revenue"] / 1e3, alpha=0.4)
    ax.plot(monthly["invoice_date"], monthly["revenue"] / 1e3, lw=2)
    ax.set_title("Monthly Revenue (£ thousands)")
    ax.set_xlabel("Month"); ax.set_ylabel("Revenue (£k)")
    _save(fig, "01_monthly_revenue.png")

    # Top-10 countries by revenue
    country_rev = (
        df.groupby("country")["revenue"].sum()
        .sort_values(ascending=False).head(10)
    )
    fig, ax = plt.subplots(figsize=(10, 5))
    country_rev.plot(kind="barh", ax=ax, color=COLORS[0])
    ax.set_title("Top 10 Countries by Revenue")
    ax.set_xlabel("Revenue (£)"); ax.invert_yaxis()
    _save(fig, "02_top_countries.png")

    # Transaction volume by day-of-week
    df = df.copy()
    df["dow"] = df["invoice_date"].dt.day_name()
    dow_order = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
    dow_cnt   = df.groupby("dow")["invoice_id"].nunique().reindex(dow_order).fillna(0)
    fig, ax = plt.subplots(figsize=(8, 4))
    dow_cnt.plot(kind="bar", ax=ax, color=COLORS[2], rot=30)
    ax.set_title("Transactions by Day of Week")
    ax.set_ylabel("Unique Invoices")
    _save(fig, "03_dow_transactions.png")


# ── 2. Churn analysis ──────────────────────────────────────────────────────────
def plot_churn_analysis(feat_df: pd.DataFrame) -> None:
    print("[Visualizer] Churn analysis plots …")

    # Churn rate bar
    churn_rate = feat_df["churn"].value_counts(normalize=True).sort_index()
    fig, ax = plt.subplots(figsize=(5, 4))
    churn_rate.plot(kind="bar", ax=ax, color=[COLORS[2], COLORS[3]], rot=0)
    ax.set_xticklabels(["Active (0)", "Churned (1)"])
    ax.set_title(f"Churn Distribution  (churn rate = {feat_df['churn'].mean():.1%})")
    ax.set_ylabel("Proportion")
    _save(fig, "04_churn_distribution.png")

    # RFM by churn
    rfm_cols = ["recency", "frequency", "monetary", "avg_basket"]
    fig, axes = plt.subplots(1, len(rfm_cols), figsize=(15, 4))
    for ax, col in zip(axes, rfm_cols):
        for c, label, color in [(0, "Active", COLORS[0]), (1, "Churned", COLORS[3])]:
            vals = feat_df.loc[feat_df["churn"] == c, col].clip(
                upper=feat_df[col].quantile(0.99)
            )
            sns.kdeplot(vals, ax=ax, label=label, color=color, fill=True, alpha=0.4)
        ax.set_title(col.replace("_", " ").title())
        ax.legend()
    fig.suptitle("RFM Distributions: Active vs. Churned", fontsize=13)
    plt.tight_layout()
    _save(fig, "05_rfm_churn.png")


# ── 3. Feature importance ──────────────────────────────────────────────────────
def plot_feature_importance(trainer, feature_names: list[str]) -> None:
    print("[Visualizer] Feature importance …")

    for name in ("LGBM", "XGBoost"):
        if name not in trainer.models_:
            continue
        model = trainer.models_[name]
        imp   = (
            pd.Series(model.feature_importances_, index=feature_names)
            .sort_values(ascending=True)
            .tail(20)
        )
        fig, ax = plt.subplots(figsize=(8, 6))
        imp.plot(kind="barh", ax=ax, color=COLORS[0 if name == "LGBM" else 1])
        ax.set_title(f"{name} Feature Importances")
        ax.set_xlabel("Importance")
        _save(fig, f"06_{name.lower()}_importance.png")


# ── 4. Model comparison ────────────────────────────────────────────────────────
def plot_model_comparison(results_df: pd.DataFrame) -> None:
    print("[Visualizer] Model comparison plots …")

    # Bar chart of metrics
    metrics = ["AUC", "F1", "Precision", "Recall", "Accuracy"]
    fig, ax = plt.subplots(figsize=(10, 5))
    x      = np.arange(len(results_df))
    width  = 0.15
    for i, metric in enumerate(metrics):
        vals = [results_df.loc[m, metric] if metric in results_df.columns else 0
                for m in results_df.index]
        ax.bar(x + i * width, vals, width, label=metric, color=COLORS[i])
    ax.set_xticks(x + width * 2)
    ax.set_xticklabels(results_df.index, rotation=15)
    ax.set_ylim(0, 1.1)
    ax.set_title("Model Performance Comparison")
    ax.legend(loc="lower right")
    _save(fig, "07_model_comparison.png")


# ── 5. ROC curves ─────────────────────────────────────────────────────────────
def plot_roc_curves(
    trainer,
    X_te: pd.DataFrame,
    y_te: pd.Series,
    sequences: dict | None,
) -> None:
    print("[Visualizer] ROC curves …")
    fig, ax = plt.subplots(figsize=(8, 6))

    for i, name in enumerate(trainer.models_):
        try:
            if name == "LSTM":
                if sequences is None:
                    continue
                prob = trainer.predict_proba_lstm(sequences, X_te.index)
            elif name == "ANN":
                X_s  = trainer.scaler.transform(X_te)
                prob = trainer.models_["ANN"].predict(X_s, verbose=0).flatten()
            else:
                prob = trainer.models_[name].predict_proba(X_te.values)[:, 1]

            fpr, tpr, _ = roc_curve(y_te, prob)
            roc_auc     = auc(fpr, tpr)
            ax.plot(fpr, tpr, lw=2, color=COLORS[i], label=f"{name} (AUC={roc_auc:.3f})")
        except Exception as e:
            print(f"    ROC skipped for {name}: {e}")

    ax.plot([0, 1], [0, 1], "k--", lw=1)
    ax.set_xlabel("False Positive Rate"); ax.set_ylabel("True Positive Rate")
    ax.set_title("ROC Curves — All Models")
    ax.legend(loc="lower right")
    _save(fig, "08_roc_curves.png")


# ── 6. Recommendation summary ─────────────────────────────────────────────────
def plot_recommendation_summary(reco_df: pd.DataFrame) -> None:
    print("[Visualizer] Recommendation summary …")

    tier_cnt = reco_df["value_tier"].value_counts()
    fig, axes = plt.subplots(1, 2, figsize=(11, 4))

    tier_cnt.plot(kind="bar", ax=axes[0], color=[COLORS[0], COLORS[2], COLORS[3]], rot=0)
    axes[0].set_title("Churners by Value Tier")
    axes[0].set_ylabel("Count")

    sns.histplot(
        reco_df["churn_probability"], bins=20, kde=True,
        ax=axes[1], color=COLORS[3],
    )
    axes[1].set_title("Churn Probability Distribution (Predicted Churners)")
    axes[1].set_xlabel("P(churn)")
    plt.tight_layout()
    _save(fig, "09_recommendation_summary.png")


# ── 7. Full summary table ─────────────────────────────────────────────────────
def save_summary(results_df: pd.DataFrame, reco_df: pd.DataFrame) -> None:
    os.makedirs(RESULTS_DIR, exist_ok=True)

    results_path = os.path.join(RESULTS_DIR, "model_results.csv")
    results_df.to_csv(results_path)
    print(f"  Saved: {results_path}")

    print("\n" + "=" * 60)
    print("  MODEL PERFORMANCE SUMMARY")
    print("=" * 60)
    print(results_df.to_string())
    print("=" * 60)
    print(f"\n  Retention recommendations: {len(reco_df):,} customers")
    print(reco_df["value_tier"].value_counts().to_string())
    print("=" * 60)
