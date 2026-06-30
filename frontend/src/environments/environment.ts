// environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'http://localhost:5000/api',  // Live backend
  googleClientId: '965877400039-isl9dli56jh3qqqeqt9of8gccneahs5o.apps.googleusercontent.com',
  googleRedirectUri: 'http://localhost:4200/auth/google/callback',
  appName: 'LCGC RFQ',
  version: '1.0.0'
};