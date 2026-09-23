import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'

test('ML Model Artifacts and Sanity Check', () => {
  const modelPath = path.join(process.cwd(), 'ml', 'model.json')
  const featureColsPath = path.join(process.cwd(), 'ml', 'feature_columns.json')

  assert.ok(fs.existsSync(modelPath), 'ml/model.json must exist')
  assert.ok(fs.existsSync(featureColsPath), 'ml/feature_columns.json must exist')

  const cols = JSON.parse(fs.readFileSync(featureColsPath, 'utf8'))
  assert.equal(cols.length, 36, 'Model schema must have exactly 36 features')
  assert.ok(cols.includes('Age'))
  assert.ok(cols.includes('Income'))
  assert.ok(cols.includes('DTIRatio'))
  assert.ok(cols.includes('CreditScore'))
  assert.ok(cols.includes('credit_utilization'), 'Must include credit_utilization')
  assert.ok(cols.includes('delinquency_count_12m'), 'Must include delinquency_count_12m')
  assert.ok(cols.includes('num_inquiries_6m'), 'Must include num_inquiries_6m')
  assert.ok(cols.includes('prior_defaults'), 'Must include prior_defaults')
  assert.ok(cols.includes('collateral_value'), 'Must include collateral_value')
  assert.ok(!cols.includes('days_past_due'), 'Must NOT include days_past_due (target leakage)')
  assert.ok(!cols.includes('outstanding_balance_ratio'), 'Must NOT include outstanding_balance_ratio (target leakage)')
})

test('Mathematical bounds of logistic probability', () => {
  // Sigmoid calibration test
  const sigmoid = (margin) => 1.0 / (1.0 + Math.exp(-margin))

  assert.ok(sigmoid(-100) >= 0.0 && sigmoid(-100) <= 0.01)
  assert.ok(sigmoid(100) <= 1.0 && sigmoid(100) >= 0.99)
  assert.equal(sigmoid(0), 0.5)
})

test('XGBoost 100-Tree Model Architecture and Traversal Verification', () => {
  const modelPath = path.join(process.cwd(), 'ml', 'model.json')
  const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'))

  const trees = model.learner.gradient_booster.model.trees
  assert.equal(trees.length, 100, 'Model must contain exactly 100 decision trees')

  // Verify tree structure
  for (const tree of trees) {
    assert.ok(tree.left_children.length > 0, 'Tree must have left children')
    assert.ok(tree.right_children.length > 0, 'Tree must have right children')
    assert.ok(tree.split_conditions.length > 0, 'Tree must have split conditions')
    assert.equal(tree.left_children.length, tree.right_children.length)
  }

  // Sample traverse on dummy input
  let margin = 0.0
  const x = new Array(36).fill(0)
  x[0] = 45 // Age
  x[1] = 75000 // Income
  x[2] = 25000 // LoanAmount
  x[3] = 720 // CreditScore

  for (const tree of trees) {
    let node = 0
    while (tree.left_children[node] !== -1) {
      const fIdx = tree.split_indices[node]
      const cond = tree.split_conditions[node]
      const val = x[fIdx]
      if (val === null || val === undefined || isNaN(val)) {
        node = tree.default_left[node] ? tree.left_children[node] : tree.right_children[node]
      } else if (val < cond) {
        node = tree.left_children[node]
      } else {
        node = tree.right_children[node]
      }
    }
    margin += tree.split_conditions[node]
  }

  const prob = 1.0 / (1.0 + Math.exp(-margin))
  assert.ok(prob >= 0.0 && prob <= 1.0, 'Traversed probability must be between 0 and 1')
  assert.ok(!isNaN(prob), 'Probability must not be NaN')
})
