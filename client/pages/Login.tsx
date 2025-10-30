import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, User, Shield } from 'lucide-react';

export default function Login() {
  // All hooks must be called unconditionally and before any early return
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [searchParams] = useSearchParams();
  const resetSuccess = searchParams.get('reset') === '1';

  const { login, isAuthenticated } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(username, password);
      if (!success) {
        setError('Invalid username or password');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 flex flex-col justify-center min-h-[60vh]">
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
            {resetSuccess && (
              <Alert className="mb-4 border-green-200 bg-green-50">
                <AlertDescription className="text-green-700">
                  Password has been reset successfully. Please sign in.
                </AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    placeholder="Email"
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

          <div className="p-3 border-t">
            {!showForgot ? (
              <button className="text-sm text-blue-600 hover:underline" onClick={() => setShowForgot(true)}>Forgot password?</button>
            ) : (
              <div className="space-y-2">
                {forgotMsg ? (<div className="text-sm text-green-700">{forgotMsg}</div>) : null}
                <div className="flex gap-2">
                  <Input placeholder="Enter your email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
                  <Button onClick={async () => {
                    setForgotMsg('');
                    try {
                      const res = await fetch('/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail }) });
                      if (res.ok) setForgotMsg('If the email exists, a reset link has been sent.');
                      else setForgotMsg('Failed to request reset');
                    } catch (e) { setForgotMsg('Network error'); }
                  }}>Send</Button>
                </div>
                <div>
                  <button className="text-xs text-gray-500 hover:underline" onClick={() => { setShowForgot(false); setForgotEmail(''); setForgotMsg(''); }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}
