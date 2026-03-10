import { getLogs, type LogEntry } from "@/lib/ml-api";
import { useEffect, useState } from "react";

interface Props {
  refreshKey: number;
}

export default function MonitoringPanel({ refreshKey }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    let active = true;

    getLogs().then((result) => {
      if (active) {
        setLogs(result);
      }
    });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  return (
    <div className="space-y-3">
      <h3 className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider">
        Prediction Logs
      </h3>

      <div className="bg-card border border-border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['ID', 'Model', 'Latency', 'Status', 'Cached', 'Time'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center font-mono text-xs text-muted-foreground">
                    No logs yet.
                  </td>
                </tr>
              ) : (
                logs.slice(0, 20).map((log) => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      {log.prediction_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        log.model === 'model_a' ? 'bg-model-a/15 text-model-a' : 'bg-model-b/15 text-model-b'
                      }`}>
                        {log.model === 'model_a' ? 'A' : 'B'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-warning">
                      {log.latency_ms}ms
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-[10px] text-success">●</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                      {log.cached ? '✓' : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
