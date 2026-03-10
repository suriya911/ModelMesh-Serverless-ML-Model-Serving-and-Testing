import { useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import DataUploadPanel from "@/components/dashboard/DataUploadPanel";
import ModelComparisonPanel from "@/components/dashboard/ModelComparisonPanel";
import PredictionPanel from "@/components/dashboard/PredictionPanel";
import ResultsPanel from "@/components/dashboard/ResultsPanel";
import ABVisualization from "@/components/dashboard/ABVisualization";
import MonitoringPanel from "@/components/dashboard/MonitoringPanel";
import MetricsPanel from "@/components/dashboard/MetricsPanel";
import { compareModels, type ComparisonResult, type PredictionResult } from "@/lib/ml-api";

export default function Dashboard() {
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [activeTab, setActiveTab] = useState<'compare' | 'inference'>('compare');

  const handleResult = useCallback((result: PredictionResult) => {
    setResults(prev => [result, ...prev].slice(0, 20));
    setRefreshKey(k => k + 1);
  }, []);

  const handleCompare = useCallback(async (dataSize: number, features: number, format: string) => {
    setComparing(true);
    try {
      const result = await compareModels(dataSize, features, format);
      setComparison(result);
    } finally {
      setComparing(false);
    }
  }, []);

  return (
    <AppLayout>
      <div className="space-y-1 mb-6">
        <h2 className="font-mono text-lg font-bold text-foreground">Dashboard</h2>
        <p className="text-xs text-muted-foreground">
          Upload data, compare models, and run inference.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-card border border-border rounded-md p-1 w-fit">
        {(['compare', 'inference'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded font-mono text-xs font-semibold transition-colors ${
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
          {/* Upload + Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
            <div className="lg:col-span-4">
              <DataUploadPanel onCompare={handleCompare} loading={comparing} />
            </div>
            <div className="lg:col-span-8">
              {comparison ? (
                <ModelComparisonPanel comparison={comparison} />
              ) : (
                <div className="bg-card border border-border rounded-md p-12 flex items-center justify-center min-h-[400px]">
                  <div className="text-center space-y-3">
                    <div className="font-mono text-3xl text-muted-foreground/30">A ⟷ B</div>
                    <p className="font-mono text-xs text-muted-foreground">
                      Configure your dataset and click "Compare Models" to see<br />
                      side-by-side metrics for Model A (Logistic Regression)<br />
                      vs Model B (Random Forest).
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
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2">
                <PredictionPanel onResult={handleResult} />
              </div>
              <div className="lg:col-span-3">
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
