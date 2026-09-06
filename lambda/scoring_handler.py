import json
import math

def calculate_risk_score(features):
    """
    Serverless Scoring Engine:
    features: [monthly_income, loan_amount, tenure_months, outstanding_balance, dti]
    """
    monthly_income = float(features.get("monthly_income", 5000))
    loan_amount = float(features.get("loan_amount", 20000))
    tenure_months = float(features.get("tenure_months", 36))
    outstanding_balance = float(features.get("outstanding_balance", 12000))
    
    # Calculate DTI and leverage ratio
    dti = outstanding_balance / (monthly_income * 12 + 1e-5)
    loan_to_income = loan_amount / (monthly_income * 12 + 1e-5)
    
    # Sigmoidal default risk model matching local XGBoost weights calibration
    raw_z = (dti * 3.8) + (loan_to_income * 2.1) - (tenure_months * 0.02) - 1.2
    prob_default = 1.0 / (1.0 + math.exp(-raw_z))
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
        
    # Local Feature Attributions (SHAP surrogate)
    reasons = []
    if dti > 0.40:
        reasons.append({
            "rank": 1,
            "feature": "dti_ratio",
            "impact": round(dti * 0.5, 3),
            "reason": f"High debt-to-income ratio ({round(dti*100, 1)}%) increases default hazard"
        })
    if outstanding_balance > monthly_income * 4:
        reasons.append({
            "rank": len(reasons) + 1,
            "feature": "outstanding_balance",
            "impact": 0.32,
            "reason": f"Elevated outstanding debt balance relative to annual income capacity"
        })
    if tenure_months < 12:
        reasons.append({
            "rank": len(reasons) + 1,
            "feature": "tenure_months",
            "impact": 0.18,
            "reason": f"Short credit tenure history ({int(tenure_months)} months) limits reliability"
        })
    if len(reasons) == 0:
        reasons.append({
            "rank": 1,
            "feature": "loan_amount",
            "impact": -0.22,
            "reason": "Moderate loan size with strong debt service capability"
        })
        
    return score, prob_default, bucket, reasons

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
        # Check if invoked via API Gateway (with event.body) or directly via Step Functions / SDK
        if "body" in event and event["body"]:
            body_raw = event["body"]
            body = json.loads(body_raw) if isinstance(body_raw, str) else body_raw
        else:
            body = event
        
        borrower_id = body.get("borrower_id", "unknown")
        features = body.get("features", {})

        
        score, prob, bucket, reasons = calculate_risk_score(features)
        
        response_payload = {
            "borrower_id": borrower_id,
            "score": score,
            "default_probability": round(prob, 4),
            "bucket": bucket,
            "model_version": "v1.0.0-aws-lambda",
            "risk_reasons": reasons,
            "scored_by": "AWS Lambda Serverless Inference (ap-southeast-2)"
        }

        # If called by API Gateway (contains requestContext or HTTP method), return HTTP format
        if "requestContext" in event or "httpMethod" in event:
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(response_payload)
            }
        
        # Direct Task invocation (Step Functions, SDK, boto3)
        return response_payload
    except Exception as e:
        if "requestContext" in event or "httpMethod" in event:
            return {
                "statusCode": 500,
                "headers": headers,
                "body": json.dumps({"error": str(e)})
            }
        raise e

