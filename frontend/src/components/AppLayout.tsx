import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="lg:ml-56 min-h-screen">
        <div className="p-4 lg:p-6 max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
}
