import { apiRequest } from "@/lib/api-client";

export interface PredictionRequest {
  input: string;
  model?: "model_a" | "model_b";
}

export interface PredictionResult {
  id: string;
  prediction: string;
  model: "model_a" | "model_b";
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

export interface ComparisonJob {
  job_id: string;
  status: "queued" | "running" | "completed" | "failed";
  result: ComparisonResult | null;
  dataset_name?: string | null;
  dataset_s3_key?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatasetUploadResponse {
  object_key: string;
  upload_url: string;
  bucket_name: string;
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
  model: "model_a" | "model_b";
  latency_ms: number;
  timestamp: string;
  status: "success" | "error";
  input_hash: string;
  cached: boolean;
}

const EMPTY_METRICS: SystemMetrics = {
  requests: 0,
  avg_latency: 0,
  model_a_usage: 0,
  model_b_usage: 0,
  cache_hits: 0,
  cache_misses: 0,
  success_rate: 0,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function predict(req: PredictionRequest): Promise<PredictionResult> {
  return apiRequest<PredictionResult>("/v1/predictions", {
    method: "POST",
    body: JSON.stringify({
      input: req.input,
      model_id: req.model,
      routing_mode: req.model ? "pinned" : "auto",
    }),
  });
}

export async function getMetrics(): Promise<SystemMetrics> {
  try {
    return await apiRequest<SystemMetrics>("/v1/system/metrics");
  } catch {
    return EMPTY_METRICS;
  }
}

export async function getLogs(): Promise<LogEntry[]> {
  try {
    return await apiRequest<LogEntry[]>("/v1/system/logs");
  } catch {
    return [];
  }
}

export async function compareModels(
  dataSize: number,
  features: number,
  format: string,
  datasetName?: string | null,
  datasetS3Key?: string | null,
  kaggleUrl?: string | null,
  onJobUpdate?: (job: ComparisonJob) => void,
): Promise<ComparisonResult> {
  const job = await apiRequest<ComparisonJob>("/v1/comparisons", {
    method: "POST",
    body: JSON.stringify({
      data_size: dataSize,
      features,
      format,
      dataset_name: datasetName || null,
      dataset_s3_key: datasetS3Key || null,
      kaggle_url: kaggleUrl || null,
    }),
  });
  onJobUpdate?.(job);

  let currentJob = job;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (currentJob.status === "completed" && currentJob.result) {
      return currentJob.result;
    }

    if (currentJob.status === "failed") {
      throw new Error(currentJob.error_message || "Model comparison job failed");
    }

    await sleep(1000);
    currentJob = await apiRequest<ComparisonJob>(`/v1/comparisons/${job.job_id}`);
    onJobUpdate?.(currentJob);
  }

  throw new Error("Timed out waiting for model comparison results");
}

export async function createDatasetUpload(file: File): Promise<DatasetUploadResponse> {
  return apiRequest<DatasetUploadResponse>("/v1/uploads/datasets", {
    method: "POST",
    body: JSON.stringify({
      file_name: file.name,
      content_type: file.type || "application/octet-stream",
    }),
  });
}

export async function uploadDatasetFile(file: File): Promise<{ objectKey: string; bucketName: string }> {
  const upload = await createDatasetUpload(file);
  const response = await fetch(upload.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Dataset upload failed with status ${response.status}`);
  }

  return {
    objectKey: upload.object_key,
    bucketName: upload.bucket_name,
  };
}
