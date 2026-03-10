import AppLayout from "@/components/AppLayout";
import MetricsPanel from "@/components/dashboard/MetricsPanel";
import MonitoringPanel from "@/components/dashboard/MonitoringPanel";
import { useState, useEffect } from "react";

export default function System() {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(k => k + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppLayout>
      <div className="space-y-1 mb-6">
        <h2 className="font-mono text-lg font-bold text-foreground">System</h2>
        <p className="text-xs text-muted-foreground">
          Real-time system metrics and prediction logs.
        </p>
      </div>

      <div className="space-y-6">
        <MetricsPanel refreshKey={refreshKey} />
        <MonitoringPanel refreshKey={refreshKey} />
      </div>
    </AppLayout>
  );
}
