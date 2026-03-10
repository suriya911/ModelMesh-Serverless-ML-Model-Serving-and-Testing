import type { PredictionResult } from "@/lib/ml-api";
import { Clock, Cpu, Zap, Database } from "lucide-react";

interface Props {
  results: PredictionResult[];
}

export default function ResultsPanel({ results }: Props) {
  if (results.length === 0) {
    return (
      <div className="bg-card border border-border rounded-md p-6 flex items-center justify-center min-h-[200px]">
        <p className="font-mono text-xs text-muted-foreground">
          No predictions yet. Run inference to see results.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider">
        Prediction Results
      </h3>
      {results.map((r, i) => (
        <div
          key={r.id}
          className="bg-card border border-border rounded-md p-4 animate-fade-in"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span
                className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                  r.model === 'model_a'
                    ? 'bg-model-a/15 text-model-a'
                    : 'bg-model-b/15 text-model-b'
                }`}
              >
                {r.model === 'model_a' ? 'MODEL A' : 'MODEL B'}
              </span>
              {r.cached && (
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-success/15 text-success flex items-center gap-1">
                  <Database size={10} />
                  CACHED
                </span>
              )}
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {r.id}
            </span>
          </div>

          <div className="font-mono text-lg font-bold text-foreground mb-3">
            {r.prediction}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-1.5">
              <Zap size={12} className="text-muted-foreground" />
              <div>
                <div className="font-mono text-[10px] text-muted-foreground">Confidence</div>
                <div className="font-mono text-xs font-semibold text-foreground">
                  {(r.confidence * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-warning" />
              <div>
                <div className="font-mono text-[10px] text-muted-foreground">Latency</div>
                <div className="font-mono text-xs font-semibold text-warning">
                  {r.latency_ms}ms
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Cpu size={12} className="text-muted-foreground" />
              <div>
                <div className="font-mono text-[10px] text-muted-foreground">Time</div>
                <div className="font-mono text-[10px] text-foreground">
                  {new Date(r.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
