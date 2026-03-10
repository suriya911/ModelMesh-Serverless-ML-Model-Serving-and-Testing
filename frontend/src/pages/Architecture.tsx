import AppLayout from "@/components/AppLayout";
import { ArrowRight } from "lucide-react";

const steps = [
  { label: "User Request", desc: "Client sends prediction input", color: "text-foreground" },
  { label: "API Gateway", desc: "Routes to Lambda function", color: "text-primary" },
  { label: "A/B Router", desc: "Selects Model A or B", color: "text-secondary" },
  { label: "Cache Check", desc: "Redis lookup for cached result", color: "text-success" },
  { label: "ML Inference", desc: "Model processes input", color: "text-primary" },
  { label: "Response", desc: "Result returned with metadata", color: "text-foreground" },
];

export default function Architecture() {
  return (
    <AppLayout>
      <div className="space-y-1 mb-8">
        <h2 className="font-mono text-lg font-bold text-foreground">Architecture</h2>
        <p className="text-xs text-muted-foreground">
          System design and request flow documentation.
        </p>
      </div>

      {/* Flow diagram */}
      <div className="bg-card border border-border rounded-md p-6 mb-6">
        <h3 className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider mb-6">
          Request Flow
        </h3>
        <div className="flex flex-wrap items-center gap-2 justify-center">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className="bg-background border border-border rounded-md p-3 min-w-[140px]">
                <div className={`font-mono text-xs font-bold ${step.color}`}>{step.label}</div>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{step.desc}</div>
              </div>
              {i < steps.length - 1 && <ArrowRight size={14} className="text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Component descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          {
            title: "A/B Testing Engine",
            desc: "Randomly routes 50% of traffic to Model A (Logistic Regression) and 50% to Model B (Random Forest). Enables comparing model performance in production conditions.",
            accent: "border-l-primary",
          },
          {
            title: "Caching Layer",
            desc: "In-memory cache keyed by input hash. Reduces inference latency from ~150ms to <5ms for repeated inputs. Cache hit ratio is tracked in system metrics.",
            accent: "border-l-success",
          },
          {
            title: "Model Serving",
            desc: "Two ML models serve predictions concurrently. Model A uses Logistic Regression for fast binary classification. Model B uses Random Forest for multi-class prediction.",
            accent: "border-l-secondary",
          },
          {
            title: "Observability",
            desc: "Every prediction is logged with model version, latency, cache status, and timestamp. Real-time metrics track request volume, latency distribution, and success rates.",
            accent: "border-l-warning",
          },
        ].map((card) => (
          <div key={card.title} className={`bg-card border border-border border-l-2 ${card.accent} rounded-md p-4`}>
            <h4 className="font-mono text-xs font-bold text-foreground mb-2">{card.title}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* API Reference */}
      <div className="bg-card border border-border rounded-md p-6">
        <h3 className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider mb-4">
          API Reference
        </h3>
        <div className="space-y-3">
          {[
            { method: "POST", path: "/predict", desc: "Run inference with A/B routing" },
            { method: "POST", path: "/predict/model-a", desc: "Run inference using Model A only" },
            { method: "POST", path: "/predict/model-b", desc: "Run inference using Model B only" },
            { method: "GET", path: "/metrics", desc: "Return system metrics" },
            { method: "GET", path: "/logs", desc: "Return latest prediction logs" },
          ].map((ep) => (
            <div key={ep.path} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
              <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                ep.method === 'POST' ? 'bg-primary/15 text-primary' : 'bg-success/15 text-success'
              }`}>
                {ep.method}
              </span>
              <code className="font-mono text-xs text-foreground">{ep.path}</code>
              <span className="text-xs text-muted-foreground ml-auto">{ep.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
