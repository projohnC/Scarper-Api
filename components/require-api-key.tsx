"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useApiKey } from '@/lib/hooks/use-api-key';
import { Loader2, Key, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RequireApiKeyProps {
  children: React.ReactNode;
  fallbackPath?: string;
}

export function RequireApiKey({ children, fallbackPath = '/dashboard/api-keys' }: RequireApiKeyProps) {
  const { user, authLoading } = useAuth();
  const { hasApiKey, loading: apiKeyLoading, error } = useApiKey();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (!authLoading && user && !apiKeyLoading && !hasApiKey) {
      // Don't redirect if already on API keys page
      if (window.location.pathname !== fallbackPath) {
        router.push(fallbackPath);
      }
    }
  }, [user, authLoading, hasApiKey, apiKeyLoading, router, fallbackPath]);

  // Show loading while checking authentication and API keys
  if (authLoading || apiKeyLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return null;
  }

  // Show API key required message if on a protected page without API key
  if (!hasApiKey && window.location.pathname !== fallbackPath) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 mx-auto mb-4">
              <Key className="w-6 h-6 text-orange-600" />
            </div>
            <CardTitle>API Key Required</CardTitle>
            <CardDescription>
              You need to create an API key to access this feature
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <p className="text-sm text-muted-foreground text-center">
              API keys are required to access our scraping APIs and services. Create your first API key to get started.
            </p>
            <Button 
              onClick={() => router.push(fallbackPath)} 
              className="w-full"
            >
              Create API Key
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render children if user has API key or is on the API keys page
  return <>{children}</>;
}
