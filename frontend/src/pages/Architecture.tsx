import AppLayout from "@/components/AppLayout";
import { ArrowRight } from "lucide-react";

const steps = [
  { label: "User Request", desc: "Client sends prediction input", color: "text-foreground" },
  { label: "API Gateway", desc: "Routes to FastAPI on AWS", color: "text-primary" },
  { label: "Model Router", desc: "Selects active model and runtime", color: "text-secondary" },
  { label: "Cache Check", desc: "Redis lookup for cached result", color: "text-success" },
  { label: "HF Runtime", desc: "Hugging Face-backed inference", color: "text-primary" },
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
            title: "Model Router",
            desc: "The API resolves the requested model ID, applies routing policy, and decides whether the request can use a warm runtime or needs a fresh model load.",
            accent: "border-l-primary",
          },
          {
            title: "Caching Layer",
            desc: "Redis-backed response and warm-state caching reduces repeated work and supports low-cost serving for frequently used models.",
            accent: "border-l-success",
          },
          {
            title: "Model Serving",
            desc: "Inference runtimes load Hugging Face models on demand, starting with CPU-friendly tasks and preserving a later upgrade path to GPU-backed services.",
            accent: "border-l-secondary",
          },
          {
            title: "Observability",
            desc: "Every prediction is logged with model, latency, cache status, and timestamp. Metrics are exposed over HTTP so the dashboard can read live system state from AWS.",
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
            { method: "POST", path: "/v1/predictions", desc: "Run inference with model routing" },
            { method: "POST", path: "/v1/comparisons", desc: "Start a model comparison job" },
            { method: "GET", path: "/v1/comparisons/{job_id}", desc: "Read comparison status and result" },
            { method: "GET", path: "/v1/system/metrics", desc: "Return system metrics" },
            { method: "GET", path: "/v1/system/logs", desc: "Return latest prediction logs" },
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
