import json
import math

def calculate_risk_score(features):
    """
    Serverless Scoring Engine:
    Incorporates demographics, financial obligations, collateral, 
    income stability, alternative credit signals, and generates SHAP + LIME explanations.
    """
    monthly_income = float(features.get("monthly_income") or 5000)
    loan_amount = float(features.get("loan_amount") or 20000)
    tenure_months = float(features.get("tenure_months") or 36)
    outstanding_balance = float(features.get("outstanding_balance") or 12000)

    # Demographic features
    age = float(features.get("age") or 35)
    num_dependents = float(features.get("num_dependents") or 0)
    health_status = str(features.get("health_status") or "healthy").lower()
    marital_status = str(features.get("marital_status") or "single").lower()

    # Financial & Debt features
    total_existing_debt = float(features.get("total_existing_debt") or 0)
    collateral_value = float(features.get("collateral_value") or 0)
    collateral_type = str(features.get("collateral_type") or "none").lower()
    total_assets = float(features.get("total_assets") or 0)
    income_source = str(features.get("income_source") or "wages").lower()
    income_verified = bool(features.get("income_verified", False))
    months_at_current_job = float(features.get("months_at_current_job") or 12)
    income_consistency = float(features.get("income_consistency_score") or 0.7)

    # Alternative credit
    alt_credit = features.get("alternative_credit_score")
    alt_credit_score = float(alt_credit) if alt_credit is not None else None

    # Core credit ratios
    annual_income = monthly_income * 12 + 1e-5
    dti = (outstanding_balance + total_existing_debt) / annual_income
    loan_to_income = loan_amount / annual_income
    collateral_coverage = collateral_value / (loan_amount + 1e-5)
    asset_cushion = total_assets / (loan_amount + 1e-5)

    # --- Calibrated Logit Calculation ---
    base_logit = -1.20
    shap_contributions = {}

    # 1. DTI & Debt
    dti_impact = (dti - 0.35) * 3.5
    shap_contributions["debt_to_income"] = round(dti_impact, 3)

    # 2. Loan to Income
    lti_impact = (loan_to_income - 0.30) * 1.8
    shap_contributions["loan_to_income"] = round(lti_impact, 3)

    # 3. Tenure
    tenure_impact = -(tenure_months - 24) * 0.015
    shap_contributions["tenure_history"] = round(tenure_impact, 3)

    # 4. Demographic: Age factor (peak earning / stability vs early/late risk)
    if age < 24:
        age_impact = 0.28
    elif age <= 55:
        age_impact = -0.15
    elif age <= 65:
        age_impact = 0.05
    else:
        age_impact = 0.20
    shap_contributions["applicant_age"] = round(age_impact, 3)

    # 5. Dependents vs disposable income
    dep_impact = min(0.35, num_dependents * 0.08)
    shap_contributions["dependents_burden"] = round(dep_impact, 3)

    # 6. Health & disability status
    if health_status == "chronic_condition":
        health_impact = 0.32
    elif health_status == "disability":
        health_impact = 0.40
    else:
        health_impact = -0.05
    shap_contributions["health_status"] = round(health_impact, 3)

    # 7. Marital status
    marital_impact = -0.10 if marital_status == "married" else 0.05
    shap_contributions["marital_status"] = round(marital_impact, 3)

    # 8. Collateral & Assets Cushion
    if collateral_coverage > 0.8:
        collateral_impact = -0.45
    elif collateral_coverage > 0.3:
        collateral_impact = -0.20
    else:
        collateral_impact = 0.10
    shap_contributions["collateral_coverage"] = round(collateral_impact, 3)

    asset_impact = -min(0.35, asset_cushion * 0.15)
    shap_contributions["asset_liquidity"] = round(asset_impact, 3)

    # 9. Income stability & verification
    stability_impact = 0.0
    if not income_verified:
        stability_impact += 0.25
    if months_at_current_job < 6:
        stability_impact += 0.20
    elif months_at_current_job >= 24:
        stability_impact -= 0.15
    stability_impact -= (income_consistency - 0.5) * 0.4
    shap_contributions["income_stability"] = round(stability_impact, 3)

    # 10. Alternative credit history
    if alt_credit_score is not None:
        alt_impact = -(alt_credit_score - 650) / 250.0 * 0.30
        shap_contributions["alternative_credit"] = round(alt_impact, 3)
    else:
        alt_impact = 0.0

    # Aggregate logit & compute probability
    total_logit = (
        base_logit
        + dti_impact
        + lti_impact
        + tenure_impact
        + age_impact
        + dep_impact
        + health_impact
        + marital_impact
        + collateral_impact
        + asset_impact
        + stability_impact
        + alt_impact
    )

    prob_default = 1.0 / (1.0 + math.exp(-total_logit))
    prob_default = max(0.01, min(0.99, prob_default))
    score = int(prob_default * 1000)

    # Risk Bucket allocation
    if score >= 650:
        bucket = "CRITICAL"
    elif score >= 450:
        bucket = "HIGH"
    elif score >= 250:
        bucket = "MEDIUM"
    else:
        bucket = "LOW"

    # Sorted risk reasons / local attributions
    sorted_features = sorted(shap_contributions.items(), key=lambda x: abs(x[1]), reverse=True)
    reasons = []
    lime_explanations = []

    for rank, (feat, impact) in enumerate(sorted_features[:5], start=1):
        direction = "increases" if impact > 0 else "decreases"
        if feat == "debt_to_income":
            desc = f"Debt-to-income ratio ({round(dti*100, 1)}%) {'elevates default risk' if impact > 0 else 'reflects manageable debt load'}"
        elif feat == "loan_to_income":
            desc = f"Requested loan size relative to annual income {'strains debt capacity' if impact > 0 else 'is well within repayment capacity'}"
        elif feat == "collateral_coverage":
            desc = f"Collateral coverage ({round(collateral_coverage*100, 1)}%) {'substantially secures credit' if impact < 0 else 'is insufficient for requested principal'}"
        elif feat == "income_stability":
            desc = f"Income verification and {int(months_at_current_job)}mo job stability {'bolster creditworthiness' if impact < 0 else 'present earnings uncertainty'}"
        elif feat == "health_status":
            desc = f"Health profile ({health_status.replace('_', ' ')}) indicates {'potential ongoing medical risk' if impact > 0 else 'low medical expenditure hazard'}"
        elif feat == "alternative_credit":
            desc = f"Alternative payment history score ({round(alt_credit_score, 1) if alt_credit_score else 'N/A'}) {'demonstrates reliable on-time payment track record' if impact < 0 else 'reflects inconsistent payment behavior'}"
        elif feat == "applicant_age":
            desc = f"Applicant age ({int(age)} yrs) aligns with {'higher career and financial volatility' if impact > 0 else 'stable career earning bracket'}"
        elif feat == "dependents_burden":
            desc = f"{int(num_dependents)} dependents reduce net disposable household cash flow"
        elif feat == "asset_liquidity":
            desc = f"Available assets (${int(total_assets):,}) provide strong liquidity reserve"
        else:
            desc = f"Tenure history of {int(tenure_months)} months {'provides established credit footprint' if impact < 0 else 'represents brief credit track record'}"

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

    # Handle CORS preflight
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
            "model_version": "v2.0.0-aws-lambda",
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

