import type { ComparisonResult, ModelMetrics } from "@/lib/ml-api";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  comparison: ComparisonResult;
}

const CYAN = "hsl(187, 80%, 53%)";
const AMBER = "hsl(45, 93%, 54%)";

function MetricRow({ label, a, b, format = "pct", higher = "better" }: {
  label: string; a: number; b: number; format?: "pct" | "num" | "ms"; higher?: "better" | "worse";
}) {
  const fmt = (v: number) => {
    if (format === "pct") return `${(v * 100).toFixed(2)}%`;
    if (format === "ms") return `${v}ms`;
    return v.toFixed(4);
  };

  const diff = a - b;
  const aWins = higher === "better" ? diff > 0.001 : diff < -0.001;
  const bWins = higher === "better" ? diff < -0.001 : diff > 0.001;

  return (
    <div className="grid grid-cols-[1fr_100px_100px] items-center py-2 border-b border-border/40 last:border-0">
      <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
      <span className={`font-mono text-xs text-right font-semibold ${aWins ? 'text-model-a' : 'text-foreground'}`}>
        {fmt(a)} {aWins && <TrendingUp size={10} className="inline ml-1" />}
      </span>
      <span className={`font-mono text-xs text-right font-semibold ${bWins ? 'text-model-b' : 'text-foreground'}`}>
        {fmt(b)} {bWins && <TrendingUp size={10} className="inline ml-1" />}
      </span>
    </div>
  );
}

function ConfusionMatrix({ matrix, color }: { matrix: ModelMetrics['confusion_matrix']; color: string }) {
  return (
    <div className="grid grid-cols-2 gap-1 text-center">
      <div className="bg-success/15 rounded-sm p-2">
        <div className="font-mono text-[9px] text-muted-foreground">TP</div>
        <div className="font-mono text-sm font-bold text-success">{matrix.tp}</div>
      </div>
      <div className="bg-destructive/15 rounded-sm p-2">
        <div className="font-mono text-[9px] text-muted-foreground">FP</div>
        <div className="font-mono text-sm font-bold text-destructive">{matrix.fp}</div>
      </div>
      <div className="bg-destructive/15 rounded-sm p-2">
        <div className="font-mono text-[9px] text-muted-foreground">FN</div>
        <div className="font-mono text-sm font-bold text-destructive">{matrix.fn}</div>
      </div>
      <div className="bg-success/15 rounded-sm p-2">
        <div className="font-mono text-[9px] text-muted-foreground">TN</div>
        <div className="font-mono text-sm font-bold text-success">{matrix.tn}</div>
      </div>
    </div>
  );
}

export default function ModelComparisonPanel({ comparison }: Props) {
  const { model_a: a, model_b: b, dataset_info: ds } = comparison;

  // Radar data
  const radarData = [
    { metric: 'Accuracy', A: a.accuracy, B: b.accuracy },
    { metric: 'Precision', A: a.precision, B: b.precision },
    { metric: 'Recall', A: a.recall, B: b.recall },
    { metric: 'F1', A: a.f1_score, B: b.f1_score },
    { metric: 'AUC-ROC', A: a.auc_roc, B: b.auc_roc },
    { metric: 'Specificity', A: a.specificity, B: b.specificity },
  ];

  // Bar chart data for latency comparison
  const latencyData = [
    { metric: 'Avg', A: a.latency_avg_ms, B: b.latency_avg_ms },
    { metric: 'P50', A: a.latency_p50_ms, B: b.latency_p50_ms },
    { metric: 'P95', A: a.latency_p95_ms, B: b.latency_p95_ms },
    { metric: 'P99', A: a.latency_p99_ms, B: b.latency_p99_ms },
  ];

  return (
    <div className="space-y-6">
      {/* Dataset info bar */}
      <div className="bg-card border border-border rounded-md p-4">
        <div className="flex flex-wrap gap-4">
          {[
            { label: "Samples", value: ds.total_samples.toLocaleString() },
            { label: "Features", value: ds.features },
            { label: "Classes", value: ds.classes.join(", ") },
            { label: "Format", value: ds.format.toUpperCase() },
            { label: "Train/Test", value: `${ds.train_split * 100}/${ds.test_split * 100}` },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground uppercase">{item.label}:</span>
              <span className="font-mono text-xs text-foreground font-semibold">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1fr_100px_100px] items-center pb-2 border-b border-border">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Metric</span>
        <span className="font-mono text-[10px] text-model-a uppercase tracking-wider text-right">
          Model A<br /><span className="text-[8px] opacity-70">Logistic Reg.</span>
        </span>
        <span className="font-mono text-[10px] text-model-b uppercase tracking-wider text-right">
          Model B<br /><span className="text-[8px] opacity-70">Random Forest</span>
        </span>
      </div>

      {/* Classification metrics */}
      <div className="bg-card border border-border rounded-md p-4">
        <h4 className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
          Classification Metrics
        </h4>
        <MetricRow label="Accuracy" a={a.accuracy} b={b.accuracy} />
        <MetricRow label="Precision" a={a.precision} b={b.precision} />
        <MetricRow label="Recall / Sensitivity" a={a.recall} b={b.recall} />
        <MetricRow label="F1 Score" a={a.f1_score} b={b.f1_score} />
        <MetricRow label="Specificity" a={a.specificity} b={b.specificity} />
        <MetricRow label="AUC-ROC" a={a.auc_roc} b={b.auc_roc} />
        <MetricRow label="AUC-PR" a={a.auc_pr} b={b.auc_pr} />
      </div>

      {/* Regression / loss metrics */}
      <div className="bg-card border border-border rounded-md p-4">
        <h4 className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
          Loss &amp; Error Metrics
        </h4>
        <MetricRow label="Log Loss" a={a.log_loss} b={b.log_loss} format="num" higher="worse" />
        <MetricRow label="MSE" a={a.mse} b={b.mse} format="num" higher="worse" />
        <MetricRow label="MAE" a={a.mae} b={b.mae} format="num" higher="worse" />
        <MetricRow label="R²" a={a.r_squared} b={b.r_squared} format="num" higher="better" />
        <MetricRow label="Error Rate" a={a.error_rate / 100} b={b.error_rate / 100} higher="worse" />
      </div>

      {/* Radar chart */}
      <div className="bg-card border border-border rounded-md p-4">
        <h4 className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
          Performance Radar
        </h4>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="hsl(217, 32%, 17%)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'IBM Plex Mono' }} />
            <PolarRadiusAxis angle={30} domain={[0, 1]} tick={{ fill: '#64748b', fontSize: 9 }} />
            <Radar name="Model A" dataKey="A" stroke={CYAN} fill={CYAN} fillOpacity={0.15} strokeWidth={2} />
            <Radar name="Model B" dataKey="B" stroke={AMBER} fill={AMBER} fillOpacity={0.15} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded" style={{ background: CYAN }} />
            <span className="font-mono text-[10px] text-muted-foreground">Model A</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded" style={{ background: AMBER }} />
            <span className="font-mono text-[10px] text-muted-foreground">Model B</span>
          </div>
        </div>
      </div>

      {/* Confusion Matrices side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-md p-4">
          <h4 className="font-mono text-[10px] text-model-a uppercase tracking-wider mb-3">
            Model A — Confusion Matrix
          </h4>
          <ConfusionMatrix matrix={a.confusion_matrix} color="model-a" />
        </div>
        <div className="bg-card border border-border rounded-md p-4">
          <h4 className="font-mono text-[10px] text-model-b uppercase tracking-wider mb-3">
            Model B — Confusion Matrix
          </h4>
          <ConfusionMatrix matrix={b.confusion_matrix} color="model-b" />
        </div>
      </div>

      {/* Latency comparison */}
      <div className="bg-card border border-border rounded-md p-4">
        <h4 className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
          Latency Comparison (ms)
        </h4>
        <div className="grid grid-cols-[1fr_100px_100px] items-center pb-2 mb-2 border-b border-border/40">
          <span className="font-mono text-[9px] text-muted-foreground uppercase">Percentile</span>
          <span className="font-mono text-[9px] text-model-a text-right uppercase">Model A</span>
          <span className="font-mono text-[9px] text-model-b text-right uppercase">Model B</span>
        </div>
        <MetricRow label="Avg Latency" a={a.latency_avg_ms} b={b.latency_avg_ms} format="ms" higher="worse" />
        <MetricRow label="P50 Latency" a={a.latency_p50_ms} b={b.latency_p50_ms} format="ms" higher="worse" />
        <MetricRow label="P95 Latency" a={a.latency_p95_ms} b={b.latency_p95_ms} format="ms" higher="worse" />
        <MetricRow label="P99 Latency" a={a.latency_p99_ms} b={b.latency_p99_ms} format="ms" higher="worse" />
        <MetricRow label="Throughput (RPS)" a={a.throughput_rps} b={b.throughput_rps} format="num" higher="better" />
      </div>
    </div>
  );
}
