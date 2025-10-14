import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, User, Shield } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = login(username, password);
      if (!success) {
        setError('Invalid username or password');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const testCredentials = [
    { role: 'Admin', username: 'Admin', password: '12345' },
    { role: 'HR', username: 'HR', password: '12345' },
    { role: 'Division Partner', username: 'Division Partner', password: '12345' },
    { role: 'Division Head', username: 'Division Head', password: '12345' },
    { role: 'Team Leader', username: 'Team Leader', password: '12345' },
    { role: 'Team Member', username: 'Team Member', password: '12345' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <img src="https://cdn.builder.io/api/v1/image/assets%2F977aa5fd74e44b0b93e04285eac4a20c%2F97e8e02635c94f41b3c35abaed04f2b1?format=webp&width=800" alt="Ticklyst logo" className="h-16 md:h-20 w-auto" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Internal Audit System</h1>
          <p className="text-gray-600 mt-2">Role-based checklist management platform</p>
        </div>

        {/* Login Form */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-center">Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Test Credentials */}
        <Card className="shadow-md bg-gray-50">
          <CardHeader>
            <CardTitle className="text-sm text-gray-700">Test Credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {testCredentials.map((cred, index) => (
              <div key={index} className="flex justify-between text-xs">
                <span className="font-medium text-gray-600">{cred.role}:</span>
                <span className="text-gray-500">{cred.username} / {cred.password}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
