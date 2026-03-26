import { ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { DateFilterProvider } from "@/hooks/useDateFilter";

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <DateFilterProvider>
      <SidebarProvider className="overflow-x-hidden">
        <DashboardSidebar />
        <SidebarInset className="overflow-hidden w-full min-w-0">
          <DashboardHeader />
          <div className="flex-1 p-6 overflow-auto w-full min-w-0 max-w-full">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </DateFilterProvider>
  );
};
