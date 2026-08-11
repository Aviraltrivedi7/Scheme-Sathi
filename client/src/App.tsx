/* Jan Seva Editorial reminder: the shell stays calm and content-led; screens must always have an escape route. */

import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";

export default function App() {
  return <ErrorBoundary><Toaster position="top-right" /><Home /></ErrorBoundary>;
}
