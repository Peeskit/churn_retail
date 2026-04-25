"""Step 3 – Feature engineering: RFM, window, sequence features, and churn label."""
import numpy as np
import pandas as pd
from config import (
    CHURN_WINDOW_DAYS,
    OBSERVATION_WINDOW_DAYS,
    WINDOW_DAYS,
    SEQUENCE_LENGTH,
    LSTM_SEQ_FEATURES,
)


class FeatureEngineer:
    def __init__(self):
        self.reference_date: pd.Timestamp | None = None
        self.max_date: pd.Timestamp | None = None
        self.obs_start: pd.Timestamp | None = None

    # ──────────────────────────────────────────────────────────────────────────
    # Public: tabular features + churn label
    # ──────────────────────────────────────────────────────────────────────────
    def build_tabular(self, df: pd.DataFrame) -> pd.DataFrame:
        self.max_date      = df["invoice_date"].max()
        self.reference_date = self.max_date - pd.Timedelta(days=CHURN_WINDOW_DAYS)
        self.obs_start     = self.reference_date - pd.Timedelta(days=OBSERVATION_WINDOW_DAYS)

        print(f"\n[FeatureEngineer] Max date       : {self.max_date.date()}")
        print(f"                  Reference date : {self.reference_date.date()}")
        print(f"                  Obs start      : {self.obs_start.date()}")

        obs  = df[(df["invoice_date"] >= self.obs_start) & (df["invoice_date"] < self.reference_date)]
        pred = df[df["invoice_date"] >= self.reference_date]

        active_in_pred = set(pred["customer_id"].unique())

        records = []
        for cust_id, grp in obs.groupby("customer_id"):
            feat = self._customer_features(cust_id, grp)
            feat["churn"] = 0 if cust_id in active_in_pred else 1
            records.append(feat)

        feat_df = pd.DataFrame(records).set_index("customer_id")
        print(f"  Feature matrix : {feat_df.shape}")
        print(f"  Churn rate     : {feat_df['churn'].mean():.2%}")
        return feat_df

    # ──────────────────────────────────────────────────────────────────────────
    # Public: sequential features for LSTM
    # ──────────────────────────────────────────────────────────────────────────
    def build_sequences(self, df: pd.DataFrame) -> dict[str, np.ndarray]:
        if self.reference_date is None:
            raise RuntimeError("Call build_tabular() first.")

        obs = df[df["invoice_date"] < self.reference_date].copy()
        obs["year_month"] = obs["invoice_date"].dt.to_period("M")

        monthly = (
            obs.groupby(["customer_id", "year_month"])
            .agg(
                revenue    = ("revenue",    "sum"),
                txn_count  = ("invoice_id", "nunique"),
                qty        = ("quantity",   "sum"),
                unique_sku = ("stock_code", "nunique"),
                avg_price  = ("price",      "mean"),
            )
            .reset_index()
        )

        all_months  = sorted(obs["year_month"].unique())
        seq_months  = all_months[-SEQUENCE_LENGTH:]
        n_feat      = len(LSTM_SEQ_FEATURES)

        sequences: dict[str, np.ndarray] = {}
        for cust_id, grp in monthly.groupby("customer_id"):
            month_idx = grp.set_index("year_month")
            seq = np.zeros((SEQUENCE_LENGTH, n_feat), dtype=np.float32)
            for t, m in enumerate(seq_months):
                if m in month_idx.index:
                    seq[t] = month_idx.loc[m, LSTM_SEQ_FEATURES].values.astype(np.float32)
            sequences[cust_id] = seq

        print(f"  Sequences built: {len(sequences)} customers, "
              f"shape ({SEQUENCE_LENGTH}, {n_feat}) each")
        return sequences

    # ──────────────────────────────────────────────────────────────────────────
    # Private: per-customer feature computation
    # ──────────────────────────────────────────────────────────────────────────
    def _customer_features(self, cust_id: str, grp: pd.DataFrame) -> dict:
        grp = grp.sort_values("invoice_date")

        # ── RFM ─────────────────────────────────────────────────────────────────
        last_date  = grp["invoice_date"].max()
        first_date = grp["invoice_date"].min()
        recency    = (self.reference_date - last_date).days
        frequency  = grp["invoice_id"].nunique()
        monetary   = grp["revenue"].sum()
        avg_basket = monetary / max(frequency, 1)

        # ── Window features ──────────────────────────────────────────────────────
        wf: dict = {}
        for w in WINDOW_DAYS:
            cutoff = self.reference_date - pd.Timedelta(days=w)
            wg = grp[grp["invoice_date"] >= cutoff]
            wf[f"txn_last{w}d"]        = wg["invoice_id"].nunique()
            wf[f"rev_last{w}d"]        = wg["revenue"].sum()
            wf[f"qty_last{w}d"]        = wg["quantity"].sum()
            wf[f"unique_sku_last{w}d"] = wg["stock_code"].nunique()

        # Acceleration: ratio of 30-day vs 90-day activity
        wf["accel_txn"] = (wf["txn_last30d"] + 1) / (wf["txn_last90d"] + 1)
        wf["accel_rev"] = (wf["rev_last30d"]  + 1) / (wf["rev_last90d"]  + 1)

        # ── Inter-purchase gap ───────────────────────────────────────────────────
        inv_dates = grp.drop_duplicates("invoice_id")["invoice_date"].sort_values()
        if len(inv_dates) > 1:
            gaps = inv_dates.diff().dt.days.dropna()
            avg_gap    = gaps.mean()
            std_gap    = gaps.std(ddof=0)
            median_gap = gaps.median()
            cv_gap     = std_gap / (avg_gap + 1e-9)
        else:
            avg_gap = std_gap = median_gap = cv_gap = np.nan

        # ── Diversity & price ────────────────────────────────────────────────────
        unique_skus  = grp["stock_code"].nunique()
        avg_price    = grp["price"].mean()
        avg_qty      = grp["quantity"].mean()
        sku_per_inv  = unique_skus / max(frequency, 1)

        # ── Temporal patterns ────────────────────────────────────────────────────
        grp = grp.copy()
        grp["dow"]   = grp["invoice_date"].dt.dayofweek
        grp["month"] = grp["invoice_date"].dt.month
        mode_dow     = int(grp["dow"].mode().iloc[0])
        std_dow      = grp["dow"].std(ddof=0)

        # ── Tenure ──────────────────────────────────────────────────────────────
        tenure_days = max((last_date - first_date).days, 1)
        purchase_rate = frequency / (tenure_days / 30.0)   # invoices per month

        return {
            "customer_id":    cust_id,
            # RFM
            "recency":        recency,
            "frequency":      frequency,
            "monetary":       monetary,
            "avg_basket":     avg_basket,
            # Window
            **wf,
            # Inter-purchase
            "avg_gap_days":   avg_gap,
            "std_gap_days":   std_gap,
            "median_gap_days": median_gap,
            "cv_gap":         cv_gap,
            # Diversity
            "unique_skus":    unique_skus,
            "sku_per_inv":    sku_per_inv,
            # Price / qty
            "avg_price":      avg_price,
            "avg_qty":        avg_qty,
            # Temporal
            "mode_dow":       mode_dow,
            "std_dow":        std_dow,
            # Tenure
            "tenure_days":    tenure_days,
            "purchase_rate":  purchase_rate,
        }
