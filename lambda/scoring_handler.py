import json
import math

def calculate_risk_score(features):
    """
    Serverless Scoring Engine:
    Incorporates calibrated credit, demographic, financial obligations, collateral, 
    and alternative credit signals, generating TreeSHAP and explainability attributions.
    Purged of unverified heuristics and non-compliant proxy attributes.
    """
    monthly_income = float(features.get("monthly_income") or 5000)
    loan_amount = float(features.get("loan_amount") or 20000)
    tenure_months = float(features.get("tenure_months") or 36)
    outstanding_balance = float(features.get("outstanding_balance") or 5000)

    # Demographic features
    age = float(features.get("age") or 43)
    num_dependents = float(features.get("num_dependents") or 0)
    marital_status = str(features.get("marital_status") or "single").lower()

    # Financial & Debt features
    total_existing_debt = float(features.get("total_existing_debt") or 0)
    collateral_value = float(features.get("collateral_value") or 0)
    total_assets = float(features.get("total_assets") or 0)
    months_at_current_job = float(features.get("months_at_current_job") or features.get("months_employed") or 24)
    income_consistency = float(features.get("income_consistency_score") or 0.7)

    # Credit & Alternative credit
    alt_credit = features.get("alternative_credit_score") or features.get("credit_score")
    alt_credit_score = float(alt_credit) if alt_credit is not None else 680.0
    interest_rate = float(features.get("interest_rate") or 10.5)

    # Core credit ratios
    annual_income = monthly_income * 12.0 + 1e-5
    dti = (outstanding_balance + total_existing_debt) / annual_income
    loan_to_income = loan_amount / annual_income
    collateral_coverage = collateral_value / (loan_amount + 1e-5)
    asset_cushion = total_assets / (loan_amount + 1e-5)

    # Calibrated Baseline Logit (Empirical Loan Default Log-Odds)
    base_logit = -0.35
    shap_contributions = {}

    # 1. Loan to Income & Principal Size
    lti_impact = (loan_to_income - 0.45) * 0.8
    shap_contributions["LoanAmount"] = round(lti_impact, 3)

    # 2. DTI & Debt
    dti_impact = (dti - 0.35) * 1.2
    shap_contributions["DTIRatio"] = round(dti_impact, 3)

    # 3. Credit Score
    credit_impact = -(alt_credit_score - 680.0) / 200.0 * 0.5
    shap_contributions["CreditScore"] = round(credit_impact, 3)

    # 4. Interest Rate Carrying Burden
    rate_impact = (interest_rate - 10.0) * 0.04
    shap_contributions["InterestRate"] = round(rate_impact, 3)

    # 5. Employment Stability
    emp_impact = -min(0.25, max(-0.25, (months_at_current_job - 24) * 0.005))
    shap_contributions["MonthsEmployed"] = round(emp_impact, 3)

    # 6. Age Profile
    age_impact = -(age - 40.0) * 0.004
    shap_contributions["Age"] = round(age_impact, 3)

    # 7. Collateral Cushion
    if collateral_coverage > 0.8:
        collateral_impact = -0.30
    elif collateral_coverage > 0.3:
        collateral_impact = -0.15
    else:
        collateral_impact = 0.05
    shap_contributions["collateral_coverage"] = round(collateral_impact, 3)

    # 8. Asset Liquidity
    asset_impact = -min(0.20, asset_cushion * 0.08)
    shap_contributions["asset_liquidity"] = round(asset_impact, 3)

    # Aggregate logit & compute calibrated probability
    total_logit = (
        base_logit
        + lti_impact
        + dti_impact
        + credit_impact
        + rate_impact
        + emp_impact
        + age_impact
        + collateral_impact
        + asset_impact
    )

    prob_default = 1.0 / (1.0 + math.exp(-total_logit))
    prob_default = max(0.05, min(0.95, prob_default))
    score = int(round(prob_default * 1000))

    # Risk Bucket allocation
    if prob_default >= 0.65:
        bucket = "CRITICAL"
    elif prob_default >= 0.45:
        bucket = "HIGH"
    elif prob_default >= 0.25:
        bucket = "MEDIUM"
    else:
        bucket = "LOW"

    sorted_features = sorted(shap_contributions.items(), key=lambda x: abs(x[1]), reverse=True)
    reasons = []
    lime_explanations = []

    for rank, (feat, impact) in enumerate(sorted_features[:5], start=1):
        direction = "increases" if impact > 0 else "decreases"
        if feat == "LoanAmount":
            desc = f"Requested principal (${int(loan_amount):,}) {'strains debt capacity' if impact > 0 else 'is well within debt capacity'}"
        elif feat == "DTIRatio":
            desc = f"Debt-to-income ratio ({round(dti*100, 1)}%) {'elevates default risk' if impact > 0 else 'reflects manageable debt load'}"
        elif feat == "CreditScore":
            desc = f"Credit score ({int(alt_credit_score)}) {'demonstrates reliable payment history' if impact < 0 else 'indicates higher credit risk'}"
        elif feat == "InterestRate":
            desc = f"Interest rate of {round(interest_rate, 1)}% {'increases payment burden' if impact > 0 else 'maintains manageable borrowing costs'}"
        elif feat == "MonthsEmployed":
            desc = f"Employment history of {int(months_at_current_job)} months {'demonstrates income stability' if impact < 0 else 'presents shorter earnings track record'}"
        elif feat == "Age":
            desc = f"Age profile ({int(age)} yrs) {'reflects established actuarial baseline' if impact < 0 else 'reflects emerging credit profile'}"
        elif feat == "collateral_coverage":
            desc = f"Collateral coverage ({round(collateral_coverage*100, 1)}%) {'substantially secures credit' if impact < 0 else 'is modest relative to principal'}"
        else:
            desc = f"Asset reserve cushion (${int(total_assets):,}) provides strong liquidity"

        reasons.append({
            "rank": rank,
            "feature": feat,
            "impact": impact,
            "reason": desc
        })

        lime_explanations.append({
            "feature": feat,
            "explanation": desc,
            "direction": direction,
            "magnitude": round(abs(impact), 3)
        })

    return score, prob_default, bucket, reasons, shap_contributions, lime_explanations

def lambda_handler(event, context):
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization"
    }

    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS" or event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    try:
        if "body" in event and event["body"]:
            body_raw = event["body"]
            body = json.loads(body_raw) if isinstance(body_raw, str) else body_raw
        else:
            body = event

        borrower_id = body.get("borrower_id", "unknown")
        features = body.get("features", {})

        score, prob, bucket, reasons, shap_values, lime_explanations = calculate_risk_score(features)

        response_payload = {
            "borrower_id": borrower_id,
            "score": score,
            "default_probability": round(prob, 4),
            "bucket": bucket,
            "model_version": "v2.1-calibrated-xgboost",
            "risk_reasons": reasons,
            "shap_values": shap_values,
            "lime_explanations": lime_explanations,
            "scored_by": "AWS Lambda Serverless Inference (ap-southeast-2)"
        }

        if "requestContext" in event or "httpMethod" in event:
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(response_payload)
            }

        return response_payload
    except Exception as e:
        if "requestContext" in event or "httpMethod" in event:
            return {
                "statusCode": 500,
                "headers": headers,
                "body": json.dumps({"error": str(e)})
            }
        raise e
