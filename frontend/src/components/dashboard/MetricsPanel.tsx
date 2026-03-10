import { getMetrics, type SystemMetrics } from "@/lib/ml-api";
import { useEffect, useState } from "react";
import { Activity, Clock, Database, CheckCircle } from "lucide-react";

interface Props {
  refreshKey: number;
}

export default function MetricsPanel({ refreshKey }: Props) {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    requests: 0,
    avg_latency: 0,
    model_a_usage: 0,
    model_b_usage: 0,
    cache_hits: 0,
    cache_misses: 0,
    success_rate: 0,
  });

  useEffect(() => {
    let active = true;

    getMetrics().then((result) => {
      if (active) {
        setMetrics(result);
      }
    });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const cacheTotal = metrics.cache_hits + metrics.cache_misses;
  const cacheRatio = cacheTotal > 0 ? Math.round((metrics.cache_hits / cacheTotal) * 100) : 0;

  const cards = [
    { label: "Requests", value: metrics.requests, icon: Activity, color: "text-primary" },
    { label: "Avg Latency", value: `${metrics.avg_latency || 0}ms`, icon: Clock, color: "text-warning" },
    { label: "Cache Hit", value: `${cacheRatio}%`, icon: Database, color: "text-success" },
    { label: "Success Rate", value: `${metrics.success_rate}%`, icon: CheckCircle, color: "text-success" },
  ];

  return (
    <div className="space-y-3">
      <h3 className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider">
        System Metrics
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-md p-3">
            <div className="flex items-center gap-2 mb-2">
              <c.icon size={14} className={c.color} />
              <span className="font-mono text-[10px] text-muted-foreground uppercase">{c.label}</span>
            </div>
            <div className={`font-mono text-xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
