import { SFNClient, StartExecutionCommand, DescribeExecutionCommand } from '@aws-sdk/client-sfn'

let sfnClient: SFNClient | null = null

function getClient(): SFNClient {
  if (!sfnClient) {
    sfnClient = new SFNClient({
      region: process.env.AWS_REGION || 'ap-southeast-2',
    })
  }
  return sfnClient
}

export interface CreditDecisioningPayload {
  borrower_id: string
  features: Record<string, any>
}

export interface StepFunctionExecutionResult {
  success: boolean
  executionArn?: string
  startDate?: Date
  status?: string
  error?: string
}

/**
 * Triggers the AWS Step Functions Straight-Through Processing (STP) State Machine
 */
export async function startCreditDecisioningWorkflow(
  payload: CreditDecisioningPayload
): Promise<StepFunctionExecutionResult> {
  const stateMachineArn =
    process.env.AWS_STEP_FUNCTIONS_DECISIONING_ARN ||
    'arn:aws:states:ap-southeast-2:022671037337:stateMachine:Aegis-Risk-Credit-Decisioning'

  try {
    const client = getClient()
    const executionName = `exec-${payload.borrower_id.slice(0, 8)}-${Date.now()}`
    
    const command = new StartExecutionCommand({
      stateMachineArn,
      name: executionName,
      input: JSON.stringify(payload),
    })

    const response = await client.send(command)

    return {
      success: true,
      executionArn: response.executionArn,
      startDate: response.startDate,
      status: 'RUNNING',
    }
  } catch (err: any) {
    console.warn('[AWS Step Functions Warning] Execution failed or fallback active:', err)
    return {
      success: false,
      error: err?.message || 'Failed to trigger Step Functions execution',
    }
  }
}

/**
 * Checks execution status of a running Step Functions workflow
 */
export async function getWorkflowExecutionStatus(executionArn: string) {
  try {
    const client = getClient()
    const command = new DescribeExecutionCommand({ executionArn })
    const response = await client.send(command)
    return {
      status: response.status,
      output: response.output ? JSON.parse(response.output) : null,
      error: response.error,
    }
  } catch (err: any) {
    console.warn('[AWS Step Functions Query Error]:', err)
    return { status: 'UNKNOWN', error: err?.message }
  }
}
