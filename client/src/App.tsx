/* Jan Seva Editorial reminder: the shell stays calm and content-led; screens must always have an escape route. */

import { Toaster } from "@/components/ui/sonner";
import Dashboard from "@/pages/Dashboard";
import Discover from "@/pages/Discover";
import AdminSchemes from "@/pages/AdminSchemes";
import PilotLanding from "@/pages/PilotLanding";
import SchemeDetail from "@/pages/SchemeDetail";
import ScholarshipChecker from "@/pages/ScholarshipChecker";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";

export default function App() {
  return <ErrorBoundary><Toaster position="top-right" /><Switch><Route path="/" component={Home} /><Route path="/discover" component={Discover} /><Route path="/scholarships" component={ScholarshipChecker} /><Route path="/pilot" component={PilotLanding} /><Route path="/scheme/:schemeId" component={SchemeDetail} /><Route path="/dashboard" component={Dashboard} /><Route path="/admin/schemes" component={AdminSchemes} /><Route component={Home} /></Switch></ErrorBoundary>;
}
