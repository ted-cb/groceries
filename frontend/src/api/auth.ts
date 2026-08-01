import { apiFetch } from './client';

export type User = {
  id: string;
  email: string;
};

export type AuthResponse = {
  user: User;
};

export function register(email: string, password: string) {
  return apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function login(email: string, password: string) {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return apiFetch<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST',
  });
}

export function getMe() {
  return apiFetch<AuthResponse>('/api/auth/me');
}
