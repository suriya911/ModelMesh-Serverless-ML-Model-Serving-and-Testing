import AppLayout from "@/components/AppLayout";
import MetricsPanel from "@/components/dashboard/MetricsPanel";
import MonitoringPanel from "@/components/dashboard/MonitoringPanel";
import { useState, useEffect } from "react";
import { getAuthStatus, type AuthStatus } from "@/lib/ml-api";

export default function System() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(k => k + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const status = await getAuthStatus();
      if (active) {
        setAuthStatus(status);
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
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
        {authStatus ? (
          <div className="rounded-md border border-border bg-card p-4">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Tenant Access
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase">Tenant</div>
                <div className="font-mono text-xs font-semibold text-foreground">{authStatus.tenant_id}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase">Predictions</div>
                <div className="font-mono text-xs text-foreground">
                  {authStatus.usage.predictions_used} / {authStatus.quota.predictions_limit}
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase">Comparisons</div>
                <div className="font-mono text-xs text-foreground">
                  {authStatus.usage.comparisons_used} / {authStatus.quota.comparisons_limit}
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase">Uploads</div>
                <div className="font-mono text-xs text-foreground">
                  {authStatus.usage.uploads_used} / {authStatus.quota.uploads_limit}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <MetricsPanel refreshKey={refreshKey} />
        <MonitoringPanel refreshKey={refreshKey} />
      </div>
    </AppLayout>
  );
}
