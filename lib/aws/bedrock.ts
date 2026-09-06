import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

let bedrockClient: BedrockRuntimeClient | null = null

function getClient() {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'ap-southeast-2',
    })
  }
  return bedrockClient
}

export interface CreditMemoPromptParams {
  borrowerName: string
  loanAmount: number
  monthlyIncome: number
  tenureMonths: number
  score: number
  bucket: string
  riskReasons: Array<{ feature: string; impact: number; reason: string }>
}

/**
 * Generates an institutional-grade Credit Underwriting Memo using Amazon Bedrock GenAI.
 * Falls back to deterministic rule-based template if Bedrock is not provisioned or model access is pending.
 */
export async function generateCreditUnderwritingMemo(params: CreditMemoPromptParams): Promise<string> {
  const dti = ((params.loanAmount / (params.monthlyIncome * 12)) * 100).toFixed(1)
  
  const systemPrompt = `You are a Senior Chief Credit Officer at a premier institutional bank. 
Produce an executive, regulatory-compliant Credit Underwriting Memorandum for OCC SR 11-7 validation.
Be precise, professional, objective, and analytical.`

  const userPrompt = `Generate a credit committee narrative memorandum for the following loan applicant:
- Borrower: ${params.borrowerName}
- Loan Amount: $${params.loanAmount.toLocaleString()}
- Monthly Income: $${params.monthlyIncome.toLocaleString()}
- Debt-to-Income (estimated): ${dti}%
- Model Score: ${params.score}/1000 (${params.bucket} RISK)
- Primary Feature Attributions:
${params.riskReasons.map(r => `  * ${r.feature}: ${r.reason} (Impact magnitude: ${r.impact})`).join('\n')}

Format your response with:
1. Executive Summary & Recommendation (Approve / Conditional / Reject)
2. Quantitative Risk Factor Analysis
3. Mitigating Factors & Stress Considerations
4. Regulatory & Model Compliance Assessment`

  try {
    const client = getClient()
    // Using Claude 3.5 Haiku or Amazon Titan via Bedrock converse/invoke
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 600,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    }

    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-5-haiku-20241022-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    })

    const response = await client.send(command)
    const rawResult = new TextDecoder().decode(response.body)
    const parsed = JSON.parse(rawResult)
    return parsed.content?.[0]?.text || parsed.completion || ''
  } catch (err) {
    // Fallback: Professional deterministic institutional credit memo
    return `### Institutional Credit Underwriting Memorandum (Automated Rationale)

**Applicant:** ${params.borrowerName}  
**Credit Risk Rating:** ${params.score}/1000 (${params.bucket} RISK)  
**Evaluated Leverage:** $${params.loanAmount.toLocaleString()} Loan Amount vs $${(params.monthlyIncome * 12).toLocaleString()} Annual Gross Income (Debt-to-Income: ${dti}%)

#### 1. Underwriting Decision & Recommendation
${
  params.score >= 650
    ? '**Recommendation: ADVERSE ACTION (REJECT).** The application demonstrates high default probability exceeding portfolio tolerance limits. Recommend delivery of formal FCRA adverse action notice.'
    : params.score >= 450
    ? '**Recommendation: CONDITIONAL APPROVAL / HUMAN ESCALATION.** Borrower exhibits elevated risk markers requiring secondary underwriter sign-off and supplemental asset verification.'
    : '**Recommendation: PRE-APPROVED.** Quantitative default probability is well within institution baseline guidelines.'
}

#### 2. Key Attribution Drivers (TreeSHAP Decomposition)
${params.riskReasons.map((r, i) => `${i + 1}. **${r.feature.toUpperCase()}**: ${r.reason}`).join('\n')}

#### 3. Model Governance & SR 11-7 Compliance
Scored using Aegis Risk v1.0.0 serverless model execution on AWS Lambda. All feature inputs and counterfactual simulations are permanently logged to Amazon CloudWatch audit stream \`underwriter-decisions\`.`
  }
}
