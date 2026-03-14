import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <AppSidebar />
      <main className="min-h-screen w-full lg:pl-56">
        <div className="mx-auto w-full max-w-[1680px] px-4 pb-6 pt-16 sm:px-5 md:px-6 lg:px-8 lg:pt-8 xl:px-10">
          {children}
        </div>
      </main>
    </div>
  );
}
