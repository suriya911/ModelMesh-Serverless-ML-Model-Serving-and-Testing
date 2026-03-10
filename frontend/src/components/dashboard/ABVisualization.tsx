import { getMetrics, type SystemMetrics } from "@/lib/ml-api";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";

interface Props {
  refreshKey: number;
}

const CYAN = "#22d3ee";
const AMBER = "#facc15";
const GREEN = "#22c55e";

export default function ABVisualization({ refreshKey }: Props) {
  const [metrics, setMetrics] = useState<SystemMetrics>(getMetrics());
  const [history, setHistory] = useState<{ time: string; a: number; b: number }[]>([]);

  useEffect(() => {
    const m = getMetrics();
    setMetrics(m);
    if (m.requests > 0) {
      setHistory(prev => [
        ...prev.slice(-19),
        {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          a: m.model_a_usage,
          b: m.model_b_usage,
        },
      ]);
    }
  }, [refreshKey]);

  const totalUsage = metrics.model_a_usage + metrics.model_b_usage;
  const pieData = totalUsage > 0
    ? [
        { name: "Model A", value: metrics.model_a_usage },
        { name: "Model B", value: metrics.model_b_usage },
      ]
    : [{ name: "No data", value: 1 }];

  const barData = [
    { name: "Model A", usage: metrics.model_a_usage, fill: CYAN },
    { name: "Model B", usage: metrics.model_b_usage, fill: AMBER },
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider">
        A/B Testing Visualization
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Usage distribution */}
        <div className="bg-card border border-border rounded-md p-4">
          <h4 className="font-mono text-[10px] text-muted-foreground uppercase mb-3">
            Model Distribution
          </h4>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                dataKey="value"
                strokeWidth={0}
              >
                <Cell fill={CYAN} />
                <Cell fill={AMBER} />
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '4px', fontFamily: 'IBM Plex Mono', fontSize: '11px' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: CYAN }} />
              <span className="font-mono text-[10px] text-muted-foreground">Model A ({totalUsage > 0 ? Math.round(metrics.model_a_usage / totalUsage * 100) : 0}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: AMBER }} />
              <span className="font-mono text-[10px] text-muted-foreground">Model B ({totalUsage > 0 ? Math.round(metrics.model_b_usage / totalUsage * 100) : 0}%)</span>
            </div>
          </div>
        </div>

        {/* Usage bar chart */}
        <div className="bg-card border border-border rounded-md p-4">
          <h4 className="font-mono text-[10px] text-muted-foreground uppercase mb-3">
            Request Count
          </h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
              <Bar dataKey="usage" radius={[3, 3, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Timeline */}
      {history.length > 1 && (
        <div className="bg-card border border-border rounded-md p-4">
          <h4 className="font-mono text-[10px] text-muted-foreground uppercase mb-3">
            Usage Over Time
          </h4>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={history}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 9, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
              <Line type="monotone" dataKey="a" stroke={CYAN} strokeWidth={2} dot={false} name="Model A" />
              <Line type="monotone" dataKey="b" stroke={AMBER} strokeWidth={2} dot={false} name="Model B" />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '4px', fontFamily: 'IBM Plex Mono', fontSize: '11px' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
