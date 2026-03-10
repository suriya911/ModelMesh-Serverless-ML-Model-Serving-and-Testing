// Simulated ML API layer with in-memory caching, A/B routing, and full model metrics

export interface PredictionRequest {
  input: string;
  model?: 'model_a' | 'model_b';
}

export interface PredictionResult {
  id: string;
  prediction: string;
  model: 'model_a' | 'model_b';
  confidence: number;
  latency_ms: number;
  timestamp: string;
  cached: boolean;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  auc_roc: number;
  auc_pr: number;
  log_loss: number;
  mse: number;
  mae: number;
  r_squared: number;
  specificity: number;
  sensitivity: number;
  confusion_matrix: { tp: number; fp: number; tn: number; fn: number };
  latency_avg_ms: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  latency_p99_ms: number;
  throughput_rps: number;
  total_predictions: number;
  error_rate: number;
}

export interface ComparisonResult {
  model_a: ModelMetrics;
  model_b: ModelMetrics;
  dataset_info: {
    total_samples: number;
    features: number;
    classes: string[];
    format: string;
    train_split: number;
    test_split: number;
  };
  timestamp: string;
}

export interface SystemMetrics {
  requests: number;
  avg_latency: number;
  model_a_usage: number;
  model_b_usage: number;
  cache_hits: number;
  cache_misses: number;
  success_rate: number;
}

export interface LogEntry {
  id: string;
  prediction_id: string;
  model: 'model_a' | 'model_b';
  latency_ms: number;
  timestamp: string;
  status: 'success' | 'error';
  input_hash: string;
  cached: boolean;
}

// Simple hash function
function hashInput(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Simulated model outputs
const MODEL_A_CLASSES = ['positive', 'negative', 'neutral'];
const MODEL_B_CLASSES = ['bullish', 'bearish', 'stable', 'volatile'];

function simulateModelA(input: string): { prediction: string; confidence: number; latency: number } {
  const seed = hashInput(input);
  const idx = parseInt(seed.charAt(0), 16) % MODEL_A_CLASSES.length;
  const confidence = 0.72 + (parseInt(seed.charAt(1), 16) / 16) * 0.27;
  const latency = 80 + Math.random() * 120;
  return { prediction: MODEL_A_CLASSES[idx], confidence: Math.min(confidence, 0.99), latency: Math.round(latency) };
}

function simulateModelB(input: string): { prediction: string; confidence: number; latency: number } {
  const seed = hashInput(input);
  const idx = parseInt(seed.charAt(2), 16) % MODEL_B_CLASSES.length;
  const confidence = 0.65 + (parseInt(seed.charAt(3), 16) / 16) * 0.33;
  const latency = 100 + Math.random() * 180;
  return { prediction: MODEL_B_CLASSES[idx], confidence: Math.min(confidence, 0.98), latency: Math.round(latency) };
}

// In-memory state
const cache = new Map<string, PredictionResult>();
const logs: LogEntry[] = [];
let metrics: SystemMetrics = {
  requests: 0,
  avg_latency: 0,
  model_a_usage: 0,
  model_b_usage: 0,
  cache_hits: 0,
  cache_misses: 0,
  success_rate: 100,
};

let totalLatency = 0;

export async function predict(req: PredictionRequest): Promise<PredictionResult> {
  const inputHash = hashInput(req.input);
  const cacheKey = req.model ? `${inputHash}_${req.model}` : inputHash;

  // Check cache
  if (cache.has(cacheKey)) {
    const cached = { ...cache.get(cacheKey)!, id: generateId(), timestamp: new Date().toISOString(), cached: true };
    cached.latency_ms = 2 + Math.round(Math.random() * 5);
    metrics.cache_hits++;
    metrics.requests++;
    logEntry(cached, inputHash);
    return new Promise(resolve => setTimeout(() => resolve(cached), cached.latency_ms));
  }

  // A/B routing
  const model: 'model_a' | 'model_b' = req.model || (Math.random() < 0.5 ? 'model_a' : 'model_b');
  const sim = model === 'model_a' ? simulateModelA(req.input) : simulateModelB(req.input);

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

  const result: PredictionResult = {
    id: generateId(),
    prediction: sim.prediction,
    model,
    confidence: parseFloat(sim.confidence.toFixed(4)),
    latency_ms: sim.latency,
    timestamp: new Date().toISOString(),
    cached: false,
  };

  // Update cache
  cache.set(cacheKey, result);
  metrics.cache_misses++;
  metrics.requests++;
  if (model === 'model_a') metrics.model_a_usage++;
  else metrics.model_b_usage++;
  totalLatency += sim.latency;
  metrics.avg_latency = Math.round(totalLatency / (metrics.model_a_usage + metrics.model_b_usage));
  metrics.success_rate = parseFloat((100 - Math.random() * 2).toFixed(1));

  logEntry(result, inputHash);
  return result;
}

function logEntry(result: PredictionResult, inputHash: string) {
  logs.unshift({
    id: generateId(),
    prediction_id: result.id,
    model: result.model,
    latency_ms: result.latency_ms,
    timestamp: result.timestamp,
    status: 'success',
    input_hash: inputHash,
    cached: result.cached,
  });
  if (logs.length > 100) logs.pop();
}

export function getMetrics(): SystemMetrics {
  return { ...metrics };
}

export function getLogs(): LogEntry[] {
  return [...logs];
}

export function resetState() {
  cache.clear();
  logs.length = 0;
  metrics = { requests: 0, avg_latency: 0, model_a_usage: 0, model_b_usage: 0, cache_hits: 0, cache_misses: 0, success_rate: 100 };
  totalLatency = 0;
}

// Simulate full model comparison with comprehensive ML metrics
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export async function compareModels(dataSize: number, features: number, format: string): Promise<ComparisonResult> {
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

  const seed = dataSize * 7 + features * 13;

  // Model A: Logistic Regression — higher precision, lower recall, faster
  const aTP = Math.round(dataSize * 0.3 * (0.85 + seededRandom(seed + 1) * 0.1));
  const aFP = Math.round(dataSize * 0.3 * (0.05 + seededRandom(seed + 2) * 0.08));
  const aFN = Math.round(dataSize * 0.3 * (0.08 + seededRandom(seed + 3) * 0.07));
  const aTN = Math.round(dataSize * 0.3) - aFP;

  const aPrecision = aTP / (aTP + aFP);
  const aRecall = aTP / (aTP + aFN);
  const aF1 = 2 * (aPrecision * aRecall) / (aPrecision + aRecall);
  const aAccuracy = (aTP + aTN) / (aTP + aFP + aFN + aTN);
  const aSpecificity = aTN / (aTN + aFP);

  // Model B: Random Forest — higher recall, slightly lower precision, slower
  const bTP = Math.round(dataSize * 0.3 * (0.88 + seededRandom(seed + 5) * 0.08));
  const bFP = Math.round(dataSize * 0.3 * (0.07 + seededRandom(seed + 6) * 0.1));
  const bFN = Math.round(dataSize * 0.3 * (0.04 + seededRandom(seed + 7) * 0.06));
  const bTN = Math.round(dataSize * 0.3) - bFP;

  const bPrecision = bTP / (bTP + bFP);
  const bRecall = bTP / (bTP + bFN);
  const bF1 = 2 * (bPrecision * bRecall) / (bPrecision + bRecall);
  const bAccuracy = (bTP + bTN) / (bTP + bFP + bFN + bTN);
  const bSpecificity = bTN / (bTN + bFP);

  const classes = features <= 5
    ? ['positive', 'negative']
    : ['positive', 'negative', 'neutral'];

  return {
    model_a: {
      accuracy: parseFloat(aAccuracy.toFixed(4)),
      precision: parseFloat(aPrecision.toFixed(4)),
      recall: parseFloat(aRecall.toFixed(4)),
      f1_score: parseFloat(aF1.toFixed(4)),
      auc_roc: parseFloat((0.88 + seededRandom(seed + 10) * 0.08).toFixed(4)),
      auc_pr: parseFloat((0.84 + seededRandom(seed + 11) * 0.1).toFixed(4)),
      log_loss: parseFloat((0.28 + seededRandom(seed + 12) * 0.15).toFixed(4)),
      mse: parseFloat((0.08 + seededRandom(seed + 13) * 0.06).toFixed(4)),
      mae: parseFloat((0.05 + seededRandom(seed + 14) * 0.04).toFixed(4)),
      r_squared: parseFloat((0.82 + seededRandom(seed + 15) * 0.1).toFixed(4)),
      specificity: parseFloat(aSpecificity.toFixed(4)),
      sensitivity: parseFloat(aRecall.toFixed(4)),
      confusion_matrix: { tp: aTP, fp: aFP, tn: aTN, fn: aFN },
      latency_avg_ms: Math.round(85 + seededRandom(seed + 20) * 40),
      latency_p50_ms: Math.round(70 + seededRandom(seed + 21) * 30),
      latency_p95_ms: Math.round(150 + seededRandom(seed + 22) * 60),
      latency_p99_ms: Math.round(220 + seededRandom(seed + 23) * 80),
      throughput_rps: Math.round(120 + seededRandom(seed + 24) * 80),
      total_predictions: dataSize,
      error_rate: parseFloat((0.5 + seededRandom(seed + 25) * 1.5).toFixed(2)),
    },
    model_b: {
      accuracy: parseFloat(bAccuracy.toFixed(4)),
      precision: parseFloat(bPrecision.toFixed(4)),
      recall: parseFloat(bRecall.toFixed(4)),
      f1_score: parseFloat(bF1.toFixed(4)),
      auc_roc: parseFloat((0.91 + seededRandom(seed + 30) * 0.06).toFixed(4)),
      auc_pr: parseFloat((0.87 + seededRandom(seed + 31) * 0.08).toFixed(4)),
      log_loss: parseFloat((0.22 + seededRandom(seed + 32) * 0.12).toFixed(4)),
      mse: parseFloat((0.06 + seededRandom(seed + 33) * 0.05).toFixed(4)),
      mae: parseFloat((0.04 + seededRandom(seed + 34) * 0.03).toFixed(4)),
      r_squared: parseFloat((0.85 + seededRandom(seed + 35) * 0.08).toFixed(4)),
      specificity: parseFloat(bSpecificity.toFixed(4)),
      sensitivity: parseFloat(bRecall.toFixed(4)),
      confusion_matrix: { tp: bTP, fp: bFP, tn: bTN, fn: bFN },
      latency_avg_ms: Math.round(110 + seededRandom(seed + 40) * 60),
      latency_p50_ms: Math.round(90 + seededRandom(seed + 41) * 40),
      latency_p95_ms: Math.round(200 + seededRandom(seed + 42) * 80),
      latency_p99_ms: Math.round(300 + seededRandom(seed + 43) * 100),
      throughput_rps: Math.round(80 + seededRandom(seed + 44) * 60),
      total_predictions: dataSize,
      error_rate: parseFloat((0.8 + seededRandom(seed + 45) * 2.0).toFixed(2)),
    },
    dataset_info: {
      total_samples: dataSize,
      features,
      classes,
      format,
      train_split: 0.8,
      test_split: 0.2,
    },
    timestamp: new Date().toISOString(),
  };
}
