"""Step 6 – Recommendation engine for churn-retention promotions.

Strategy
--------
1. Use the best churn model's predicted probabilities to identify at-risk customers.
2. Segment at-risk customers into 3 value tiers (High / Medium / Low) based on
   their historical monetary value.
3. Run Apriori association-rule mining on the entire purchase history to find
   frequently bought-together products.
4. For each churner, look up the top-3 products they bought most, then use
   association rules to surface complementary recommendations.
5. Assign a promotion type based on the value tier.
"""
import os
import pandas as pd
import numpy as np
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder
from config import (
    APRIORI_MIN_SUPPORT, APRIORI_MIN_CONFIDENCE, APRIORI_MIN_LIFT,
    CHURN_PROB_THRESHOLD, HIGH_VALUE_QUANTILE, RESULTS_DIR,
)


PROMOTION_MAP = {
    "High":   "🎖️  Premium Loyalty Reward — 20% off entire basket + free priority shipping",
    "Medium": "🎁  Comeback Offer — 15% off your favourite categories",
    "Low":    "💌  Reactivation Voucher — £5 off next purchase (min. £20 spend)",
}


class Recommender:
    def __init__(self):
        self.rules: pd.DataFrame | None = None
        self.product_pop: pd.Series | None = None   # global product popularity

    # ──────────────────────────────────────────────────────────────────────────
    def fit(self, df_clean: pd.DataFrame) -> None:
        """Mine association rules from the full cleaned transaction data."""
        print("\n[Recommender] Mining association rules …")

        # Build basket matrix: one row per invoice, one col per stock_code (bool)
        basket = (
            df_clean.groupby(["invoice_id", "description"])["quantity"]
            .sum()
            .unstack(fill_value=0)
            .clip(upper=1)
            .astype(bool)
        )

        # Apriori
        freq_items = apriori(basket, min_support=APRIORI_MIN_SUPPORT, use_colnames=True, verbose=0)
        if freq_items.empty:
            print("  No frequent itemsets found — try lowering APRIORI_MIN_SUPPORT.")
            self.rules = pd.DataFrame()
            return

        self.rules = association_rules(
            freq_items, metric="lift", min_threshold=APRIORI_MIN_LIFT
        )
        self.rules = self.rules[self.rules["confidence"] >= APRIORI_MIN_CONFIDENCE]
        self.rules = self.rules.sort_values("lift", ascending=False).reset_index(drop=True)
        print(f"  Association rules mined : {len(self.rules):,}")

        # Product popularity (by number of invoices containing it)
        self.product_pop = (
            df_clean.groupby("description")["invoice_id"].nunique()
            .sort_values(ascending=False)
        )

    # ──────────────────────────────────────────────────────────────────────────
    def recommend(
        self,
        churn_probs: pd.Series,       # index = customer_id
        feature_df: pd.DataFrame,     # full feature matrix (has 'monetary')
        df_clean: pd.DataFrame,       # cleaned transactions for purchase history
    ) -> pd.DataFrame:
        """Return a recommendation dataframe for predicted churners."""
        os.makedirs(RESULTS_DIR, exist_ok=True)

        churners = churn_probs[churn_probs >= CHURN_PROB_THRESHOLD].index.tolist()
        print(f"\n[Recommender] {len(churners):,} predicted churners out of {len(churn_probs):,}")

        # ── Value segmentation ────────────────────────────────────────────────────
        monetary = feature_df["monetary"]
        high_thr = monetary.quantile(HIGH_VALUE_QUANTILE)
        mid_thr  = monetary.quantile(0.40)

        def _tier(cid):
            m = monetary.get(cid, 0)
            if m >= high_thr:
                return "High"
            elif m >= mid_thr:
                return "Medium"
            return "Low"

        # ── Per-customer purchase history ─────────────────────────────────────────
        cust_products = (
            df_clean[df_clean["customer_id"].isin(churners)]
            .groupby(["customer_id", "description"])["quantity"]
            .sum()
            .reset_index()
        )

        records = []
        for cid in churners:
            cp    = cust_products[cust_products["customer_id"] == cid]
            top3  = cp.nlargest(3, "quantity")["description"].tolist()
            recs  = self._get_recommendations(top3)
            tier  = _tier(cid)
            records.append({
                "customer_id":           cid,
                "churn_probability":     round(float(churn_probs[cid]), 4),
                "value_tier":            tier,
                "top_purchased":         "; ".join(top3),
                "recommended_products":  "; ".join(recs[:3]),
                "promotion":             PROMOTION_MAP[tier],
            })

        reco_df = pd.DataFrame(records).sort_values("churn_probability", ascending=False)
        out_path = os.path.join(RESULTS_DIR, "retention_recommendations.csv")
        reco_df.to_csv(out_path, index=False)
        print(f"  Saved: {out_path}")
        return reco_df

    # ──────────────────────────────────────────────────────────────────────────
    def _get_recommendations(self, purchased_products: list[str]) -> list[str]:
        recs: list[str] = []
        if self.rules is not None and not self.rules.empty:
            for prod in purchased_products:
                matches = self.rules[
                    self.rules["antecedents"].apply(lambda a: prod in a)
                ]
                for _, row in matches.head(3).iterrows():
                    for item in row["consequents"]:
                        if item not in purchased_products and item not in recs:
                            recs.append(item)
                if len(recs) >= 5:
                    break

        # Fall back to globally popular products the customer has not yet bought
        if len(recs) < 3 and self.product_pop is not None:
            for prod in self.product_pop.index:
                if prod not in purchased_products and prod not in recs:
                    recs.append(prod)
                if len(recs) >= 5:
                    break

        return recs
