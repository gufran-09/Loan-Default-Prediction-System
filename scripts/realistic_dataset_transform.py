"""Create a more realistic lending dataset from the synthetic v1 CSV."""

from pathlib import Path

import numpy as np
import pandas as pd


RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)
RNG = np.random.default_rng(RANDOM_SEED)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
INPUT_PATH = PROJECT_ROOT / "Loan_default_cleaned.csv"
OUTPUT_PATH = PROJECT_ROOT / "Loan_default_v2.csv"


def weighted_sample_indices(weights: np.ndarray, count: int) -> np.ndarray:
    """Select an exact number of rows without replacement using row weights."""
    probabilities = np.asarray(weights, dtype=float)
    probabilities /= probabilities.sum()
    return RNG.choice(len(probabilities), size=count, replace=False, p=probabilities)


def rebalance_one_hot_group(df: pd.DataFrame, columns: list[str], probabilities: list[float]) -> None:
    categories = RNG.choice(columns, size=len(df), p=probabilities)
    df.loc[:, columns] = 0
    for column in columns:
        df.loc[categories == column, column] = 1


def one_hot_columns(df: pd.DataFrame, prefix: str) -> list[str]:
    return [column for column in df.columns if column.startswith(prefix)]


def create_dataset() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Input dataset not found: {INPUT_PATH}")

    source = pd.read_csv(INPUT_PATH)
    row_count_in = len(source)
    before_summary = source[["Age", "Income", "DTIRatio", "LoanAmount"]].describe()
    df = source.copy()

    # Retain Age for actuarial demographic concentration analysis & model governance drift audits
    df["Age"] = source["Age"].astype(float)

    income_min = float(df["Income"].min())
    income_max = float(df["Income"].max())
    df["Income"] = np.clip(
        RNG.lognormal(mean=np.log(60000), sigma=0.62, size=len(df)),
        income_min,
        income_max,
    )

    dti_min = float(df["DTIRatio"].min())
    dti_max = float(df["DTIRatio"].max())
    df["DTIRatio"] = np.clip(
        dti_min + (dti_max - dti_min) * RNG.beta(3.5, 8.5, size=len(df)),
        dti_min,
        dti_max,
    )

    education_columns = one_hot_columns(df, "Education_")
    employment_columns = one_hot_columns(df, "EmploymentType_")
    purpose_columns = one_hot_columns(df, "LoanPurpose_")
    rebalance_one_hot_group(df, education_columns, [0.60, 0.20, 0.15, 0.05])
    rebalance_one_hot_group(df, employment_columns, [0.60, 0.15, 0.20, 0.05])
    rebalance_one_hot_group(df, purpose_columns, [0.40, 0.18, 0.12, 0.22, 0.08])

    purpose_multiplier = np.select(
        [
            df["LoanPurpose_Home"].eq(1),
            df["LoanPurpose_Auto"].eq(1),
            df["LoanPurpose_Business"].eq(1),
            df["LoanPurpose_Education"].eq(1),
        ],
        [1.45, 0.78, 1.10, 0.65],
        default=0.70,
    )
    loan_noise = RNG.normal(loc=1.0, scale=0.22, size=len(df))
    loan_min = float(source["LoanAmount"].min())
    loan_max = float(source["LoanAmount"].max())
    df["LoanAmount"] = np.clip(df["Income"] * 1.25 * purpose_multiplier * loan_noise, loan_min, loan_max)

    default = df["Default"].astype(int).to_numpy()
    credit_weights = 1.0 + 4.0 * (1.0 - df["MonthsEmployed"].to_numpy() / df["MonthsEmployed"].max())
    credit_missing = weighted_sample_indices(credit_weights, round(len(df) * 0.09))
    df.loc[credit_missing, "CreditScore"] = np.nan

    employment_weights = 1.0 + 5.0 * df["EmploymentType_Self-employed"].to_numpy()
    employment_missing = weighted_sample_indices(employment_weights, round(len(df) * 0.10))
    df.loc[employment_missing, "MonthsEmployed"] = np.nan

    income_missing = RNG.choice(len(df), size=round(len(df) * 0.05), replace=False)
    df.loc[income_missing, "Income"] = np.nan

    age_missing = RNG.choice(len(df), size=round(len(df) * 0.05), replace=False)
    df.loc[age_missing, "Age"] = np.nan

    df["outstanding_balance_ratio"] = np.where(
        default == 1,
        RNG.uniform(0.70, 1.00, size=len(df)),
        RNG.uniform(0.35, 0.95, size=len(df)),
    )

    date_range = pd.date_range("2019-01-01", "2023-12-31", freq="D")
    origination_dates = pd.Series(RNG.choice(date_range, size=len(df)), index=df.index)
    month_offsets = RNG.integers(3, 61, size=len(df))
    origination_periods = origination_dates.dt.to_period("M")
    observation_periods = origination_periods + month_offsets
    observation_dates = observation_periods.dt.to_timestamp()
    observation_dates = pd.Series(
        np.minimum(observation_dates.to_numpy(dtype="datetime64[ns]"), np.datetime64("2024-06-01")),
        index=df.index,
    )
    df["origination_date"] = origination_dates.dt.strftime("%Y-%m-%d")
    df["observation_date"] = observation_dates.dt.strftime("%Y-%m-%d")

    observation_period_numbers = observation_dates.dt.to_period("M").astype("int64")
    origination_period_numbers = origination_dates.dt.to_period("M").astype("int64")
    mature = (observation_period_numbers - origination_period_numbers) >= 12
    loan_status = np.full(len(df), "Current", dtype=object)
    loan_status[mature.to_numpy() & (default == 1)] = "Charged Off"
    mature_non_default = mature.to_numpy() & (default == 0)
    current_non_default = mature_non_default & (RNG.random(len(df)) < 0.15)
    loan_status[mature_non_default & ~current_non_default] = "Fully Paid"
    loan_status[current_non_default] = "Current"
    df["loan_status"] = loan_status

    df["days_past_due"] = np.where(default == 1, RNG.integers(90, 181, size=len(df)), 0)
    non_default_delinquency = (default == 0) & (RNG.random(len(df)) < 0.10)
    df["delinquency_count_12m"] = np.where(
        default == 1,
        RNG.integers(1, 7, size=len(df)),
        np.where(non_default_delinquency, RNG.integers(1, 3, size=len(df)), 0),
    )
    df["num_inquiries_6m"] = np.clip(
        np.where(default == 1, RNG.poisson(3.0, len(df)), RNG.poisson(1.2, len(df))), 0, 8
    )
    df["credit_utilization"] = np.where(
        default == 1,
        RNG.beta(6.0, 2.0, len(df)),
        RNG.beta(3.5, 6.0, len(df)),
    )

    prior_defaults = np.zeros(len(df), dtype=int)
    default_rows = default == 1
    prior_defaults[default_rows] = RNG.choice([0, 1, 2, 3], size=default_rows.sum(), p=[0.45, 0.35, 0.15, 0.05])
    non_default_rows = ~default_rows
    prior_defaults[non_default_rows] = RNG.choice(
        [0, 1, 2, 3], size=non_default_rows.sum(), p=[0.90, 0.09, 0.009, 0.001]
    )
    df["prior_defaults"] = prior_defaults

    secured = df["LoanPurpose_Home"].eq(1) | df["LoanPurpose_Auto"].eq(1)
    df["collateral_value"] = np.where(
        secured,
        df["LoanAmount"] * RNG.uniform(0.90, 1.30, size=len(df)),
        0.0,
    )

    df = df.rename(columns={"Default": "default_ever"})
    df["default_label"] = df["loan_status"].map({"Charged Off": 1, "Fully Paid": 0})
    after_summary = df[["Age", "Income", "DTIRatio", "LoanAmount"]].describe()

    if len(df) != row_count_in:
        raise AssertionError("Row count changed during transformation")
    for prohibited in ["health_status", "disability_flag", "income_verified"]:
        if prohibited in df.columns:
            raise AssertionError(f"{prohibited} must not be present in the output dataset")

    df.to_csv(OUTPUT_PATH, index=False)
    return source, df, pd.concat(
        [before_summary.rename(columns={column: f"{column}_before" for column in before_summary.columns}), after_summary.rename(columns={column: f"{column}_after" for column in after_summary.columns})],
        axis=1,
    )


def print_validation(source: pd.DataFrame, df: pd.DataFrame, distribution_summary: pd.DataFrame) -> None:
    print("\n=== Loan_default_v2.csv validation ===")
    print(f"Row count preserved: {len(source):,} in, {len(df):,} out -> {len(source) == len(df)}")
    print(f"Age column present: {'Age' in df.columns}")
    print(f"health_status column absent: {'health_status' not in df.columns}")
    print(f"disability_flag column absent: {'disability_flag' not in df.columns}")
    print(f"income_verified column absent: {'income_verified' not in df.columns}")

    missing = df.isna().sum()
    missing = missing[missing > 0]
    print("\nMissingness summary:")
    if missing.empty:
        print("No missing values")
    else:
        print(pd.DataFrame({"column": missing.index, "count": missing.values, "percentage": (missing / len(df) * 100).round(2).values}).to_string(index=False))

    print("\nLoan status counts:")
    print(df["loan_status"].value_counts(dropna=False).to_string())
    null_labels = int(df["default_label"].isna().sum())
    print(f"\nRows with null default_label: {null_labels:,} (MUST BE EXCLUDED FROM TRAINING)")
    print("\nIncome, DTIRatio, and LoanAmount distribution summary (side by side):")
    print(distribution_summary.to_string())
    print(f"\noutstanding_balance_ratio std dev: {df['outstanding_balance_ratio'].std():.6f}")

    print("\nOne-hot group validation (every row must sum to exactly 1):")
    for prefix in ["Education_", "EmploymentType_", "LoanPurpose_"]:
        columns = one_hot_columns(df, prefix)
        sums = df[columns].sum(axis=1)
        print(f"{prefix}: {bool(sums.eq(1).all())}")


if __name__ == "__main__":
    source_df, output_df, summary = create_dataset()
    print_validation(source_df, output_df, summary)
    print(f"\nWrote transformed dataset to: {OUTPUT_PATH}")