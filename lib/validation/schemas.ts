import { z } from 'zod'

/**
 * Strict validation schema for borrower profile underwriting inputs
 */
export const borrowerInputSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  age: z.number().int().min(18).max(100).optional(),
  loan_amount: z.number().positive().max(5000000),
  monthly_income: z.number().nonnegative(),
  tenure_months: z.number().int().positive().max(360).default(36),
  outstanding_balance: z.number().nonnegative().optional().default(0),
  credit_score: z.number().int().min(300).max(850).optional(),
  alternative_credit_score: z.number().int().min(300).max(850).optional(),
  months_employed: z.number().int().nonnegative().max(600).default(24),
  num_credit_lines: z.number().int().nonnegative().max(50).default(3),
  interest_rate: z.number().positive().max(50).default(10.5),
  dti_ratio: z.number().min(0).max(5).optional(),
  loan_type: z.enum(['Auto', 'Business', 'Education', 'Home', 'Other', 'Standard']).optional(),
  education: z.enum(["Bachelor's", 'High School', "Master's", 'PhD']).default("Bachelor's"),
  employment_status: z.enum(['Full-time', 'Part-time', 'Self-employed', 'Unemployed']).default('Full-time'),
  marital_status: z.enum(['Single', 'Married', 'Divorced']).default('Single'),
  has_mortgage: z.boolean().default(false),
  has_dependents: z.boolean().default(false),
  num_dependents: z.number().int().nonnegative().max(20).default(0),
  has_cosigner: z.boolean().default(false),
  collateral_value: z.number().nonnegative().default(0),
  total_existing_debt: z.number().nonnegative().default(0),
  num_inquiries_6m: z.number().int().nonnegative().max(50).default(1),
  credit_utilization: z.number().min(0).max(5).default(0.38),
  delinquency_count_12m: z.number().int().nonnegative().max(50).default(0),
  prior_defaults: z.number().int().nonnegative().max(50).default(0),
})

/**
 * Schema for What-If scenario rescore simulation overrides
 */
export const rescoreRequestSchema = z.object({
  method: z.string().optional().default('rescore'),
  overrides: z
    .object({
      loan_amount: z.number().positive().max(5000000).optional(),
      monthly_income: z.number().nonnegative().optional(),
      annual_income: z.number().nonnegative().optional(),
      income: z.number().nonnegative().optional(),
      tenure_months: z.number().int().positive().max(360).optional(),
      credit_score: z.number().int().min(300).max(850).optional(),
      alternative_credit_score: z.number().int().min(300).max(850).optional(),
      months_employed: z.number().int().nonnegative().max(600).optional(),
      num_credit_lines: z.number().int().nonnegative().max(50).optional(),
      interest_rate: z.number().positive().max(50).optional(),
      dti_ratio: z.number().min(0).max(5).optional(),
      outstanding_balance: z.number().nonnegative().optional(),
      education: z.string().optional(),
      employment_status: z.string().optional(),
      marital_status: z.string().optional(),
      has_mortgage: z.boolean().optional(),
      has_dependents: z.boolean().optional(),
      has_cosigner: z.boolean().optional(),
      collateral_value: z.number().nonnegative().optional(),
      total_existing_debt: z.number().nonnegative().optional(),
      num_inquiries_6m: z.number().int().nonnegative().max(50).optional(),
      credit_utilization: z.number().min(0).max(5).optional(),
      delinquency_count_12m: z.number().int().nonnegative().max(50).optional(),
      prior_defaults: z.number().int().nonnegative().max(50).optional(),
    })
    .optional()
    .default({}),
})

export type BorrowerInput = z.infer<typeof borrowerInputSchema>
export type RescoreRequest = z.infer<typeof rescoreRequestSchema>
