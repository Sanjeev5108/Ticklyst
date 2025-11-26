import { Outlet, Navigate, Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, User, Home } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function MainLayout() {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/dashboard" className="flex items-center">
              <img
                src="https://cdn.builder.io/api/v1/image/assets%2F977aa5fd74e44b0b93e04285eac4a20c%2F97e8e02635c94f41b3c35abaed04f2b1?format=webp&width=800"
                alt="Ticklyst logo"
                className="h-16 md:h-24 lg:h-28 w-auto"
              />
            </Link>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">{user?.username}</span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {user?.role}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {location.pathname !== "/dashboard" && (
        <div className="bg-gray-50 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <Link
              to="/dashboard"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center gap-1"
            >
              <Home className="h-4 w-4" /> Back to Home
            </Link>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
