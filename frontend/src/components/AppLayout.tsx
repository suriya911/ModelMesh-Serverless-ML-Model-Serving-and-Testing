import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="lg:ml-56 min-h-screen w-full">
        <div className="pt-16 lg:pt-0 p-4 lg:p-6 w-full max-w-none">
          {children}
        </div>
      </main>
    </div>
  );
}
