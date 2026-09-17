import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { Bell, Compass, FileText, Inbox, LayoutDashboard, LogOut, Mail, PanelLeft, Settings2, Sparkles } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { DocumentReviewWorkspace } from "./DocumentReviewWorkspace";
import { ReviewerAlertPreferences } from "./ReviewerAlertPreferences";
import { ReviewerDueDateManager } from "./ReviewerDueDateManager";
import { ReviewerWorkloadDashboard } from "./ReviewerWorkloadDashboard";
import { OwnerOverdueEscalations } from "./OwnerOverdueEscalations";
import { ReviewerReminderSnooze } from "./ReviewerReminderSnooze";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Application Desk", path: "/dashboard" },
  { icon: Compass, label: "Discover schemes", path: "/discover" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() =>
              startLogin(
                `${window.location.pathname}${window.location.search}`
              )
            }
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const visibleMenuItems = user?.role === "admin" ? [...menuItems, { icon: Settings2, label: "Manage schemes", path: "/admin/schemes" }, { icon: Inbox, label: "Pilot inbox", path: "/admin/pilot" }] : menuItems;
  const activeMenuItem = visibleMenuItems.find(item => item.path === location);
  const isMobile = useIsMobile();
  const familyInvitations = trpc.documents.historyFilters.notifications.useQuery(undefined, { retry: false, refetchInterval: 60_000 });
  const pendingInvitationCount = familyInvitations.data?.notifications.length ?? 0;
  const openFamilyInvitations = () => { if (location !== "/dashboard") setLocation("/dashboard"); window.setTimeout(() => document.getElementById("family-invitations")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); };
  const reviewerAlerts = trpc.documents.reviewers.notifications.useQuery(undefined, { retry: false, refetchInterval: 15_000, refetchOnWindowFocus: true });
  const pendingReviewerAlertCount = reviewerAlerts.data?.notifications.length ?? 0;
  const openReviewAlerts = () => { if (location !== "/dashboard") setLocation("/dashboard"); window.setTimeout(() => document.getElementById("review-alerts")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); };

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                    <span className="scheme-sathi-mark" aria-hidden="true"><FileText size={14} /><Sparkles size={8} /></span><span className="scheme-sathi-wordmark">Scheme Sathi</span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {visibleMenuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={openFamilyInvitations} tooltip={pendingInvitationCount ? `${pendingInvitationCount} pending family invitation${pendingInvitationCount === 1 ? "" : "s"}` : "Family invitations"} className="h-10 transition-all font-normal">
                  <span className="relative"><Mail className="h-4 w-4" />{pendingInvitationCount > 0 && <i className="absolute -right-2 -top-2 min-w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] leading-4 text-center not-italic font-bold">{pendingInvitationCount > 9 ? "9+" : pendingInvitationCount}</i>}</span>
                  <span>Family invitations</span>
                  {pendingInvitationCount > 0 && <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary group-data-[collapsible=icon]:hidden">{pendingInvitationCount}</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={openReviewAlerts} tooltip={pendingReviewerAlertCount ? `${pendingReviewerAlertCount} new reviewer assignment${pendingReviewerAlertCount === 1 ? "" : "s"}` : "Review alerts"} className="h-10 transition-all font-normal">
                  <span className="relative"><Bell className="h-4 w-4" />{pendingReviewerAlertCount > 0 && <i className="absolute -right-2 -top-2 min-w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] leading-4 text-center not-italic font-bold">{pendingReviewerAlertCount > 9 ? "9+" : pendingReviewerAlertCount}</i>}</span>
                  <span>Review alerts</span>
                  {pendingReviewerAlertCount > 0 && <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary group-data-[collapsible=icon]:hidden">{pendingReviewerAlertCount}</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="min-w-0 flex-1 p-4">{children}{location === "/dashboard" && <div id="review-alerts"><DocumentReviewWorkspace /><ReviewerWorkloadDashboard /><OwnerOverdueEscalations /><ReviewerReminderSnooze /><ReviewerAlertPreferences /><ReviewerDueDateManager /></div>}</main>
      </SidebarInset>
    </>
  );
}
