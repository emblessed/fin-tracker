const API_URL = import.meta.env.VITE_API_URL || '';

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

async function request(endpoint: string, options: RequestOptions = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.auth) {
    const token = localStorage.getItem('token');

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Ошибка запроса');
  }

  return data;
}

export const registerUser = async (userData: any) => {
  return request('/api/auth/register', {
    method: 'POST',
    body: userData,
  });
};

export const loginUser = async (credentials: any) => {
  return request('/api/auth/login', {
    method: 'POST',
    body: credentials,
  });
};

export const getCurrentUser = async () => {
  return request('/api/auth/me', {
    auth: true,
  });
};

export const updateCurrentUser = async (userData: any) => {
  return request('/api/auth/me', {
    method: 'PATCH',
    body: userData,
    auth: true,
  });
};
