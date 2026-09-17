/* Jan Seva Editorial reminder: the shell stays calm and content-led; screens must always have an escape route. */

import { Toaster } from "@/components/ui/sonner";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import CohortSignupAttribution from "./components/CohortSignupAttribution";
import ErrorBoundary from "./components/ErrorBoundary";
import { PwaUpdatePrompt } from "./components/PwaUpdatePrompt";
import Home from "./pages/Home";

// Route-level code splitting: the public landing experience stays in the
// entry bundle; heavier authed/admin screens load on first navigation.
const Discover = lazy(() => import("@/pages/Discover"));
const Login = lazy(() => import("@/pages/Login"));
const ScholarshipChecker = lazy(() => import("@/pages/ScholarshipChecker"));
const SchemeDetail = lazy(() => import("@/pages/SchemeDetail"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const AdminSchemes = lazy(() => import("@/pages/AdminSchemes"));
const PilotAdmin = lazy(() => import("@/pages/PilotAdmin"));
const PilotLanding = lazy(() => import("@/pages/PilotLanding"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const RouteFallback = () => (
  <div
    className="flex min-h-[60vh] items-center justify-center"
    role="status"
    aria-label="Loading page"
  >
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <Toaster position="top-right" />
      <CohortSignupAttribution />
      <Suspense fallback={<RouteFallback />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/discover" component={Discover} />
          <Route path="/scholarships" component={ScholarshipChecker} />
          <Route path="/pilot" component={PilotLanding} />
          <Route path="/login" component={Login} />
          <Route path="/scheme/:schemeId" component={SchemeDetail} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/admin/schemes" component={AdminSchemes} />
          <Route path="/admin/pilot" component={PilotAdmin} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
      <PwaUpdatePrompt />
    </ErrorBoundary>
  );
}
