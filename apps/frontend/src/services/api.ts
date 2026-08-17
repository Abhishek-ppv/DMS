export interface RequestOptions extends RequestInit {
  body?: any;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('accessToken', token);
    } else {
      localStorage.removeItem('accessToken');
    }
  }

  getAccessToken() {
    return this.accessToken;
  }

  getRefreshToken() {
    return localStorage.getItem('refreshToken');
  }

  setRefreshToken(token: string | null) {
    if (token) {
      localStorage.setItem('refreshToken', token);
    } else {
      localStorage.removeItem('refreshToken');
    }
  }

  clearTokens() {
    this.accessToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  private extractErrorMessage(errData: any): string | null {
    if (!errData) return null;
    if (typeof errData.message === 'string') return errData.message;
    if (Array.isArray(errData.message)) return errData.message.join(', ');
    if (errData.error) {
      if (typeof errData.error === 'string') return errData.error;
      if (typeof errData.error.message === 'string') return errData.error.message;
      if (Array.isArray(errData.error.message)) return errData.error.message.join(', ');
    }
    return null;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = path.startsWith('http') ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`;
    
    const headers = new Headers(options.headers || {});
    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }
    if (options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const fetchOptions: RequestInit = {
      ...options,
      headers,
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (err) {
      throw new Error('Network error. Backend might be unavailable.');
    }

    if (response.status === 401) {
      // Do not try to refresh if the request itself is login or refresh
      if (path.includes('/auth/login') || path.includes('/auth/refresh')) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Authentication failed');
      }

      // Session expired, attempt refresh
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        this.clearTokens();
        throw new Error('Session expired');
      }

      if (!this.refreshPromise) {
        this.refreshPromise = (async () => {
          try {
            const refreshRes = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ refreshToken }),
            });

            if (!refreshRes.ok) {
              throw new Error('Session expired');
            }

            const refreshData = await refreshRes.json();
            this.setAccessToken(refreshData.accessToken);
            return refreshData.accessToken;
          } catch (err) {
            this.clearTokens();
            window.dispatchEvent(new CustomEvent('auth-logout'));
            throw err;
          } finally {
            this.refreshPromise = null;
          }
        })();
      }

      // Wait for the active refresh to complete, then retry the request
      return this.refreshPromise.then((newToken) => {
        headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(url, fetchOptions).then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const msg = this.extractErrorMessage(errData) || 'Request failed after token refresh';
            throw new Error(msg);
          }
          return res.json() as Promise<T>;
        });
      });
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = this.extractErrorMessage(errData) || 'Request failed';
      throw new Error(msg);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async post<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  async put<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  async patch<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
