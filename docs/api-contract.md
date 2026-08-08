# API contract

All endpoints require a Supabase session. Errors use `{ "error": { "code": string, "message": string } }`.

- `GET /api/borrowers?page=1&pageSize=10&search=&bucket=` returns `{ data: Borrower[], pagination: { page, pageSize, total, totalPages } }`.
- `GET /api/borrowers/:id/score` returns `{ data: { score, bucket, model_version, scored_at, risk_reasons[] } }`.
- `GET /api/alerts` returns `{ data: Alert[] }`.
- `GET /api/analytics/portfolio` returns `{ data: { byLoanType[], byGeography[], byTenure[] } }`.

The scoring swap-point is the `risk_scores` read in `/app/api/borrowers/[id]/score/route.ts`; replace that server data adapter with the production model contract without changing UI consumers.
