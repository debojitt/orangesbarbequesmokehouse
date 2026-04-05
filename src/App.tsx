import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { StaffAuthProvider } from "@/contexts/StaffAuthContext";
import { CustomerProvider } from "@/contexts/CustomerContext";
import Index from "./pages/Index";
import CartPage from "./pages/Cart";
import ReviewPage from "./pages/Review";
import LoyaltyPage from "./pages/Loyalty";
import StaffLogin from "./pages/staff/StaffLogin";
import StaffLayout from "./pages/staff/StaffLayout";
import StaffDashboard from "./pages/staff/StaffDashboard";
import StaffMenuPage from "./pages/staff/StaffMenuPage";
import StaffOffers from "./pages/staff/StaffOffers";
import StaffLoyalty from "./pages/staff/StaffLoyalty";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CustomerProvider>
        <StaffAuthProvider>
          <CartProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/review" element={<ReviewPage />} />
                <Route path="/loyalty" element={<LoyaltyPage />} />
                <Route path="/staff/login" element={<StaffLogin />} />
                <Route path="/staff" element={<StaffLayout />}>
                  <Route path="dashboard" element={<StaffDashboard />} />
                  <Route path="menu" element={<StaffMenuPage />} />
                  <Route path="offers" element={<StaffOffers />} />
                  <Route path="loyalty" element={<StaffLoyalty />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </StaffAuthProvider>
      </CustomerProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
