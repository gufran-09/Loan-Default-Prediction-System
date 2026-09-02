# API Contract & Schema Reference

All endpoints require an authenticated Supabase session (HTTP cookie or bearer token).  
Error responses conform to the standard shape:
```json
{
  "error": {
    "code": "UNAUTHORIZED | NOT_FOUND | BAD_REQUEST | DB_ERROR",
    "message": "Human-readable description"
  }
}
```

---

## 1. Endpoints

### 1.1 `GET /api/borrowers`
Query parameters:
- `page` (number, default: `1`): 1-indexed page.
- `pageSize` (number, default: `10`, max: `100`): Items per page.
- `search` (string, optional): Case-insensitive search across `full_name` and `external_id`.
- `bucket` (string, optional): Filter by risk bucket (`low`, `medium`, `high`, `critical`).

**Response (`200 OK`):**
```json
{
  "data": [
    {
      "id": "uuid",
      "external_id": "LN-000101",
      "full_name": "Allison Hill",
      "email": "allison.hill@example.com",
      "loan_type": "Home",
      "loan_amount": 92393,
      "outstanding_balance": 73914.4,
      "geography": "Asia",
      "tenure_months": 36,
      "monthly_income": 9388.0,
      "employment_status": "Self-Employed",
      "risk_scores": [
        {
          "id": "uuid",
          "score": 0.2318,
          "bucket": "low",
          "model_version": "v1.0",
          "scored_at": "2026-08-01T12:00:00Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 400,
    "totalPages": 40
  }
}
```

---

### 1.2 `GET /api/borrowers/:id/score`
Fetches the full risk assessment for a specific borrower through the scoring seam (`lib/scoring/getScore.ts`).

**Response (`200 OK`):**
```json
{
  "data": {
    "score": 0.7245,
    "bucket": "high",
    "model_version": "v1.0",
    "scored_at": "2026-08-01T12:00:00Z",
    "risk_reasons": [
      {
        "reason": "Interest rate is high relative to debt service capacity",
        "feature": "InterestRate",
        "impact": 0.534,
        "rank": 1
      },
      {
        "reason": "Short employment tenure contributes to income volatility",
        "feature": "MonthsEmployed",
        "impact": -0.491,
        "rank": 2
      }
    ],
    "borrower": {
      "id": "uuid",
      "external_id": "LN-000102",
      "full_name": "Jane Smith",
      "email": "jane.smith@example.com",
      "loan_type": "Business",
      "loan_amount": 120000,
      "outstanding_balance": 45000,
      "geography": "Europe",
      "tenure_months": 60,
      "monthly_income": 15000,
      "employment_status": "Self-Employed"
    }
  }
}
```

---

### 1.3 `GET /api/alerts`
Query parameters:
- `status` (string, optional): `open`, `acknowledged`, `resolved`
- `severity` (string, optional): `critical`, `high`, `medium`, `low`

**Response (`200 OK`):**
```json
{
  "data": [
    {
      "id": "uuid",
      "borrower_id": "uuid",
      "title": "Critical Default Risk Detected",
      "description": "Borrower Alice Johnson (LN-000003) scored 0.88 in CRITICAL risk bucket.",
      "severity": "critical",
      "status": "open",
      "created_at": "2026-08-01T12:30:00Z",
      "borrowers": {
        "id": "uuid",
        "external_id": "LN-000003",
        "full_name": "Alice Johnson",
        "email": "alice.j@example.com",
        "loan_amount": 30000,
        "outstanding_balance": 5000
      }
    }
  ]
}
```

---

### 1.4 `PATCH /api/alerts/:id`
Updates the triage lifecycle status of an alert.

**Request Body (`application/json`):**
```json
{
  "status": "acknowledged" // or "resolved" or "open"
}
```

**Response (`200 OK`):**
```json
{
  "data": {
    "id": "uuid",
    "status": "acknowledged"
  },
  "message": "Alert status updated to acknowledged"
}
```

---

### 1.5 `GET /api/analytics/portfolio`
Aggregates book-level distribution and top-line portfolio KPIs.

**Response (`200 OK`):**
```json
{
  "data": {
    "summary": {
      "totalBorrowers": 400,
      "totalLoanVolume": 38400000,
      "totalOutstandingBalance": 29800000,
      "averageScore": 0.2842,
      "criticalAlerts": 18,
      "highRiskBorrowers": 42
    },
    "byLoanType": [
      { "name": "Auto", "total": 85, "score": 0.26 },
      { "name": "Business", "total": 110, "score": 0.34 }
    ],
    "byGeography": [
      { "name": "North America", "total": 120, "score": 0.24 },
      { "name": "Europe", "total": 95, "score": 0.29 }
    ],
    "byTenure": [
      { "name": "12", "total": 70, "score": 0.21 },
      { "name": "36", "total": 150, "score": 0.31 }
    ]
  }
}
```

---

## 2. Architecture & Scoring Seam Note

The scoring seam is encapsulated in [`lib/scoring/getScore.ts`](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/lib/scoring/getScore.ts). In production, live machine learning predictions (via AWS SageMaker or custom Python microservice) replace the internal Supabase lookup query within that function alone, preserving zero frontend breaking changes.
