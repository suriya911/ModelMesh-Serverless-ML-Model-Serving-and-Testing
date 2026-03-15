import { useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import DataUploadPanel from "@/components/dashboard/DataUploadPanel";
import ModelComparisonPanel from "@/components/dashboard/ModelComparisonPanel";
import PredictionPanel from "@/components/dashboard/PredictionPanel";
import ResultsPanel from "@/components/dashboard/ResultsPanel";
import ABVisualization from "@/components/dashboard/ABVisualization";
import MonitoringPanel from "@/components/dashboard/MonitoringPanel";
import MetricsPanel from "@/components/dashboard/MetricsPanel";
import { compareModels, uploadDatasetFile, type ComparisonJob, type ComparisonOptions, type ComparisonResult, type PredictionResult } from "@/lib/ml-api";

export default function Dashboard() {
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [activeTab, setActiveTab] = useState<'compare' | 'inference'>('compare');
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [comparisonJob, setComparisonJob] = useState<ComparisonJob | null>(null);

  const handleResult = useCallback((result: PredictionResult) => {
    setResults(prev => [result, ...prev].slice(0, 20));
    setRefreshKey(k => k + 1);
  }, []);

  const handleCompare = useCallback(async (
    options: ComparisonOptions,
    file?: File | null,
  ) => {
    setComparing(true);
    setComparisonError(null);
    setComparison(null);
    setComparisonJob(null);
    try {
      let datasetS3Key: string | undefined;
      if (file && !options.kaggleUrl) {
        const upload = await uploadDatasetFile(file);
        datasetS3Key = upload.objectKey;
      }

      const result = await compareModels(
        {
          ...options,
          datasetS3Key,
        },
        setComparisonJob,
      );
      setComparison(result);
    } catch (err) {
      setComparisonError(err instanceof Error ? err.message : "Comparison request failed");
    } finally {
      setComparing(false);
    }
  }, []);

  return (
    <AppLayout>
      <div className="mb-6 space-y-1 sm:mb-8">
        <h2 className="font-mono text-lg font-bold text-foreground sm:text-xl">Dashboard</h2>
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Upload data, compare models, and run inference.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 mb-6 bg-card border border-border rounded-md p-1 w-full sm:w-fit sm:inline-grid">
        {(['compare', 'inference'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-2 sm:px-4 py-2 rounded font-mono text-[11px] sm:text-xs font-semibold transition-colors text-center ${
              activeTab === tab
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'compare' ? 'Model Comparison' : 'Live Inference'}
          </button>
        ))}
      </div>

      {activeTab === 'compare' ? (
        <>
          <div className="mb-8 grid gap-5 xl:grid-cols-[minmax(360px,480px)_minmax(0,1fr)] xl:items-start">
            <div className="rounded-md border border-border bg-card p-4 sm:p-5">
              <DataUploadPanel onCompare={handleCompare} loading={comparing} />
            </div>

            <div className="rounded-md border border-border bg-card p-4 sm:p-5">
              {comparisonJob && !comparison && !comparisonError ? (
                <div className="flex min-h-[260px] items-center justify-center rounded-md border border-primary/30 bg-card p-6 sm:min-h-[320px] sm:p-8">
                  <div className="text-center space-y-3">
                    <div className="font-mono text-[10px] text-primary uppercase tracking-wider">
                      Comparison Job {comparisonJob.status}
                    </div>
                    <div className="font-mono text-xs text-foreground">
                      Job ID: {comparisonJob.job_id}
                    </div>
                    {comparisonJob.dataset_name ? (
                      <div className="font-mono text-xs text-muted-foreground">
                        Dataset: {comparisonJob.dataset_name}
                      </div>
                    ) : null}
                    <div className="font-mono text-xs text-muted-foreground">
                      {comparisonJob.status === "queued"
                        ? "Waiting for backend worker slot."
                        : "Running evaluation and aggregating metrics."}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      The selected train/test split and model types are applied server-side.
                    </div>
                  </div>
                </div>
              ) : null}

              {comparison ? (
                <ModelComparisonPanel comparison={comparison} />
              ) : comparisonError ? (
                <div className="flex min-h-[260px] items-center justify-center rounded-md border border-destructive/40 bg-card p-8 sm:min-h-[320px] sm:p-12">
                  <div className="text-center space-y-3">
                    <div className="font-mono text-xs text-destructive uppercase tracking-wider">Comparison Failed</div>
                    <p className="font-mono text-xs text-muted-foreground">{comparisonError}</p>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[260px] items-center justify-center rounded-md border border-border bg-card p-8 sm:min-h-[320px] sm:p-12">
                  <div className="text-center space-y-3">
                    <div className="font-mono text-3xl text-muted-foreground/30">A ⟷ B</div>
                    <p className="font-mono text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      Configure your dataset, choose any two supported models, and click
                      "Compare Models" to see side-by-side evaluation metrics.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Metrics bar */}
          <div className="mb-6">
            <MetricsPanel refreshKey={refreshKey} />
          </div>

          {/* Testing section */}
          <div id="testing" className="mb-8">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
              <div>
                <PredictionPanel onResult={handleResult} />
              </div>
              <div className="min-w-0">
                <ResultsPanel results={results} />
              </div>
            </div>
          </div>

          {/* A/B Visualization */}
          <div id="ab-testing" className="mb-8">
            <ABVisualization refreshKey={refreshKey} />
          </div>

          {/* Monitoring */}
          <div id="monitoring">
            <MonitoringPanel refreshKey={refreshKey} />
          </div>
        </>
      )}
    </AppLayout>
  );
}
