import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface ApiKeyState {
  hasApiKey: boolean;
  loading: boolean;
  apiKeys: any[];
  error: string | null;
}

export function useApiKey(): ApiKeyState {
  const { user } = useAuth();
  const [state, setState] = useState<ApiKeyState>({
    hasApiKey: false,
    loading: true,
    apiKeys: [],
    error: null
  });

  useEffect(() => {
    async function checkApiKeys() {
      if (!user) {
        setState({
          hasApiKey: false,
          loading: false,
          apiKeys: [],
          error: null
        });
        return;
      }

      try {
        const response = await fetch(`/api/api-keys?userId=${user.uid}`);
        const data = await response.json();

        if (data.success) {
          const activeKeys = data.apiKeys?.filter((key: any) => key.isActive) || [];
          setState({
            hasApiKey: activeKeys.length > 0,
            loading: false,
            apiKeys: data.apiKeys || [],
            error: null
          });
        } else {
          setState({
            hasApiKey: false,
            loading: false,
            apiKeys: [],
            error: data.error || 'Failed to fetch API keys'
          });
        }
      } catch (error) {
        console.error('Error checking API keys:', error);
        setState({
          hasApiKey: false,
          loading: false,
          apiKeys: [],
          error: 'Failed to check API keys'
        });
      }
    }

    checkApiKeys();
  }, [user]);

  return state;
}
