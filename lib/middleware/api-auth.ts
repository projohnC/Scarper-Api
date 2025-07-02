import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/lib/services/api-key-service';

export interface AuthResult {
  isValid: boolean;
  apiKey?: any;
  error?: string;
}

export async function validateApiKey(request: NextRequest | Request): Promise<AuthResult> {
  try {
    // Extract API key from headers
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!apiKey) {
      return {
        isValid: false,
        error: 'API key is required. Please provide your API key in the x-api-key header.'
      };
    }

    // Validate and increment usage
    const validationResult = await ApiKeyService.validateAndIncrementUsage(apiKey);
    
    if (!validationResult) {
      return {
        isValid: false,
        error: 'Invalid or inactive API key. Please check your API key or create a new one.'
      };
    }

    return {
      isValid: true,
      apiKey: validationResult
    };
  } catch (error) {
    console.error('API key validation error:', error);
    return {
      isValid: false,
      error: 'Failed to validate API key. Please try again.'
    };
  }
}

export function createUnauthorizedResponse(message: string = 'Invalid API key'): NextResponse {
  return NextResponse.json(
    { 
      success: false, 
      error: 'Unauthorized', 
      message,
      code: 'INVALID_API_KEY'
    },
    { 
      status: 401,
      headers: {
        'WWW-Authenticate': 'Bearer realm="API"'
      }
    }
  );
}
      isValid: false,
      error: 'Internal server error during API key validation'
    };
  }
}

export function createUnauthorizedResponse(error: string) {
  return new Response(
    JSON.stringify({
      success: false,
      error,
      code: 'UNAUTHORIZED',
      message: 'Please provide a valid API key to access this endpoint'
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="API Key Required"'
      }
    }
  );
}
