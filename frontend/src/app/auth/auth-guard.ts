import { CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return false;
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  return !!token;
};
