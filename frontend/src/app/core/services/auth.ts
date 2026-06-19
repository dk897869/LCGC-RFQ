// auth.service.ts (COMPLETE FIXED VERSION WITH FAST LOADER & CERTIFICATE API)
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of, tap, throwError, timeout, switchMap, timer } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'user_data';
  private readonly CURRENT_USER_KEY = 'currentUser';
  private readonly REMEMBER_EMAIL_KEY = 'remembered_email';

  /** Base API path, e.g. `/api` — no trailing slash */
  readonly API_URL = (environment.apiUrl || '').replace(/\/$/, '');

  /** Origin for resolving relative upload paths (strip trailing `/api`) */
  private get API_ORIGIN(): string {
    const base = this.API_URL;
    return base.replace(/\/api\/?$/i, '') || base;
  }

  private readonly isBrowser: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (this.isBrowser) {
      this.pingServer();
      setInterval(() => this.pingServer(), 14 * 60 * 1000);
    }
  }

  // ==================== FAST LOADER HELPER (added) ====================
  // The old pattern used across this service was:
  //   return new Observable(observer => {
  //     setTimeout(() => { this.http.xxx(...).subscribe({...}) }, 250);
  //   });
  // That 250ms `setTimeout` ran BEFORE the HTTP call even started — it added
  // dead latency to every single action (approve/reject/create/etc.) without
  // giving you any of the "show a loader, then toast" behavior you actually
  // want, since there was no minimum duration on the call itself.
  //
  // `ensureMinDuration` replaces that: it lets the real HTTP call start
  // immediately (no artificial pre-delay), but if the response comes back
  // faster than `minMs`, it waits out the rest of that time before emitting.
  // That's what gives you a loader that's visible for ~2s instead of
  // flashing for 50ms, with the toast firing right after — and it never
  // makes a SLOW response slower, since `remaining` is 0 once minMs is
  // already exceeded by the real network time.
  //
  // Usage in a component:
  //   this.loading = true;
  //   this.authService.approveEPRequest(id, comments).subscribe({
  //     next: () => { this.loading = false; /* toast already shown by service */ },
  //     error: () => { this.loading = false; }
  //   });
  private ensureMinDuration<T>(source: Observable<T>, minMs: number = 2000): Observable<T> {
    const startedAt = Date.now();
    return source.pipe(
      switchMap((value) => {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, minMs - elapsed);
        return remaining > 0 ? timer(remaining).pipe(map(() => value)) : of(value);
      })
    );
  }

  private getHttpOptions() {
    return {
      headers: this.getAuthHeaders()
    };
  }

  private getUploadHttpOptions() {
    const token = this.getToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return {
      headers,
      withCredentials: false
    };
  }

  private pingServer(): void {
    this.http.get(`${this.API_URL}/health`, { observe: 'response' })
      .pipe(timeout(5000), catchError(() => of(null)))
      .subscribe();
  }

  private getActiveStorage(rememberMe = false): Storage | null {
    if (!this.isBrowser) return null;
    if (rememberMe) return localStorage;
    if (localStorage.getItem(this.TOKEN_KEY)) return localStorage;
    if (sessionStorage.getItem(this.TOKEN_KEY)) return sessionStorage;
    return sessionStorage;
  }

  private resolveAvatarUrl(avatar: string | undefined | null): string {
    if (avatar == null || typeof avatar !== 'string' || !avatar.trim()) return '';
    const a = avatar.trim();
    if (a.startsWith('data:') || a.startsWith('http://') || a.startsWith('https://')) return a;
    if (a.startsWith('/')) return `${this.API_ORIGIN}${a}`;
    return `${this.API_ORIGIN}/${a}`;
  }

  private sanitizeEmail(email: string | undefined | null): string {
    const e = (email || '').trim();
    if (!e) return '';
    if (e.includes('@')) return e;
    if (/^[a-f0-9]{24}$/i.test(e)) return '';
    return e;
  }

  private normalizeUser(user: any): any {
    if (!user) return null;
    const rawAvatar = user.avatar || user.profileImage || user.photo || '';
    return {
      ...user,
      id: user.id || user._id,
      _id: user._id || user.id,
      name: user.name || user.fullName || user.username || 'User',
      email: this.sanitizeEmail(user.email),
      department: user.department || user.dept || 'Purchase',
      contactNo: user.contactNo || user.phone || user.mobile || '',
      organization: user.organization || user.company || 'Radiant Appliances',
      role: user.role || 'User',
      rights: user.rights || {},
      mustChangePassword: user.mustChangePassword === true,
      vendorAccount: user.vendorAccount || {},
      fullModuleAccessGranted: user.fullModuleAccessGranted === true,
      accessRequest: user.accessRequest || { status: 'none' },
      avatar: this.resolveAvatarUrl(rawAvatar)
    };
  }

  private storeAuthSession(response: any, rememberMe = false): void {
    if (!this.isBrowser || !response?.token) return;
    const storage = this.getActiveStorage(rememberMe);
    const normalizedUser = this.normalizeUser(response.user || response.data?.user || response.data);
    if (!storage) return;

    storage.setItem(this.TOKEN_KEY, response.token);
    if (normalizedUser) {
      storage.setItem(this.USER_KEY, JSON.stringify(normalizedUser));
      storage.setItem(this.CURRENT_USER_KEY, JSON.stringify(normalizedUser));
    }
    if (rememberMe && normalizedUser?.email) {
      localStorage.setItem(this.REMEMBER_EMAIL_KEY, normalizedUser.email);
    }
  }

  private persistCurrentUser(user: any): void {
    if (!this.isBrowser) return;
    const storage = this.getActiveStorage();
    const normalizedUser = this.normalizeUser(user);
    if (!storage || !normalizedUser) return;
    storage.setItem(this.USER_KEY, JSON.stringify(normalizedUser));
    storage.setItem(this.CURRENT_USER_KEY, JSON.stringify(normalizedUser));
  }

  public updateLocalUser(userData: any): void {
    if (!this.isBrowser) return;
    const currentUser = this.getUser();
    const updatedUser = { ...currentUser, ...this.normalizeUser(userData) };
    const storage = this.getActiveStorage();
    if (storage) {
      storage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
      storage.setItem(this.CURRENT_USER_KEY, JSON.stringify(updatedUser));
    }
  }

  private extractListData(res: any): any[] {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.requests)) return res.requests;
    if (Array.isArray(res.rfqs)) return res.rfqs;
    if (Array.isArray(res.items)) return res.items;
    if (Array.isArray(res.vendors)) return res.vendors;
    if (Array.isArray(res.parts)) return res.parts;
    if (Array.isArray(res.prNpp)) return res.prNpp;
    if (Array.isArray(res.npp)) return res.npp;
    if (Array.isArray(res.results)) return res.results;
    return [];
  }

  private asListResponse(res: any): any {
    const data = this.extractListData(res);
    if (res && typeof res === 'object' && 'success' in res) return { ...res, data };
    return { success: true, data };
  }

  private withId(listResponse: any): any {
    if (listResponse?.data && Array.isArray(listResponse.data)) {
      return {
        ...listResponse,
        data: listResponse.data.map((item: any) => ({ ...item, id: item.id || item._id }))
      };
    }
    if (Array.isArray(listResponse)) {
      return listResponse.map((item: any) => ({ ...item, id: item.id || item._id }));
    }
    return listResponse;
  }

  private mapPriorityFromBackend(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      'H': 'High', 'M': 'Medium', 'L': 'Low',
      'High': 'High', 'Medium': 'Medium', 'Low': 'Low'
    };
    return priorityMap[priority] || 'Medium';
  }

  private mapStatusFromBackend(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Open': 'Pending', 'In-Process': 'In Process', 'Approved': 'Approved',
      'Rejected': 'Rejected', 'Pending': 'Pending', 'In Process': 'In Process'
    };
    return statusMap[status] || 'Pending';
  }

  public mapPriorityToBackend(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      'High': 'H', 'Medium': 'M', 'Low': 'L', 'Urgent': 'H'
    };
    return priorityMap[priority] || 'M';
  }

  // ==================== OTP METHODS ====================
  
  sendOTP(email: string): Observable<any> {
    const cleanEmail = email.trim().toLowerCase();
    console.log('📧 Sending OTP to:', cleanEmail);
    
    return this.http.post<any>(`${this.API_URL}/auth/send-otp`, {
      email: cleanEmail
    }, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      timeout(30000),
      tap(res => {
        if (res?.success && this.isBrowser) {
          sessionStorage.setItem('verify_email', cleanEmail);
        }
      }),
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Failed to send OTP. Please try again.';
        if (error.status === 0) {
          errorMessage = `Cannot connect to server at ${this.API_URL}.`;
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  sendSMSOTP(mobile: string, type = 'login'): Observable<any> {
    const cleanMobile = mobile.trim();
    console.log('📱 Sending SMS OTP to:', cleanMobile);
    
    return this.http.post<any>(`${this.API_URL}/auth/send-sms-otp`, {
      mobile: cleanMobile, type
    }, this.getHttpOptions()).pipe(
      timeout(15000),
      tap(res => console.log('✅ SMS OTP sent:', res)),
      catchError((error) => {
        if (this.isBrowser) {
          const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
          sessionStorage.setItem('mock_sms_otp', mockOtp);
          this.showToastMessage(`Test SMS OTP: ${mockOtp}`, 'info');
          return of({ success: true, message: 'SMS OTP sent (demo)', mockOtp });
        }
        return throwError(() => ({ success: false, message: 'Failed to send SMS OTP' }));
      })
    );
  }

  verifyOTP(identifier: string, otp: string, method = 'email', type = 'login'): Observable<any> {
    const cleanOtp = otp.trim();
    const body: any = { otp: cleanOtp, method, type };
    
    if (method === 'email') {
      body.email = identifier.trim().toLowerCase();
    } else {
      body.mobile = identifier.trim();
    }
    
    return this.http.post<any>(`${this.API_URL}/auth/verify-otp`, body, this.getHttpOptions()).pipe(
      timeout(15000),
      tap(res => {
        if (res?.success && res?.token) this.storeAuthSession(res, true);
      }),
      catchError((error) => {
        if (this.isBrowser) {
          const mockStored = method === 'email' 
            ? sessionStorage.getItem('mock_otp') 
            : sessionStorage.getItem('mock_sms_otp');
          
          if (mockStored && cleanOtp === mockStored) {
            sessionStorage.removeItem('mock_otp');
            sessionStorage.removeItem('mock_sms_otp');
            const mockUser = {
              id: 'mock_' + Date.now(),
              email: method === 'email' ? identifier : undefined,
              name: 'Test User', role: 'Manager',
              token: 'mock_token_' + Date.now()
            };
            const mockResponse = { success: true, token: mockUser.token, user: mockUser };
            this.storeAuthSession(mockResponse, true);
            return of(mockResponse);
          }
        }
        return throwError(() => ({ success: false, message: 'Invalid OTP' }));
      })
    );
  }

  verifyOTPAndLogin(email: string, otp: string, rememberMe = false): Observable<any> {
    return this.verifyOTP(email, otp, 'email', 'login').pipe(
      tap(res => {
        if (res?.success && rememberMe && this.isBrowser) {
          localStorage.setItem(this.REMEMBER_EMAIL_KEY, email);
        }
      })
    );
  }

  sendRegistrationOTP(email: string): Observable<any> {
    const cleanEmail = email.trim().toLowerCase();
    return this.http.post<any>(`${this.API_URL}/auth/send-registration-otp`, {
      email: cleanEmail
    }, this.getHttpOptions()).pipe(
      timeout(15000),
      catchError((error) => {
        if (this.isBrowser) {
          const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
          sessionStorage.setItem('mock_reg_otp', mockOtp);
          this.showToastMessage(`Test Registration OTP: ${mockOtp}`, 'info');
          return of({ success: true, message: 'Registration OTP sent (demo)', mockOtp });
        }
        return throwError(() => ({ success: false, message: 'Failed to send registration OTP' }));
      })
    );
  }

  verifyRegistrationOTP(email: string, otp: string): Observable<any> {
    const cleanOtp = otp.trim();
    return this.http.post<any>(`${this.API_URL}/auth/verify-registration-otp`, {
      email: email.trim().toLowerCase(),
      otp: cleanOtp
    }, this.getHttpOptions()).pipe(
      timeout(15000),
      catchError((error) => {
        if (this.isBrowser) {
          const mockStored = sessionStorage.getItem('mock_reg_otp');
          if (mockStored && cleanOtp === mockStored) {
            sessionStorage.removeItem('mock_reg_otp');
            return of({ success: true, message: 'Registration OTP verified (demo)' });
          }
        }
        return throwError(() => ({ success: false, message: 'Invalid registration OTP' }));
      })
    );
  }

  sendMobileOTP(mobile: string, type: string = 'registration'): Observable<any> {
    const cleanMobile = mobile.trim();
    return this.http.post<any>(`${this.API_URL}/auth/send-mobile-otp`, {
      mobile: cleanMobile, type: type
    }, this.getHttpOptions()).pipe(
      timeout(15000),
      catchError((error) => {
        if (this.isBrowser) {
          const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
          sessionStorage.setItem('mock_mobile_otp', mockOtp);
          this.showToastMessage(`Test Mobile OTP: ${mockOtp}`, 'info');
          return of({ success: true, message: 'Mobile OTP sent (demo)', mockOtp });
        }
        return throwError(() => ({ success: false, message: 'Failed to send mobile OTP' }));
      })
    );
  }

  verifyMobileOTP(mobile: string, otp: string, type: string = 'registration'): Observable<any> {
    const cleanOtp = otp.trim();
    return this.http.post<any>(`${this.API_URL}/auth/verify-mobile-otp`, {
      mobile: mobile.trim(), otp: cleanOtp, type: type
    }, this.getHttpOptions()).pipe(
      timeout(15000),
      catchError((error) => {
        if (this.isBrowser) {
          const mockStored = sessionStorage.getItem('mock_mobile_otp');
          if (mockStored && cleanOtp === mockStored) {
            sessionStorage.removeItem('mock_mobile_otp');
            return of({ success: true, message: 'Mobile OTP verified (demo)' });
          }
        }
        return throwError(() => ({ success: false, message: 'Invalid mobile OTP' }));
      })
    );
  }

  forgotPasswordOTP(email: string): Observable<any> {
    const cleanEmail = email.trim().toLowerCase();
    // FIX: this was posting to `/auth/forgot-password-otp`, which does not
    // exist anywhere in auth.routes.js — every call silently 404'd and fell
    // through to the demo/mock branch below. The real backend route (see
    // `router.post('/forgot-password', authController.sendForgotPasswordOTP)`
    // in auth.routes.js) is `/auth/forgot-password`. Corrected below.
    return this.http.post<any>(`${this.API_URL}/auth/forgot-password`, {
      email: cleanEmail
    }, this.getHttpOptions()).pipe(
      timeout(15000),
      catchError((error) => {
        if (this.isBrowser) {
          const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
          sessionStorage.setItem('mock_fp_otp', mockOtp);
          this.showToastMessage(`Test Forgot Password OTP: ${mockOtp}`, 'info');
          return of({ success: true, message: 'Reset OTP sent (demo)', mockOtp });
        }
        return throwError(() => ({ success: false, message: 'Failed to send reset OTP' }));
      })
    );
  }

  verifyOTPAndResetPassword(email: string, otp: string, newPassword: string, confirmPassword: string): Observable<any> {
    if (newPassword !== confirmPassword) {
      return throwError(() => ({ success: false, message: 'Passwords do not match' }));
    }
    const cleanOtp = otp.trim();
    // FIX: this was posting to `/auth/verify-otp-reset-password`, which also
    // doesn't exist in auth.routes.js. The real route is `/auth/reset-password`
    // (`router.post('/reset-password', authController.verifyOTPAndResetPassword)`).
    // Corrected below — this was silently falling back to the demo branch too.
    return this.http.post<any>(`${this.API_URL}/auth/reset-password`, {
      email: email.trim().toLowerCase(), otp: cleanOtp, newPassword, confirmPassword
    }, this.getHttpOptions()).pipe(
      timeout(15000),
      catchError((error) => {
        if (this.isBrowser) {
          const mockStored = sessionStorage.getItem('mock_fp_otp');
          if (mockStored && cleanOtp === mockStored) {
            sessionStorage.removeItem('mock_fp_otp');
            return of({ success: true, message: 'Password reset successful (demo)', token: 'mock_reset_token_' + Date.now() });
          }
        }
        return throwError(() => ({ success: false, message: 'Invalid or expired OTP' }));
      })
    );
  }

  forgotPasswordLink(email: string): Observable<any> {
    const cleanEmail = email.trim().toLowerCase();
    return this.http.post<any>(`${this.API_URL}/auth/forgot-password-link`, {
      email: cleanEmail
    }, this.getHttpOptions()).pipe(
      timeout(15000),
      catchError((error) => {
        if (this.isBrowser) {
          const resetToken = 'mock_reset_' + Date.now();
          this.showToastMessage(`Demo: Reset link would be sent to ${email}`, 'info');
          return of({ success: true, message: 'Reset link sent (demo mode)', mockToken: resetToken });
        }
        return throwError(() => ({ success: false, message: 'Failed to send reset link' }));
      })
    );
  }

  resetPasswordWithToken(token: string, newPassword: string, confirmPassword: string): Observable<any> {
    if (newPassword !== confirmPassword) {
      return throwError(() => ({ success: false, message: 'Passwords do not match' }));
    }
    return this.http.post<any>(`${this.API_URL}/auth/reset-password-with-token`, {
      token: token.trim(), newPassword: newPassword.trim(), confirmPassword: confirmPassword.trim()
    }, this.getHttpOptions()).pipe(
      timeout(15000),
      catchError((error) => {
        if (this.isBrowser && token.startsWith('mock_reset_')) {
          return of({ success: true, message: 'Password reset successful (demo)' });
        }
        return throwError(() => ({ success: false, message: 'Invalid or expired reset token' }));
      })
    );
  }

  checkResetToken(token: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/auth/check-reset-token?token=${token}`, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError((error) => {
        if (this.isBrowser && token.startsWith('mock_reset_')) {
          return of({ success: true, isValid: true });
        }
        return of({ success: false, isValid: false });
      })
    );
  }

  forgotPassword(email: string): Observable<any> {
    const body = { email: email.trim().toLowerCase() };
    const paths = ['/auth/forgot-password', '/auth/request-password-reset', '/auth/forgotPassword'];
    const attempt = (i: number): Observable<any> => {
      if (i >= paths.length) return this.forgotPasswordOTP(email);
      return this.http.post<any>(`${this.API_URL}${paths[i]}`, body, this.getHttpOptions()).pipe(
        timeout(10000), catchError(() => attempt(i + 1))
      );
    };
    return attempt(0).pipe(
      catchError(() => {
        if (this.isBrowser) {
          this.showToastMessage(`Demo: Password reset email would be sent to ${email}`, 'info');
          return of({ success: true, message: 'Reset email sent (demo mode)' });
        }
        return throwError(() => ({ success: false, message: 'Password reset failed' }));
      })
    );
  }

  // ==================== EMAIL NOTIFICATION METHODS ====================
  
  sendRfqEmailNotification(rfqData: any, recipients: string[]): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/notifications/rfq-email`, {
      rfqData, recipients, type: 'rfq_created'
    }, this.getHttpOptions()).pipe(
      timeout(15000),
      catchError(() => of({ success: false, message: 'Email notification failed', sent: false }))
    );
  }

  sendPrEmailNotification(prData: any, recipients: string[]): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/notifications/pr-email`, {
      prData, recipients, type: 'pr_created'
    }, this.getHttpOptions()).pipe(
      timeout(15000),
      catchError(() => of({ success: false, message: 'Email notification failed', sent: false }))
    );
  }

  sendPoEmailNotification(poData: any, recipients: string[]): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/notifications/po-email`, {
      poData, recipients, type: 'po_created'
    }, this.getHttpOptions()).pipe(
      timeout(15000),
      catchError(() => of({ success: false, message: 'Email notification failed', sent: false }))
    );
  }

  sendCashPurchaseEmailNotification(purchaseData: any, recipients: string[]): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/notifications/cash-purchase-email`, {
      purchaseData, recipients, type: 'cash_purchase'
    }, this.getHttpOptions()).pipe(
      timeout(15000),
      catchError(() => of({ success: false, message: 'Email notification failed', sent: false }))
    );
  }

  sendApprovalEmailNotification(requestData: any, requestType: string, approvers: string[]): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/notifications/approval-email`, {
      requestData, requestType, approvers, type: 'approval_request'
    }, this.getHttpOptions()).pipe(
      timeout(15000),
      catchError(() => of({ success: false, message: 'Email notification failed', sent: false }))
    );
  }

  testEmail(email: string): Observable<any> {
    return this.http.get(`${this.API_URL}/auth/test-email?email=${email}`, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError((error) => {
        if (this.isBrowser) this.showToastMessage(`Test email would be sent to ${email}`, 'info');
        return of({ success: false, message: 'Email test failed' });
      })
    );
  }

  // ==================== AUTH METHODS ====================

  register(name: string, email: string, password: string, role = 'Manager', mobile?: string, dateOfBirth?: string, mobileVerified = false): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/register`, {
      name: name.trim(), email: email.trim().toLowerCase(), password, role,
      contactNo: mobile || '', dateOfBirth: dateOfBirth || '', mobileVerified
    }, this.getHttpOptions()).pipe(
      tap(res => {
        if (res?.success && res?.token) this.storeAuthSession(res, true);
        if (res?.success && this.isBrowser) {
          this.sendRfqEmailNotification({ email, name }, [email]).subscribe();
        }
      }),
      catchError(this.handleError('Registration'))
    );
  }

  registerWithRights(userData: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/register-with-rights`, {
      ...userData, email: userData.email?.trim().toLowerCase()
    }, this.getHttpOptions()).pipe(catchError(this.handleError('Register with Rights')));
  }

  login(email: string, password: string, rememberMe = false): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/login`, {
      email: email.trim().toLowerCase(), password
    }, this.getHttpOptions()).pipe(
      tap(res => { if (res?.success) this.storeAuthSession(res, rememberMe); }),
      catchError(this.handleError('Login'))
    );
  }

  refreshUserRights(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/auth/me`, this.getHttpOptions()).pipe(
      timeout(8000),
      tap(res => {
        const user = this.normalizeUser(res?.user || res?.data || res);
        if (user) this.persistCurrentUser(user);
      }),
      catchError(this.handleError('Refresh User Rights'))
    );
  }

  refreshAnyUserSession(email: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/refresh-session`, {
      email: email.trim().toLowerCase()
    }, this.getHttpOptions()).pipe(
      tap(res => {
        const currentUser = this.getUser();
        if (currentUser?.email?.toLowerCase() === email.trim().toLowerCase() && res?.user) {
          this.persistCurrentUser(res.user);
          if (res?.token && this.isBrowser) {
            const storage = this.getActiveStorage();
            storage?.setItem(this.TOKEN_KEY, res.token);
          }
        }
      }),
      catchError(this.handleError('Refresh Session'))
    );
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return token ? new HttpHeaders().set('Authorization', `Bearer ${token}`) : new HttpHeaders();
  }

  getLoggedInUser(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/auth/me`, this.getHttpOptions()).pipe(
      timeout(6000),
      tap(res => {
        const user = this.normalizeUser(res?.user || res?.data || res);
        if (user) this.persistCurrentUser(user);
      }),
      catchError(this.handleError('Get Logged In User'))
    );
  }

  private persistFromProfileResponse(res: any, payload?: any): void {
    const merged = { ...this.getUser(), ...(payload || {}) };
    const user = this.normalizeUser(res?.data || res?.user || merged);
    if (user) this.persistCurrentUser(user);
  }

  getProfile(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/auth/me`, this.getHttpOptions()).pipe(
      timeout(10000),
      tap(res => {
        if (res?.success && res.user && this.isBrowser) this.updateLocalUser(res.user);
      }),
      catchError(this.handleError('Get Profile'))
    );
  }

  updateProfile(userId: string, data: any): Observable<any> {
    const { id, _id, ...cleanData } = data;
    return this.http.patch<any>(`${this.API_URL}/auth/profile`, cleanData, this.getHttpOptions()).pipe(
      timeout(10000),
      tap(res => {
        if ((res?.success || res?.data) && this.isBrowser) {
          this.updateLocalUser(res.data || res.user || cleanData);
        }
      }),
      catchError(this.handleError('Update Profile'))
    );
  }

  updatePassword(userId: string, currentPassword: string, newPassword: string): Observable<any> {
    const body = { currentPassword, newPassword, confirmPassword: newPassword };
    return this.http.post<any>(`${this.API_URL}/auth/change-password`, body, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError(this.handleError('Update Password'))
    );
  }

  uploadProfilePhoto(userId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('avatar', file);
    const token = this.getToken();
    let headers = new HttpHeaders();
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return this.http.post(`${this.API_URL}/auth/upload-avatar`, formData, { headers });
  }

  clearProfilePhoto(userId: string): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/auth/avatar`, this.getHttpOptions()).pipe(
      timeout(10000),
      tap(res => { if (res?.success && this.isBrowser) this.updateLocalUser({ profileImage: '', avatar: '' }); }),
      catchError(() => of({ success: true }))
    );
  }

  updateProfileLegacy(userId: string | number, payload: any): Observable<any> {
    const { id, _id, ...cleanPayload } = payload;
    const tapPersist = (res: any) => this.persistFromProfileResponse(res, payload);
    return this.http.patch<any>(`${this.API_URL}/auth/profile`, cleanPayload, this.getHttpOptions()).pipe(
      tap(tapPersist),
      catchError(() => this.http.put<any>(`${this.API_URL}/auth/profile`, cleanPayload, this.getHttpOptions()).pipe(tap(tapPersist))),
      catchError(() => this.http.patch<any>(`${this.API_URL}/auth/me`, payload, this.getHttpOptions()).pipe(tap(tapPersist))),
      catchError(() => this.http.put<any>(`${this.API_URL}/auth/me`, payload, this.getHttpOptions()).pipe(tap(tapPersist))),
      catchError(this.handleError('Update Profile'))
    );
  }

  uploadProfilePhotoLegacy(userId: string | number, file: File, fieldName = 'avatar'): Observable<any> {
    const token = this.getToken();
    let authOnly = new HttpHeaders();
    if (token) authOnly = authOnly.set('Authorization', `Bearer ${token}`);
    const fdAvatar = new FormData();
    fdAvatar.append(fieldName, file);
    fdAvatar.append('profileImage', file);
    const tapPersist = (res: any) => {
      const user = this.normalizeUser(res?.data || res?.user);
      if (user) this.persistCurrentUser(user);
    };
    return this.http.post<any>(`${this.API_URL}/auth/upload-avatar`, fdAvatar, { headers: authOnly }).pipe(
      tap(tapPersist),
      catchError(() => this.http.patch<any>(`${this.API_URL}/auth/profile`, fdAvatar, { headers: authOnly }).pipe(tap(tapPersist))),
      catchError(this.handleError('Upload profile photo'))
    );
  }

  clearProfilePhotoLegacy(userId: string | number): Observable<any> {
    const tapPersist = (res: any) => this.persistFromProfileResponse(res, { avatar: '', profileImage: '' });
    return this.http.delete<any>(`${this.API_URL}/auth/avatar`, this.getHttpOptions()).pipe(
      tap(tapPersist),
      catchError(() => this.http.post<any>(`${this.API_URL}/auth/remove-avatar`, {}, this.getHttpOptions()).pipe(tap(tapPersist))),
      catchError(() => this.http.patch<any>(`${this.API_URL}/auth/me`, { avatar: '', profileImage: '' }, this.getHttpOptions()).pipe(tap(tapPersist))),
      catchError(this.handleError('Remove profile photo'))
    );
  }

  updatePasswordLegacy(userId: string | number, currentPassword: string, newPassword: string): Observable<any> {
    const body = { currentPassword, newPassword, confirmPassword: newPassword };
    return this.http.post<any>(`${this.API_URL}/auth/change-password`, body, this.getHttpOptions()).pipe(
      catchError(() => this.http.patch<any>(`${this.API_URL}/auth/password`, body, this.getHttpOptions())),
      catchError(() => this.http.put<any>(`${this.API_URL}/auth/password`, body, this.getHttpOptions())),
      catchError(() => this.http.post<any>(`${this.API_URL}/auth/change-password`, { oldPassword: currentPassword, newPassword }, this.getHttpOptions())),
      catchError(this.handleError('Update Password'))
    );
  }

  getDashboardData(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/dashboard`, this.getHttpOptions()).pipe(
      timeout(8000),
      catchError(this.handleError('Dashboard Data'))
    );
  }

  getDepartments(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/auth/departments`, this.getHttpOptions()).pipe(
      timeout(8000),
      catchError(() => of({ success: true, departments: ['Purchase', 'IT', 'HR', 'Finance', 'R&D', 'Operations', 'Sales'] }))
    );
  }

  getManagers(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/auth/managers`, this.getHttpOptions()).pipe(
      timeout(8000),
      catchError(() => of({
        managers: [
          { name: 'Vijay Parashar', email: 'vijay.parashar@radiant.com', designation: 'Manager', role: 'Manager' },
          { name: 'Ravib', email: 'ravib@radiant.com', designation: 'A-GM', role: 'A-GM' },
          { name: 'Shailendra Chothe', email: 'shailendra.chothe@radiant.com', designation: 'VP', role: 'VP' },
          { name: 'Sanjay Munshi', email: 'sanjay.munshi@radiant.com', designation: 'S-VP', role: 'S-VP' },
          { name: 'Wang Xianwen', email: 'wang.xianwen@radiant.com', designation: 'GM', role: 'GM' },
          { name: 'Raminder Singh', email: 'raminder.singh@radiant.com', designation: 'MD', role: 'MD' }
        ]
      }))
    );
  }

  getEPRequestsWithFilter(params: any = {}): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/ep-approval`, { ...this.getHttpOptions(), params }).pipe(
      catchError(this.handleError('Get Filtered EP Requests'))
    );
  }

  getAllEPApprovalRequests(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/request`, this.getHttpOptions()).pipe(
      timeout(10000),
      map(res => this.withId(this.asListResponse(res))),
      catchError(this.handleError('EP Approval Requests'))
    );
  }

  createEPRequest(data: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/request`, data, this.getHttpOptions()).pipe(
      tap(res => {
        if (res?.success && data.requesterEmail) {
          this.sendApprovalEmailNotification(data, 'EP', [data.approverEmail]).subscribe();
        }
      }),
      catchError(this.handleError('Create EP Request'))
    );
  }

  updateEPRequest(id: string | number, data: any): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/request/${id}`, data, this.getHttpOptions()).pipe(
      catchError(this.handleError('Update EP Request'))
    );
  }

  deleteEPRequest(id: string | number): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/request/${id}`, this.getHttpOptions()).pipe(
      catchError(this.handleError('Delete EP Request'))
    );
  }

  // ==================== EP APPROVAL WITH FAST LOADER ====================
  // IMPORTANT (added): these call `/request/:id/approve` and `/request/:id/reject`
  // (request.routes.js on your backend), NOT the `approveEPRequest` /
  // `rejectEPRequest` functions shown to me in auth.controller.js (those are
  // wired to `/auth/ep-requests/:id/approve` instead). I fixed the
  // non-blocking-email issue in auth.controller.js, but if EP approve/reject
  // is STILL slow after deploying that fix, the real bottleneck is almost
  // certainly an `await sendMail(...)` inside request.controller.js, which
  // wasn't shared with me. Apply the identical `sendMailNonBlocking` pattern
  // there.

  approveEPRequest(id: string | number, comments = ''): Observable<any> {
    const user = this.getUser();
    const userRole = user?.role || '';
    
    const allowedRoles = ['Admin', 'Manager', 'Senior Manager'];
    if (!allowedRoles.includes(userRole)) {
      this.showToastMessage('You are not authorized to approve this request. Only Admin, Manager, or Senior Manager can approve.', 'error');
      return throwError(() => ({ success: false, message: 'Not authorized' }));
    }
    
    // FIX: removed the artificial `setTimeout(..., 250)` pre-delay that ran
    // before the HTTP call even started — it added latency with no benefit.
    // `ensureMinDuration` now keeps a loader visible for ~2s (tied to whatever
    // loading flag your component sets before calling .subscribe()) without
    // slowing down calls that already take longer than that.
    return this.ensureMinDuration(
      this.http.patch<any>(`${this.API_URL}/request/${id}/approve`, {
        comments, approvedBy: user?.email, approvedByRole: userRole
      }, this.getHttpOptions()).pipe(timeout(15000)),
      2000
    ).pipe(
      tap((res: any) => {
        if (res?.success) {
          this.showToastMessage(`EP Request #${id} approved successfully!`, 'success');
        } else {
          this.showToastMessage(res?.message || 'Approval failed', 'error');
        }
      }),
      catchError((error) => {
        let errorMsg = error?.error?.message || 'Failed to approve EP request';
        if (error?.status === 403) errorMsg = 'You do not have permission to approve this request.';
        this.showToastMessage(errorMsg, 'error');
        return throwError(() => error);
      })
    );
  }

  rejectEPRequest(id: string | number, comments = ''): Observable<any> {
    const user = this.getUser();
    const userRole = user?.role || '';
    
    const allowedRoles = ['Admin', 'Manager', 'Senior Manager'];
    if (!allowedRoles.includes(userRole)) {
      this.showToastMessage('You are not authorized to reject this request.', 'error');
      return throwError(() => ({ success: false, message: 'Not authorized' }));
    }
    
    if (!comments || comments.trim() === '') {
      this.showToastMessage('Rejection remarks are required. Please provide a reason for rejection.', 'warning');
      return throwError(() => ({ success: false, message: 'Remarks required' }));
    }
    
    // FIX: same as approveEPRequest above — dead 250ms pre-delay replaced with
    // the ensureMinDuration loader pattern.
    return this.ensureMinDuration(
      this.http.patch<any>(`${this.API_URL}/request/${id}/reject`, {
        comments, rejectedBy: user?.email, rejectedByRole: userRole
      }, this.getHttpOptions()).pipe(timeout(15000)),
      2000
    ).pipe(
      tap((res: any) => {
        if (res?.success) {
          this.showToastMessage(`EP Request #${id} rejected`, 'info');
        } else {
          this.showToastMessage(res?.message || 'Rejection failed', 'error');
        }
      }),
      catchError((error) => {
        this.showToastMessage(error?.error?.message || 'Failed to reject EP request', 'error');
        return throwError(() => error);
      })
    );
  }

  private showToastMessage(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success'): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }));
    }
    console.log(`[TOAST] ${type.toUpperCase()}: ${message}`);
  }

  getEPRequestFullDetails(id: string | number): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/request/${id}/full`, this.getHttpOptions()).pipe(
      timeout(5000),
      map(res => {
        if (res?.data) {
          return {
            success: true,
            data: {
              ...res.data,
              id: res.data._id || res.data.id,
              canEdit: this.canEditEPRequest(res.data)
            }
          };
        }
        return res;
      }),
      catchError(this.handleError('Get EP Request Details'))
    );
  }

  private canEditEPRequest(request: any): boolean {
    const user = this.getUser();
    const userRole = user?.role || '';
    const userEmail = user?.email || '';
    if (['Admin', 'Manager', 'Senior Manager'].includes(userRole)) return true;
    if (request.requesterEmail === userEmail && request.status === 'Pending') return true;
    return false;
  }

  getEPApprovalStats(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/request/stats`, this.getHttpOptions()).pipe(
      timeout(5000),
      catchError(() => of({ success: true, data: { approved: 0, rejected: 0, pending: 0 } }))
    );
  }

  getApprovedEPRequests(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/request?status=Approved`, this.getHttpOptions()).pipe(
      timeout(5000),
      map(res => this.withId(this.asListResponse(res))),
      catchError(() => of({ success: true, data: [] }))
    );
  }

  // ==================== CERTIFICATE METHODS WITH FAST LOADER ====================

  generateEPCertificate(requestId: string | number, requestData: any): Observable<any> {
    const validRequestId = requestId && requestId !== 'undefined' && requestId !== 'null' && requestId !== '' 
      ? requestId : `temp_${Date.now()}`;
    
    const payload = {
      requestId: validRequestId,
      requestData: {
        ...requestData,
        id: requestData?.id || validRequestId,
        serialNo: requestData?.serialNo || requestData?.uniqueSerialNo || `CERT-${Date.now()}`,
        title: requestData?.title || requestData?.titleOfActivity || 'Certificate',
        generatedAt: new Date().toISOString()
      },
      type: requestData?.type || 'wcc'
    };
    
    // FIX: removed dead 250ms pre-delay, replaced with ensureMinDuration.
    return this.ensureMinDuration(
      this.http.post<any>(`${this.API_URL}/certificates/generate`, payload, this.getHttpOptions()).pipe(timeout(15000)),
      2000
    ).pipe(
      tap((res: any) => {
        if (res?.success) this.showToastMessage('Certificate generated successfully!', 'success');
      }),
      catchError((error) => {
        console.error('Certificate generation error:', error);
        return this.generateLocalCertificate(validRequestId, requestData).pipe(
          tap(() => this.showToastMessage('Certificate generated (demo mode)', 'info'))
        );
      })
    );
  }

  private generateLocalCertificate(requestId: string | number, requestData: any): Observable<any> {
    const certificate = {
      id: `cert-${Date.now()}`,
      certificateId: `cert-${Date.now()}`,
      requestId: requestId,
      generatedAt: new Date().toISOString(),
      url: null,
      data: {
        title: requestData?.title || 'Certificate',
        requester: requestData?.requester || requestData?.requesterName,
        department: requestData?.department,
        approvedDate: new Date().toISOString(),
        certificateNo: `CERT-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`
      }
    };
    
    if (typeof localStorage !== 'undefined') {
      const certs = JSON.parse(localStorage.getItem('ep_certificates') || '[]');
      certs.push(certificate);
      localStorage.setItem('ep_certificates', JSON.stringify(certs));
    }
    
    return of({ success: true, data: certificate, message: 'Certificate generated (demo mode)' });
  }

  getCertificates(requestId: string | number): Observable<any> {
    const validRequestId = requestId && requestId !== 'undefined' && requestId !== 'null' && requestId !== '' 
      ? requestId : '';
      
    return this.http.get<any>(`${this.API_URL}/certificates?requestId=${validRequestId}`, this.getHttpOptions()).pipe(
      timeout(5000),
      catchError(() => {
        if (typeof localStorage !== 'undefined') {
          const certs = JSON.parse(localStorage.getItem('ep_certificates') || '[]');
          const filtered = certs.filter((c: any) => c.requestId == requestId);
          return of({ success: true, data: filtered });
        }
        return of({ success: true, data: [] });
      })
    );
  }

  downloadCertificate(certificateId: string): Observable<Blob> {
    // FIX: removed dead 250ms pre-delay, replaced with ensureMinDuration so the
    // download "loading..." state is visible for ~2s instead of flashing.
    return this.ensureMinDuration(
      this.http.get(`${this.API_URL}/certificates/${certificateId}/download`, {
        ...this.getHttpOptions(),
        responseType: 'blob'
      }).pipe(timeout(15000)),
      2000
    ).pipe(
      tap((blob: Blob) => {
        if (blob && blob.size > 0) {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `certificate_${certificateId}.html`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.showToastMessage('Download started!', 'success');
        } else {
          this.showToastMessage('Download failed: Empty response', 'error');
        }
      }),
      catchError((error) => {
        console.error('Download certificate error:', error);
        const mockPdf = new Blob(['%PDF-1.4\nMock Certificate Content'], { type: 'application/pdf' });
        this.showToastMessage('Demo: Certificate downloaded', 'info');
        return of(mockPdf);
      })
    );
  }

  // ==================== QUOTATION & REPORTS METHODS ====================

  getVendorSuggestions(items: any[]): Observable<any> {
    // FIX: removed dead 250ms pre-delay, replaced with ensureMinDuration.
    return this.ensureMinDuration(
      this.http.post<any>(`${this.API_URL}/quotation/suggestions`, { items }, this.getHttpOptions()).pipe(timeout(8000)),
      2000
    ).pipe(
      catchError(() => {
        const suggestions = [
          { vendorName: 'Steel Corp Ltd', price: 120, rating: 4.5, deliveryTime: '3 days', suggested: true, savings: 0 },
          { vendorName: 'Metal Masters', price: 115, rating: 4.2, deliveryTime: '5 days', suggested: false, savings: 5 },
          { vendorName: 'Prime Steel', price: 125, rating: 4.0, deliveryTime: '2 days', suggested: false, savings: -5 }
        ];
        return of({ success: true, data: suggestions });
      })
    );
  }

  getReportsByType(type: 'ep' | 'rfq' | 'all', dateRange?: { from: string; to: string }): Observable<any> {
    let params: any = { type };
    if (dateRange?.from) params.fromDate = dateRange.from;
    if (dateRange?.to) params.toDate = dateRange.to;
    
    // FIX: removed dead 250ms pre-delay, replaced with ensureMinDuration.
    return this.ensureMinDuration(
      this.http.get<any>(`${this.API_URL}/reports/${type}`, { ...this.getHttpOptions(), params }).pipe(timeout(8000)),
      2000
    ).pipe(
      tap(() => this.showToastMessage('Report generated successfully!', 'success')),
      catchError(() => {
        const mockData = {
          summary: { total: 45, approved: 28, rejected: 5, pending: 12 },
          details: [
            { serialNo: 'EP-20260601-001', title: 'EP Request 1', requester: 'John Doe', status: 'Approved', amount: 5000, date: '2026-06-01' },
            { serialNo: 'EP-20260601-002', title: 'EP Request 2', requester: 'Jane Smith', status: 'Pending', amount: 7500, date: '2026-06-01' }
          ]
        };
        this.showToastMessage('Report generated (demo data)', 'info');
        return of({ success: true, data: mockData });
      })
    );
  }

  notifyAdminsForEPRequest(requestData: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/notifications/ep-request`, requestData, this.getHttpOptions()).pipe(
      timeout(5000),
      catchError(() => {
        this.showToastMessage('Admins notified (demo mode)', 'info');
        return of({ success: true, message: 'Admins notified (demo)' });
      })
    );
  }

  // ==================== VENDOR & PART METHODS ====================

  getVendors(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/vendor`, this.getHttpOptions()).pipe(
      timeout(8000),
      map(res => this.withId(this.asListResponse(res))),
      catchError(this.handleError('Get Vendors'))
    );
  }

  addVendor(data: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/vendor`, data, this.getHttpOptions()).pipe(
      catchError(this.handleError('Add Vendor'))
    );
  }

  updateVendor(id: string | number, data: any): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/vendor/${id}`, data, this.getHttpOptions()).pipe(
      catchError(this.handleError('Update Vendor'))
    );
  }

  deleteVendor(id: string | number): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/vendor/${id}`, this.getHttpOptions()).pipe(
      catchError(this.handleError('Delete Vendor'))
    );
  }

  createTemporaryVendorAccount(data: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/vendor/temporary-account`, data, this.getHttpOptions()).pipe(
      catchError(this.handleError('Create Temporary Vendor Account'))
    );
  }

  deactivateTemporaryVendorAccount(id: string | number, reason = 'Work completed'): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/vendor/temporary-account/${id}/deactivate`, { reason }, this.getHttpOptions()).pipe(
      catchError(this.handleError('Deactivate Temporary Vendor Account'))
    );
  }

  getMyVendorRfqs(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/vendor/dashboard/rfqs`, this.getHttpOptions()).pipe(
      catchError(this.handleError('Get Vendor RFQ Dashboard'))
    );
  }

  getParts(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/part`, this.getHttpOptions()).pipe(
      timeout(8000),
      map(res => this.withId(this.asListResponse(res))),
      catchError(this.handleError('Get Parts'))
    );
  }

  addPart(data: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/part`, data, this.getHttpOptions()).pipe(
      catchError(this.handleError('Add Part'))
    );
  }

  updatePart(id: string | number, data: any): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/part/${id}`, data, this.getHttpOptions()).pipe(
      catchError(this.handleError('Update Part'))
    );
  }

  deletePart(id: string | number): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/part/${id}`, this.getHttpOptions()).pipe(
      catchError(this.handleError('Delete Part'))
    );
  }

  // ==================== RFQ METHODS ====================

  getRFQs(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/rfq`, this.getHttpOptions()).pipe(
      timeout(10000),
      map(res => {
        let data = [];
        if (res?.data && Array.isArray(res.data)) data = res.data;
        else if (Array.isArray(res)) data = res;
        else if (res?.rfqs && Array.isArray(res.rfqs)) data = res.rfqs;

        const mappedData = data.map((item: any) => ({
          ...item,
          id: item._id || item.id,
          title: item.titleOfActivity || item.title,
          requester: item.requesterName || item.requester,
          email: item.emailId || item.email,
          contactNo: item.contactNo,
          organization: item.organization,
          description: item.purposeAndObjective || item.description,
          amount: item.estimatedAmount || item.amount || 0,
          priority: this.mapPriorityFromBackend(item.priority),
          status: this.mapStatusFromBackend(item.status),
          epApprovalStatus: item.epApprovalStatus || 'Pending',
          rfqStatus: item.rfqStatus || item.status || 'Pending',
          currentApprover: item.currentApprover,
          requestDate: item.requestDate || item.createdAt,
          createdAt: item.createdAt
        }));

        return { success: true, data: mappedData, count: mappedData.length };
      }),
      catchError(this.handleError('Get RFQ Requests'))
    );
  }

  getRFQById(id: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/rfq/${id}`, this.getHttpOptions()).pipe(
      timeout(8000),
      catchError(this.handleError('Get RFQ By ID'))
    );
  }

  createRFQ(data: any): Observable<any> {
    console.log('📤 Creating RFQ with payload:', JSON.stringify(data, null, 2));
    
    // FIX: removed dead 250ms pre-delay, replaced with ensureMinDuration so
    // the "creating RFQ..." loader is visible for ~2s before the success/error
    // toast fires, instead of an artificial delay before the call even starts.
    return this.ensureMinDuration(
      this.http.post<any>(`${this.API_URL}/rfq`, data, this.getHttpOptions()).pipe(timeout(20000)),
      2000
    ).pipe(
      tap((res: any) => {
        if (res?.success && data.vendorEmails) {
          this.sendRfqEmailNotification(data, data.vendorEmails).subscribe();
        }
      }),
      catchError((error) => {
        let errorMessage = 'Failed to create RFQ.';
        if (error?.error?.message) errorMessage = error.error.message;
        else if (error?.status === 401) errorMessage = 'Session expired. Please login again.';
        else if (error?.status === 403) errorMessage = 'You do not have permission to create RFQs.';
        this.showToastMessage(errorMessage, 'error');
        return throwError(() => error);
      })
    );
  }

  updateRFQ(id: string | number, data: any): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/rfq/${id}`, data, this.getHttpOptions()).pipe(
      catchError(this.handleError('Update RFQ'))
    );
  }

  deleteRFQ(id: string | number): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/rfq/${id}`, this.getHttpOptions()).pipe(
      catchError(this.handleError('Delete RFQ'))
    );
  }

  approveRFQ(id: string | number, comments = ''): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/rfq/${id}/approve`, { comments }, this.getHttpOptions()).pipe(
      tap(res => {
        if (res?.success && res?.data?.requesterEmail) {
          this.sendRfqEmailNotification({ status: 'approved', comments, id }, [res.data.requesterEmail]).subscribe();
        }
      }),
      catchError(() => this.updateRFQ(id, { status: 'Approved', comments }))
    );
  }

  rejectRFQ(id: string | number, comments = ''): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/rfq/${id}/reject`, { comments }, this.getHttpOptions()).pipe(
      catchError(() => this.updateRFQ(id, { status: 'Rejected', comments }))
    );
  }

  // ==================== NPP PROCUREMENT METHODS ====================
  // IMPORTANT (added): these target `/pr-npp`, `/po-npp`, `/payment-npp` and
  // `/npp-forms/:type` (prNpp.routes.js / poNpp.routes.js / paymentNpp.routes.js
  // / nppForms.routes.js on the backend) — NOT the `/npp/*` or `/auth/npp/*`
  // controller functions shown to me in auth.controller.js / index.js. If
  // these still feel slow after redeploying the backend fixes, the blocking
  // `await sendMail(...)` is almost certainly inside one of those four route
  // files, which weren't shared with me — apply the same
  // `sendMailNonBlocking` pattern there.

  getNppRequests(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/pr-npp`, this.getHttpOptions()).pipe(
      timeout(8000),
      map(res => this.withId(this.asListResponse(res))),
      catchError(() => this.http.get<any>(`${this.API_URL}/npp-procurement`, this.getHttpOptions()).pipe(
        timeout(8000),
        map(res => this.withId(this.asListResponse(res))),
        catchError(this.handleError('Get NPP Requests'))
      ))
    );
  }

  getUnifiedApprovals(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/approvals/unified`, this.getHttpOptions()).pipe(
      timeout(10000),
      map(res => this.withId(this.asListResponse(res))),
      catchError(() => of({ success: true, data: [] }))
    );
  }

  getPrNppRequests(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/pr-npp`, this.getHttpOptions()).pipe(
      timeout(8000),
      map(res => this.withId(this.asListResponse(res))),
      catchError(() => of({ success: true, data: [] }))
    );
  }

  getPoNppRequests(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/po-npp`, this.getHttpOptions()).pipe(
      timeout(8000),
      map(res => this.withId(this.asListResponse(res))),
      catchError(() => of({ success: true, data: [] }))
    );
  }

  getPaymentNppRequests(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/payment-npp`, this.getHttpOptions()).pipe(
      timeout(8000),
      map(res => this.withId(this.asListResponse(res))),
      catchError(() => of({ success: true, data: [] }))
    );
  }

  createNppRequest(data: any): Observable<any> {
    // FIX: removed dead 250ms pre-delay, replaced with ensureMinDuration.
    return this.ensureMinDuration(
      this.http.post<any>(`${this.API_URL}/pr-npp`, data, this.getHttpOptions()).pipe(timeout(20000)),
      2000
    );
  }

  createNppModuleRequest(type: string, data: any): Observable<any> {
    // FIX: removed dead 250ms pre-delay, replaced with ensureMinDuration.
    return this.ensureMinDuration(
      this.http.post<any>(`${this.API_URL}/npp-forms/${type}`, { ...data, type }, this.getHttpOptions()).pipe(timeout(20000)),
      2000
    );
  }

  createNppPrRequest(data: any): Observable<any> {
    console.log('📤 Creating PR NPP request:', data);
    // FIX: removed dead 250ms pre-delay, replaced with ensureMinDuration.
    return this.ensureMinDuration(
      this.http.post<any>(`${this.API_URL}/pr-npp`, data, this.getHttpOptions()).pipe(timeout(20000)),
      2000
    ).pipe(
      catchError((err) => {
        let errorMessage = 'Failed to create PR NPP request.';
        if (err?.error?.message) errorMessage = err.error.message;
        else if (err?.status === 401) errorMessage = 'Session expired. Please login again.';
        this.showToastMessage(errorMessage, 'error');
        return throwError(() => err);
      })
    );
  }

  createNppPoRequest(data: any): Observable<any> {
    console.log('📤 Creating PO NPP request:', data);
    // FIX: removed dead 250ms pre-delay, replaced with ensureMinDuration.
    return this.ensureMinDuration(
      this.http.post<any>(`${this.API_URL}/po-npp`, data, this.getHttpOptions()).pipe(timeout(20000)),
      2000
    ).pipe(
      catchError((err) => {
        let errorMessage = 'Failed to create PO NPP request.';
        if (err?.error?.message) errorMessage = err.error.message;
        else if (err?.status === 401) errorMessage = 'Session expired. Please login again.';
        this.showToastMessage(errorMessage, 'error');
        return throwError(() => err);
      })
    );
  }

  createPaymentAdviceRequest(data: any): Observable<any> {
    console.log('📤 Creating Payment Advice request:', data);
    // FIX: removed dead 250ms pre-delay, replaced with ensureMinDuration.
    return this.ensureMinDuration(
      this.http.post<any>(`${this.API_URL}/payment-npp`, data, this.getHttpOptions()).pipe(timeout(20000)),
      2000
    ).pipe(
      catchError((err) => {
        let errorMessage = 'Failed to create Payment Advice request.';
        if (err?.error?.message) errorMessage = err.error.message;
        else if (err?.status === 401) errorMessage = 'Session expired. Please login again.';
        this.showToastMessage(errorMessage, 'error');
        return throwError(() => err);
      })
    );
  }

  updateNppRequest(id: string | number, data: any): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/pr-npp/${id}`, data, this.getHttpOptions()).pipe(
      catchError(() => this.http.put<any>(`${this.API_URL}/npp-procurement/${id}`, data, this.getHttpOptions())),
      catchError(this.handleError('Update NPP Request'))
    );
  }

  approveNppRequest(id: string | number, comments = ''): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/pr-npp/${id}/approve`, { comments }, this.getHttpOptions()).pipe(
      tap(res => {
        if (res?.success && res?.data?.requesterEmail) {
          this.sendRfqEmailNotification({ status: 'approved', comments, id }, [res.data.requesterEmail]).subscribe();
        }
      }),
      catchError(() => this.http.patch<any>(`${this.API_URL}/npp-procurement/${id}/approve`, { comments }, this.getHttpOptions())),
      catchError(() => this.updateNppRequest(id, { status: 'Approved', comments }))
    );
  }

  approveRequestByType(type: string, id: string | number, comments = ''): Observable<any> {
    const endpoint = this.getApprovalEndpointByType(type);
    return this.http.patch<any>(`${this.API_URL}/${endpoint}/${id}/approve`, { comments }, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError(() => this.http.patch<any>(`${this.API_URL}/approvals/${type}/${id}/approve`, { comments }, this.getHttpOptions())),
      catchError(() => this.updateRequestByType(type, id, { status: 'Approved', comments }))
    );
  }

  rejectNppRequest(id: string | number, comments = ''): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/pr-npp/${id}/reject`, { comments }, this.getHttpOptions()).pipe(
      catchError(() => this.http.patch<any>(`${this.API_URL}/npp-procurement/${id}/reject`, { comments }, this.getHttpOptions())),
      catchError(() => this.updateNppRequest(id, { status: 'Rejected', comments }))
    );
  }

  rejectRequestByType(type: string, id: string | number, comments = ''): Observable<any> {
    const endpoint = this.getApprovalEndpointByType(type);
    return this.http.patch<any>(`${this.API_URL}/${endpoint}/${id}/reject`, { comments }, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError(() => this.http.patch<any>(`${this.API_URL}/approvals/${type}/${id}/reject`, { comments }, this.getHttpOptions())),
      catchError(() => this.updateRequestByType(type, id, { status: 'Rejected', comments }))
    );
  }

  private updateRequestByType(type: string, id: string | number, data: any): Observable<any> {
    const endpoint = this.getApprovalEndpointByType(type);
    return this.http.put<any>(`${this.API_URL}/${endpoint}/${id}`, data, this.getHttpOptions()).pipe(
      catchError(this.handleError('Update Request Status'))
    );
  }

  private getApprovalEndpointByType(type: string): string {
    const endpoints: Record<string, string> = {
      ep: 'request', rfq: 'rfq', pr: 'pr-npp', po: 'po-npp',
      payment: 'payment-npp', wcc: 'npp/request', comparison: 'npp/request', npp: 'npp/request'
    };
    return endpoints[type] || 'npp/request';
  }

  // ==================== USER MANAGEMENT METHODS ====================

  createUser(userData: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/users`, userData, this.getHttpOptions()).pipe(
      tap(res => {
        if (res?.success && userData.email) {
          this.sendRfqEmailNotification({ type: 'welcome', userData }, [userData.email]).subscribe();
        }
      }),
      catchError(this.handleError('Create User'))
    );
  }

  getAllUsers(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/users`, this.getHttpOptions()).pipe(
      catchError(this.handleError('Get Users'))
    );
  }

  updateUserRights(userId: string | number, rights: any): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/users/${userId}/rights`, { rights }, this.getHttpOptions()).pipe(
      catchError(this.handleError('Update User Rights'))
    );
  }

  getUserRightsRequests(): Observable<any> {
    return this.getModuleAccessRequests();
  }

  requestModuleAccess(message: string, moduleId = '', moduleName = ''): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/users/access-request`, { message, moduleId, moduleName }, this.getHttpOptions()).pipe(
      tap(res => {
        if (res?.data) {
          const current = this.getUser();
          if (current) this.updateLocalUser({ ...current, accessRequest: res.data.accessRequest });
        }
      }),
      catchError(this.handleError('Request Module Access'))
    );
  }

  getModuleAccessRequests(status = 'pending'): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/users/access-requests`, {
      ...this.getHttpOptions(),
      params: { status }
    }).pipe(
      catchError(this.handleError('Get Module Access Requests'))
    );
  }

  reviewModuleAccessRequest(userId: string | number, action: 'grant' | 'reject', comments = ''): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/users/access-requests/${userId}`, {
      action, comments
    }, this.getHttpOptions()).pipe(
      tap(res => {
        if (res?.success && res?.data?.email) {
          this.sendRfqEmailNotification({ type: 'access_request', action, comments }, [res.data.email]).subscribe();
        }
      }),
      catchError(this.handleError('Review Module Access Request'))
    );
  }

  // ==================== REPORTS METHODS ====================

  getReports(fromDate?: string, toDate?: string, type?: string, search?: string): Observable<any> {
    let params: any = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (type && type !== 'all') params.type = type;
    if (search) params.search = search;

    return this.http.get<any>(`${this.API_URL}/reports/generate`, { ...this.getHttpOptions(), params }).pipe(
      timeout(15000),
      map(res => res || { success: true, data: { summary: {}, details: [] } }),
      catchError(() => of({ success: true, data: { summary: {}, details: [] }, message: 'Using local data' })),
      catchError(this.handleError('Get Reports'))
    );
  }

  searchNppForms(query: { serialNo?: string; rfqNo?: string; q?: string; type?: string; status?: string }): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/npp-forms/search`, {
      ...this.getHttpOptions(),
      params: query as any
    }).pipe(
      timeout(10000),
      catchError(() => of({ success: true, data: [] }))
    );
  }

  getNppFormBySerial(serialNo: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/npp-forms/serial/${encodeURIComponent(serialNo)}`, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError(this.handleError('Get NPP Form by Serial'))
    );
  }

  getNppFormsByRfqNo(rfqNo: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/npp-forms/rfq/${encodeURIComponent(rfqNo)}`, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError(this.handleError('Get NPP Forms by RFQ'))
    );
  }

  exportReportToCSV(fromDate?: string, toDate?: string, type?: string): Observable<Blob> {
    let params: any = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (type && type !== 'all') params.type = type;

    return this.http.get(`${this.API_URL}/reports/export`, {
      ...this.getHttpOptions(),
      params,
      responseType: 'blob'
    }).pipe(
      timeout(30000),
      catchError(this.handleError('Export Report'))
    );
  }

  // ==================== ORDER HISTORY METHODS ====================

  getOrderHistory(userId?: string, type?: string): Observable<any> {
    let params: any = {};
    if (userId) params.userId = userId;
    if (type) params.type = type;

    return this.http.get<any>(`${this.API_URL}/order-history`, { ...this.getHttpOptions(), params }).pipe(
      timeout(10000),
      map(res => this.asListResponse(res)),
      catchError(() => of({ success: true, data: [] })),
      catchError(this.handleError('Get Order History'))
    );
  }

  saveOrderHistory(data: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/order-history`, data, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError(() => {
        if (this.isBrowser) {
          const existing = localStorage.getItem('order_history');
          const history = existing ? JSON.parse(existing) : [];
          history.unshift({ ...data, savedAt: new Date().toISOString() });
          localStorage.setItem('order_history', JSON.stringify(history.slice(0, 100)));
        }
        return of({ success: true, message: 'Saved locally' });
      }),
      catchError(this.handleError('Save Order History'))
    );
  }

  // ==================== RFQ ITEMS METHODS ====================

  getRfqItems(rfqId: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/rfq/${rfqId}/items`, this.getHttpOptions()).pipe(
      timeout(8000),
      map(res => this.asListResponse(res)),
      catchError(this.handleError('Get RFQ Items'))
    );
  }

  addRfqItem(rfqId: string, item: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/rfq/${rfqId}/items`, item, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError(this.handleError('Add RFQ Item'))
    );
  }

  updateRfqItem(rfqId: string, itemId: string, item: any): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/rfq/${rfqId}/items/${itemId}`, item, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError(this.handleError('Update RFQ Item'))
    );
  }

  deleteRfqItem(rfqId: string, itemId: string): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/rfq/${rfqId}/items/${itemId}`, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError(this.handleError('Delete RFQ Item'))
    );
  }

  // ==================== UPLOAD PICTURES METHODS ====================

  uploadRfqItemPicture(rfqId: string, itemId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('picture', file);
    const token = this.getToken();
    let headers = new HttpHeaders();
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(`${this.API_URL}/rfq/${rfqId}/items/${itemId}/picture`, formData, { headers }).pipe(
      timeout(30000),
      catchError(this.handleError('Upload Picture'))
    );
  }

  // ==================== EXCEL IMPORT/EXPORT METHODS ====================

  importRfqFromExcel(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    const token = this.getToken();
    let headers = new HttpHeaders();
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(`${this.API_URL}/rfq/import-excel`, formData, { headers }).pipe(
      timeout(60000),
      catchError(this.handleError('Import Excel'))
    );
  }

  exportRfqToExcel(rfqId?: string): Observable<Blob> {
    let url = `${this.API_URL}/rfq/export-excel`;
    if (rfqId) url += `?rfqId=${rfqId}`;
    return this.http.get(url, { ...this.getHttpOptions(), responseType: 'blob' }).pipe(
      timeout(30000),
      catchError(this.handleError('Export Excel'))
    );
  }

  downloadRfqExcelTemplate(): Observable<Blob> {
    return this.http.get(`${this.API_URL}/rfq/download-template`, {
      ...this.getHttpOptions(),
      responseType: 'blob'
    }).pipe(
      timeout(15000),
      catchError(() => {
        const csvContent = 'Item Description,UOM,Quantity,Make,Alternative,Vendor Ref,Remark\nSample Item 1,PCS,10,Make A,Alt B,REF001,Test remark\nSample Item 2,KG,5,Make C,Alt D,REF002,Test remark 2';
        return of(new Blob([csvContent], { type: 'text/csv' }));
      }),
      catchError(this.handleError('Download Template'))
    );
  }

  // ==================== PART MASTER METHODS ====================

  searchParts(searchTerm: string, category?: string): Observable<any> {
    let params: any = { search: searchTerm };
    if (category) params.category = category;
    return this.http.get<any>(`${this.API_URL}/parts/search`, { ...this.getHttpOptions(), params }).pipe(
      timeout(8000),
      map(res => this.asListResponse(res)),
      catchError(this.handleError('Search Parts'))
    );
  }

  getPartByCode(partCode: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/parts/code/${partCode}`, this.getHttpOptions()).pipe(
      timeout(8000),
      catchError(this.handleError('Get Part By Code'))
    );
  }

  // ==================== VENDOR MASTER METHODS ====================

  searchVendors(searchTerm: string, category?: string): Observable<any> {
    let params: any = { search: searchTerm };
    if (category) params.category = category;
    return this.http.get<any>(`${this.API_URL}/vendors/search`, { ...this.getHttpOptions(), params }).pipe(
      timeout(8000),
      map(res => this.asListResponse(res)),
      catchError(this.handleError('Search Vendors'))
    );
  }

  getVendorByCode(vendorCode: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/vendors/code/${vendorCode}`, this.getHttpOptions()).pipe(
      timeout(8000),
      catchError(this.handleError('Get Vendor By Code'))
    );
  }

  // ==================== APPROVAL WORKFLOW METHODS ====================

  getApprovalWorkflow(requestId: string, type: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/approvals/${type}/${requestId}/workflow`, this.getHttpOptions()).pipe(
      timeout(8000),
      map(res => this.asListResponse(res)),
      catchError(this.handleError('Get Approval Workflow'))
    );
  }

  updateApprovalStatus(requestId: string, type: string, approverId: string, status: string, comments?: string): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/approvals/${type}/${requestId}/approvers/${approverId}`,
      { status, comments }, this.getHttpOptions()
    ).pipe(
      timeout(10000),
      tap(res => {
        if (res?.success && res?.data?.requesterEmail) {
          this.sendRfqEmailNotification({ type, status, comments, requestId }, [res.data.requesterEmail]).subscribe();
        }
      }),
      catchError(this.handleError('Update Approval Status'))
    );
  }

  // ==================== SERIAL NUMBER METHODS ====================

  generateSerialNumber(type: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/serial-number/${type}`, this.getHttpOptions()).pipe(
      timeout(5000),
      catchError(() => {
        const prefix = type === 'rfq' ? 'RFQ' : type === 'pr' ? 'PR' : type === 'po' ? 'PO' : 'PAY';
        const date = new Date();
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return of({ success: true, serialNumber: `${prefix}-${year}${month}${day}-${random}` });
      }),
      catchError(this.handleError('Generate Serial Number'))
    );
  }

  validateSerialNumber(serialNumber: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/serial-number/validate/${serialNumber}`, this.getHttpOptions()).pipe(
      timeout(5000),
      catchError(() => {
        const isValid = serialNumber.length > 5;
        return of({ success: true, isValid, exists: false });
      }),
      catchError(this.handleError('Validate Serial Number'))
    );
  }

  // ==================== SERIAL NUMBER SEARCH METHODS ====================

  searchBySerialNumber(serialNumber: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/search/serial/${serialNumber}`, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Search by serial number error:', error);
        return of({ success: false, message: error.error?.message || 'Search failed' });
      })
    );
  }

  getAllSerialNumbers(type?: string): Observable<any> {
    let url = `${this.API_URL}/search/serials`;
    if (type && type !== 'all') url += `?type=${type}`;
    return this.http.get<any>(url, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Get all serial numbers error:', error);
        return of({ success: true, data: [] });
      })
    );
  }

  getRequestBySerialNumber(serialNumber: string, type: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/${type}/serial/${serialNumber}`, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Get request by serial number error:', error);
        return of({ success: false, message: error.error?.message || 'Request failed' });
      })
    );
  }

  reuseRequestData(serialNumber: string, targetType: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/reuse/serial/${serialNumber}`, { targetType }, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Reuse request data error:', error);
        return of({ success: false, message: error.error?.message || 'Reuse failed' });
      })
    );
  }

  getRFQBySerial(serialNumber: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/rfq/serial/${serialNumber}`, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Get RFQ by serial error:', error);
        return of({ success: false, message: error.error?.message || 'RFQ not found' });
      })
    );
  }

  getPRBySerial(serialNumber: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/pr-npp/serial/${serialNumber}`, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Get PR by serial error:', error);
        return of({ success: false, message: error.error?.message || 'PR not found' });
      })
    );
  }

  getPOBySerial(serialNumber: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/po-npp/serial/${serialNumber}`, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Get PO by serial error:', error);
        return of({ success: false, message: error.error?.message || 'PO not found' });
      })
    );
  }

  getPaymentBySerial(serialNumber: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/payment-npp/serial/${serialNumber}`, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Get Payment by serial error:', error);
        return of({ success: false, message: error.error?.message || 'Payment not found' });
      })
    );
  }

  getEPBySerial(serialNumber: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/request/serial/${serialNumber}`, this.getHttpOptions()).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Get EP by serial error:', error);
        return of({ success: false, message: error.error?.message || 'EP request not found' });
      })
    );
  }

  // ==================== REQUEST TO VENDOR (PREFILL) METHODS ====================

  getApprovedRfqBySerial(serialNumber: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/rfq/serial/${serialNumber}`, this.getHttpOptions()).pipe(
      timeout(10000),
      map(res => {
        if (res?.data) {
          return {
            success: true,
            data: {
              ...res.data,
              id: res.data._id || res.data.id,
              title: res.data.titleOfActivity || res.data.title,
              vendor: res.data.vendorName || res.data.vendor,
              items: res.data.items || []
            }
          };
        }
        return res;
      }),
      catchError(() => {
        if (this.isBrowser) {
          const history = localStorage.getItem('order_history');
          if (history) {
            const orders = JSON.parse(history);
            const found = orders.find((o: any) => o.uniqueSerialNo === serialNumber);
            if (found) {
              return of({ success: true, data: found.data, fromCache: true });
            }
          }
        }
        return throwError(() => ({ message: 'RFQ serial number not found or not approved', status: 404 }));
      }),
      catchError(this.handleError('Get Approved RFQ'))
    );
  }

  // ==================== SOCIAL LOGIN METHODS ====================

  googleLogin(credential: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/google`, { credential }, this.getHttpOptions()).pipe(
      timeout(15000),
      tap(res => { if (res?.success && res?.token) this.storeAuthSession(res, true); }),
      catchError(this.handleError('Google Login'))
    );
  }

  googleLoginWithIdToken(idToken: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/google-idtoken`, { idToken }, this.getHttpOptions()).pipe(
      timeout(15000),
      tap(res => { if (res?.success && res?.token) this.storeAuthSession(res, true); }),
      catchError(this.handleError('Google Login'))
    );
  }

  facebookLogin(accessToken: string, userID: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/facebook`, { accessToken, userID }, this.getHttpOptions()).pipe(
      timeout(15000),
      tap(res => { if (res?.success && res?.token) this.storeAuthSession(res, true); }),
      catchError(this.handleError('Facebook Login'))
    );
  }

  facebookLoginWithData(facebookData: { id: string; email: string; name: string; picture?: string }): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/facebook-data`, facebookData, this.getHttpOptions()).pipe(
      timeout(15000),
      tap(res => { if (res?.success && res?.token) this.storeAuthSession(res, true); }),
      catchError(this.handleError('Facebook Login'))
    );
  }

  getTwitterRequestToken(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/auth/twitter/request-token`, this.getHttpOptions()).pipe(
      timeout(15000),
      catchError(this.handleError('Get Twitter Request Token'))
    );
  }

  twitterLogin(oauthToken: string, oauthVerifier: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/twitter`, { oauthToken, oauthVerifier }, this.getHttpOptions()).pipe(
      timeout(15000),
      tap(res => { if (res?.success && res?.token) this.storeAuthSession(res, true); }),
      catchError(this.handleError('Twitter Login'))
    );
  }

  twitterOAuth2Login(accessToken: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/twitter-oauth2`, { accessToken }, this.getHttpOptions()).pipe(
      timeout(15000),
      tap(res => { if (res?.success && res?.token) this.storeAuthSession(res, true); }),
      catchError(this.handleError('Twitter OAuth2 Login'))
    );
  }

  // ==================== ERROR HANDLER ====================

  private handleError(operation: string) {
    return (error: HttpErrorResponse) => {
      let message = `${operation} failed.`;
      if (error.error?.message) {
        message = error.error.message;
      } else if (error.status === 0) {
        message = `Cannot connect to server at ${this.API_URL}. Please check if backend is running.`;
        console.error('🔴 CONNECTION ERROR:', { operation, url: error.url, apiUrl: this.API_URL, status: error.status, message: error.message });
      } else if (error.status === 401) {
        message = 'Access denied. Please login again.';
      } else if (error.status === 404) {
        message = `${operation} endpoint was not found at ${this.API_URL}.`;
      } else if (error.status === 500) {
        message = `Server error while trying to ${operation.toLowerCase()}.`;
      }
      this.showToastMessage(message, 'error');
      return throwError(() => ({ message, status: error.status, originalError: error, url: error.url }));
    };
  }

  // ==================== PUBLIC GETTER METHODS ====================

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(this.TOKEN_KEY) || sessionStorage.getItem(this.TOKEN_KEY);
  }

  getUser(): any {
    if (!this.isBrowser) return null;
    const raw = localStorage.getItem(this.USER_KEY) || sessionStorage.getItem(this.USER_KEY) ||
                 localStorage.getItem(this.CURRENT_USER_KEY) || sessionStorage.getItem(this.CURRENT_USER_KEY);
    if (!raw) return null;
    try {
      return this.normalizeUser(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  getUserRights(): any {
    return this.getUser()?.rights || {};
  }

  hasRight(rightName: string): boolean {
    return this.getUserRights()[rightName] === true;
  }

  getUserRole(): string {
    return this.getUser()?.role || 'User';
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getRememberedEmail(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(this.REMEMBER_EMAIL_KEY);
  }

  getStatusSummary(type: string = 'all'): Observable<any> {
    const url = type && type !== 'all'
      ? `${this.API_URL}/approvals/status-summary/${type}`
      : `${this.API_URL}/approvals/status-summary/all`;
    return this.http.get<any>(url, this.getHttpOptions()).pipe(
      timeout(8000),
      catchError(() => of({ success: true, data: { approved: 0, pending: 0, rejected: 0, inProcess: 0, total: 0 } }))
    );
  }

  getPrComparison(prId: string): Observable<any> {
    const id = encodeURIComponent(prId || 'latest');
    return this.http.get<any>(`${this.API_URL}/pr/${id}/comparison`, this.getHttpOptions()).pipe(
      timeout(15000),
      catchError(() => of({ success: true, items: [], recommendedVendor: null }))
    );
  }

  getQuotationComparisonAuto(rfqNo?: string): Observable<any> {
    const params: any = {};
    if (rfqNo) params.rfqNo = rfqNo;
    return this.http.get<any>(`${this.API_URL}/npp-forms/quotation-comparison/auto`, {
      ...this.getHttpOptions(),
      params
    }).pipe(
      timeout(15000),
      catchError(() => this.searchNppForms({ type: 'quotation-comparison', status: 'Submitted' }))
    );
  }

  bulkApproveRequests(ids: string[], type: string, comments = ''): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/approvals/bulk-action`, {
      ids, action: 'approve', type, comments
    }, this.getHttpOptions()).pipe(catchError(this.handleError('Bulk Approve')));
  }

  bulkRejectRequests(ids: string[], type: string, comments = ''): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/approvals/bulk-action`, {
      ids, action: 'reject', type, comments
    }, this.getHttpOptions()).pipe(catchError(this.handleError('Bulk Reject')));
  }

  approveUnifiedRequest(type: string, id: string, comments = ''): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/approvals/${type}/${id}/approve`, { comments }, this.getHttpOptions()).pipe(
      catchError(this.handleError('Approve Request'))
    );
  }

  rejectUnifiedRequest(type: string, id: string, comments = ''): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/approvals/${type}/${id}/reject`, { comments }, this.getHttpOptions()).pipe(
      catchError(this.handleError('Reject Request'))
    );
  }

  getDashboardNotifications(): Observable<any> {
    return this.getUnifiedApprovals().pipe(
      map((res: any) => {
        const rows = res?.data || [];
        return rows.slice(0, 8).map((r: any) => ({
          icon: r.status === 'Approved' ? '✅' : r.status === 'Rejected' ? '❌' : '⏳',
          text: `${this.getRequestTypeLabel(r.type)} ${r.serialNo || r.uniqueSerialNo || ''}`.trim(),
          time: r.requestDate || r.createdAt || '',
          type: (r.status || 'pending').toLowerCase(),
          color: r.status === 'Approved' ? '#10b981' : r.status === 'Rejected' ? '#ef4444' : '#f59e0b'
        }));
      }),
      catchError(() => of([]))
    );
  }

  private getRequestTypeLabel(type: string): string {
    const map: Record<string, string> = {
      ep: 'EP Approval', rfq: 'RFQ', pr: 'PR', po: 'PO', payment: 'Payment', wcc: 'WCC', comparison: 'Quotation'
    };
    return map[type] || String(type || 'Request').toUpperCase();
  }

  // ==================== NOTIFICATIONS METHODS ====================

  getNotifications(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/notifications`, this.getHttpOptions()).pipe(
      timeout(8000),
      catchError(() => of({ success: true, data: [] }))
    );
  }

  markNotificationRead(notificationId: string): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/notifications/${notificationId}/read`, {}, this.getHttpOptions()).pipe(
      timeout(5000),
      catchError(() => of({ success: true }))
    );
  }

  markAllNotificationsRead(): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/notifications/read-all`, {}, this.getHttpOptions()).pipe(
      timeout(5000),
      catchError(() => of({ success: true }))
    );
  }

  // ==================== VENDOR DASHBOARD METHODS ====================

  getVendorBids(vendorId: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/vendor/${vendorId}/bids`, this.getHttpOptions()).pipe(
      timeout(8000),
      catchError(() => of({ success: true, data: [] }))
    );
  }

  getVendorNotifications(vendorId: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/vendor/${vendorId}/notifications`, this.getHttpOptions()).pipe(
      timeout(8000),
      catchError(() => of({ success: true, data: [] }))
    );
  }

  getVendorActivities(vendorId: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/vendor/${vendorId}/activities`, this.getHttpOptions()).pipe(
      timeout(8000),
      catchError(() => of({ success: true, data: [] }))
    );
  }

  logout(): void {
    if (!this.isBrowser) return;
    [this.TOKEN_KEY, this.USER_KEY, this.CURRENT_USER_KEY].forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }
}