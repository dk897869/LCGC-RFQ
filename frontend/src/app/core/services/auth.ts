import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of, tap, throwError, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'user_data';
  private readonly CURRENT_USER_KEY = 'currentUser';
  private readonly REMEMBER_EMAIL_KEY = 'remembered_email';

  /** Base API path, e.g. `https://host/api` — no trailing slash */
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

  /** Avoid showing a Mongo ObjectId in the email field when the API mis-maps fields */
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

  // ✅ Made public so components can update local user data
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

  /** Pull array payloads from common API shapes ({ data }, { rfqs }, raw array, …). */
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

  // ==================== NEW HELPER METHODS FOR RFQ ====================
  
  /** Map backend priority to frontend display */
  private mapPriorityFromBackend(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      'H': 'High',
      'M': 'Medium',
      'L': 'Low',
      'High': 'High',
      'Medium': 'Medium',
      'Low': 'Low'
    };
    return priorityMap[priority] || 'Medium';
  }

  /** Map backend status to frontend display */
  private mapStatusFromBackend(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Open': 'Pending',
      'In-Process': 'In Process',
      'Approved': 'Approved',
      'Rejected': 'Rejected',
      'Pending': 'Pending',
      'In Process': 'In Process'
    };
    return statusMap[status] || 'Pending';
  }

  /** Map frontend priority to backend format */
  public mapPriorityToBackend(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      'High': 'H',
      'Medium': 'M',
      'Low': 'L',
      'Urgent': 'H'
    };
    return priorityMap[priority] || 'M';
  }

  // ==================== END NEW HELPER METHODS ====================

  register(name: string, email: string, password: string, role = 'Manager', mobile?: string, dateOfBirth?: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/register`, {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role,
      contactNo: mobile || '',
      dateOfBirth: dateOfBirth || ''
    }).pipe(
      tap(res => console.log('Register success:', res)),
      catchError(this.handleError('Registration'))
    );
  }

  registerWithRights(userData: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/register-with-rights`, {
      ...userData,
      email: userData.email?.trim().toLowerCase()
    }).pipe(catchError(this.handleError('Register with Rights')));
  }

  sendRegistrationOTP(email: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/send-registration-otp`, {
      email: email.trim().toLowerCase()
    }).pipe(catchError(this.handleError('Send Registration OTP')));
  }

  verifyRegistrationOTP(email: string, otp: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/verify-registration-otp`, {
      email: email.trim().toLowerCase(),
      otp: otp.trim()
    }).pipe(catchError(this.handleError('Verify Registration OTP')));
  }

  sendOTP(email: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/send-otp`, {
      email: email.trim().toLowerCase()
    }).pipe(catchError(this.handleError('Send OTP')));
  }

  sendSMSOTP(mobile: string, type = 'login'): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/send-sms-otp`, {
      mobile: mobile.trim(),
      type
    }).pipe(catchError(this.handleError('Send SMS OTP')));
  }

  verifyOTP(identifier: string, otp: string, method = 'email', type = 'login'): Observable<any> {
    const body: any = { otp: otp.trim(), method, type };
    if (method === 'email') body.email = identifier.trim().toLowerCase();
    else body.mobile = identifier.trim();

    return this.http.post<any>(`${this.API_URL}/auth/verify-otp`, body).pipe(
      tap(res => {
        if (res?.success && res?.token) {
          this.storeAuthSession(res, true);
        }
      }),
      catchError(this.handleError('Verify OTP'))
    );
  }

  verifyOTPAndLogin(email: string, otp: string, rememberMe = false): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/verify-otp`, {
      email: email.trim().toLowerCase(),
      otp: otp.trim()
    }).pipe(
      tap(res => {
        if (res?.success) this.storeAuthSession(res, rememberMe);
      }),
      catchError(this.handleError('Verify OTP'))
    );
  }

  login(email: string, password: string, rememberMe = false): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/login`, {
      email: email.trim().toLowerCase(),
      password
    }).pipe(
      tap(res => {
        if (res?.success) this.storeAuthSession(res, rememberMe);
      }),
      catchError(this.handleError('Login'))
    );
  }

  /** Try several backend route names — deployed APIs vary */
  forgotPassword(email: string): Observable<any> {
    const body = { email: email.trim().toLowerCase() };
    const paths = ['/auth/forgot-password', '/auth/request-password-reset', '/auth/forgotPassword'];
    const attempt = (i: number): Observable<any> => {
      if (i >= paths.length) {
        return throwError(() => ({ message: 'Password reset email is not configured on this server.' }));
      }
      return this.http.post<any>(`${this.API_URL}${paths[i]}`, body).pipe(
        catchError(() => attempt(i + 1))
      );
    };
    return attempt(0).pipe(catchError(this.handleError('Forgot Password')));
  }

  resetPasswordWithToken(token: string, newPassword: string): Observable<any> {
    const h = new HttpHeaders().set('Content-Type', 'application/json');
    const tryPost = (url: string, body: object) =>
      this.http.post<any>(`${this.API_URL}${url}`, body, { headers: h });

    return tryPost('/auth/reset-password', { token, newPassword }).pipe(
      catchError(() => tryPost('/auth/reset-password', { token, password: newPassword })),
      catchError(() => tryPost('/auth/reset-password', { resetToken: token, newPassword })),
      catchError(this.handleError('Reset Password'))
    );
  }

  refreshUserRights(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/auth/me`, { headers: this.getAuthHeaders() }).pipe(
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
    }, { headers: this.getAuthHeaders() }).pipe(
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
    return this.http.get<any>(`${this.API_URL}/auth/me`, { headers: this.getAuthHeaders() }).pipe(
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

  // ✅ FIXED: Uses GET /auth/me for profile (since /auth/profile doesn't exist)
  getProfile(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/auth/me`, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      tap(res => {
        if (res?.success && res.user && this.isBrowser) {
          this.updateLocalUser(res.user);
        }
      }),
      catchError(this.handleError('Get Profile'))
    );
  }

  // ✅ FIXED: Uses PATCH /api/users/:id (since /auth/profile doesn't exist)
  updateProfile(userId: string, data: any): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/users/${userId}`, data, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      tap(res => {
        if ((res?.success || res?.data) && this.isBrowser) {
          this.updateLocalUser(res.data || res.user || data);
        }
      }),
      catchError(this.handleError('Update Profile'))
    );
  }

  // ✅ FIXED: Uses POST /api/auth/change-password (if available) or fallback
  updatePassword(userId: string, currentPassword: string, newPassword: string): Observable<any> {
    const body = { currentPassword, newPassword, confirmPassword: newPassword };
    const headers = this.getAuthHeaders();
    const userScopedBody = { ...body, userId };

    return this.http.post<any>(`${this.API_URL}/auth/change-password`, body, { headers }).pipe(
      timeout(10000),
      catchError(() => this.http.post<any>(`${this.API_URL}/auth/change-password`, userScopedBody, { headers }).pipe(timeout(10000))),
      catchError(() => this.http.patch<any>(`${this.API_URL}/users/${userId}/password`, body, { headers }).pipe(timeout(10000))),
      catchError(() => this.http.post<any>(`${this.API_URL}/users/${userId}/change-password`, body, { headers }).pipe(timeout(10000))),
      catchError(() => this.http.patch<any>(`${this.API_URL}/auth/password`, body, { headers }).pipe(timeout(10000))),
      catchError(this.handleError('Update Password'))
    );
  }

  // ✅ FIXED: Uses POST /api/users/:id/avatar for upload (since /auth/upload-avatar doesn't exist)
  uploadProfilePhoto(userId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('profileImage', file);
    formData.append('photo', file);
    formData.append('image', file);
    const headers = new HttpHeaders().set('Authorization', `Bearer ${this.getToken() || ''}`);

    const tapUpdate = (payload: any) => {
      if (!payload) return;
      const img = payload.profileImage || payload.avatar || payload.photo || payload.data?.profileImage || payload.data?.avatar || '';
      if (img) this.updateLocalUser({ profileImage: img, avatar: img, photo: img });
    };

    return this.http.post<any>(`${this.API_URL}/users/${userId}/avatar`, formData, { headers }).pipe(
      timeout(30000),
      tap(tapUpdate),
      catchError(() => this.http.post<any>(`${this.API_URL}/users/${userId}/upload-avatar`, formData, { headers }).pipe(timeout(30000), tap(tapUpdate))),
      catchError(() => this.http.post<any>(`${this.API_URL}/auth/upload-avatar`, formData, { headers }).pipe(timeout(30000), tap(tapUpdate))),
      catchError(() => this.http.patch<any>(`${this.API_URL}/users/${userId}`, formData, { headers }).pipe(timeout(30000), tap(tapUpdate))),
      catchError(this.handleError('Upload Photo'))
    );
  }

  // ✅ FIXED: Uses PATCH /api/users/:id to clear avatar
  clearProfilePhoto(userId: string): Observable<any> {
    const data = { avatar: '', profileImage: '', photo: '' };
    return this.http.patch<any>(`${this.API_URL}/users/${userId}`, data, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      tap(res => { 
        if (res?.success && this.isBrowser) {
          this.updateLocalUser({ profileImage: '', avatar: '' });
        }
      }),
      catchError(() => of({ success: true }))
    );
  }

  /** Profile JSON update: prefer `/users/:id` routes */
  updateProfileLegacy(userId: string | number, payload: any): Observable<any> {
    const h = this.getAuthHeaders();
    const tapPersist = (res: any) => this.persistFromProfileResponse(res, payload);

    return this.http.patch<any>(`${this.API_URL}/users/${userId}`, payload, { headers: h }).pipe(
      tap(tapPersist),
      catchError(() =>
        this.http.put<any>(`${this.API_URL}/users/${userId}`, payload, { headers: h }).pipe(tap(tapPersist))
      ),
      catchError(() =>
        this.http.patch<any>(`${this.API_URL}/auth/me`, payload, { headers: h }).pipe(tap(tapPersist))
      ),
      catchError(() =>
        this.http.put<any>(`${this.API_URL}/auth/me`, payload, { headers: h }).pipe(tap(tapPersist))
      ),
      catchError(this.handleError('Update Profile'))
    );
  }

  /** Profile image upload (multipart). Tries dedicated upload routes */
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

    return this.http.post<any>(`${this.API_URL}/users/${userId}/avatar`, fdAvatar, { headers: authOnly }).pipe(
      tap(tapPersist),
      catchError(() =>
        this.http.patch<any>(`${this.API_URL}/users/${userId}`, fdAvatar, { headers: authOnly }).pipe(tap(tapPersist))
      ),
      catchError(() =>
        this.http.post<any>(`${this.API_URL}/auth/upload-avatar`, fdAvatar, { headers: authOnly }).pipe(tap(tapPersist))
      ),
      catchError(() =>
        this.http.patch<any>(`${this.API_URL}/auth/profile`, fdAvatar, { headers: authOnly }).pipe(tap(tapPersist))
      ),
      catchError(this.handleError('Upload profile photo'))
    );
  }

  clearProfilePhotoLegacy(userId: string | number): Observable<any> {
    const h = this.getAuthHeaders();
    const emptyBody = { avatar: '', profileImage: '', photo: '' };
    const tapPersist = (res: any) =>
      this.persistFromProfileResponse(res, { avatar: '', profileImage: '' });

    return this.http.patch<any>(`${this.API_URL}/users/${userId}`, emptyBody, { headers: h }).pipe(
      tap(tapPersist),
      catchError(() =>
        this.http.delete<any>(`${this.API_URL}/auth/avatar`, { headers: h }).pipe(tap(tapPersist))
      ),
      catchError(() =>
        this.http.post<any>(`${this.API_URL}/auth/remove-avatar`, {}, { headers: h }).pipe(tap(tapPersist))
      ),
      catchError(() =>
        this.http.patch<any>(`${this.API_URL}/auth/me`, emptyBody, { headers: h }).pipe(tap(tapPersist))
      ),
      catchError(this.handleError('Remove profile photo'))
    );
  }

  updatePasswordLegacy(userId: string | number, currentPassword: string, newPassword: string): Observable<any> {
    const h = this.getAuthHeaders();
    const body1 = { currentPassword, newPassword };
    const body2 = { oldPassword: currentPassword, newPassword };
    const body3 = { current_password: currentPassword, new_password: newPassword };

    return this.http.post<any>(`${this.API_URL}/auth/change-password`, body1, { headers: h }).pipe(
      catchError(() => this.http.patch<any>(`${this.API_URL}/users/${userId}/password`, body1, { headers: h })),
      catchError(() => this.http.post<any>(`${this.API_URL}/users/${userId}/change-password`, body1, { headers: h })),
      catchError(() => this.http.patch<any>(`${this.API_URL}/auth/password`, body1, { headers: h })),
      catchError(() => this.http.put<any>(`${this.API_URL}/auth/password`, body1, { headers: h })),
      catchError(() => this.http.post<any>(`${this.API_URL}/auth/change-password`, body2, { headers: h })),
      catchError(() =>
        this.http.patch<any>(`${this.API_URL}/users/${userId}/password`, body3, { headers: h })
      ),
      catchError(this.handleError('Update Password'))
    );
  }

  getDashboardData(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/dashboard`, { headers: this.getAuthHeaders() }).pipe(
      timeout(8000),
      catchError(this.handleError('Dashboard Data'))
    );
  }

  // ✅ UPDATED: Enhanced getDepartments with fallback
  getDepartments(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/rfq/departments`, { headers: this.getAuthHeaders() }).pipe(
      timeout(8000),
      catchError(() => 
        this.http.get<any>(`${this.API_URL}/auth/departments`, { headers: this.getAuthHeaders() }).pipe(
          catchError(() => of({ success: true, departments: ['Purchase', 'IT', 'HR', 'Finance', 'R&D', 'Operations', 'Sales'] }))
        )
      )
    );
  }

  // ✅ UPDATED: Enhanced getManagers with fallback
  getManagers(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/rfq/vendors`, { headers: this.getAuthHeaders() }).pipe(
      timeout(8000),
      map(res => {
        if (res?.data && Array.isArray(res.data)) {
          return {
            managers: res.data.map((v: any) => ({
              name: v.name,
              email: v.email,
              designation: v.designation || 'Manager',
              role: v.role || 'Approver'
            }))
          };
        }
        return { managers: [] };
      }),
      catchError(() => {
        return of({
          managers: [
            { name: 'Vijay Parashar', email: 'vijay.parashar@radiant.com', designation: 'Manager', role: 'Manager' },
            { name: 'Ravib', email: 'ravib@radiant.com', designation: 'A-GM', role: 'A-GM' },
            { name: 'Shailendra Chothe', email: 'shailendra.chothe@radiant.com', designation: 'VP', role: 'VP' },
            { name: 'Sanjay Munshi', email: 'sanjay.munshi@radiant.com', designation: 'S-VP', role: 'S-VP' },
            { name: 'Wang Xianwen', email: 'wang.xianwen@radiant.com', designation: 'GM', role: 'GM' },
            { name: 'Raminder Singh', email: 'raminder.singh@radiant.com', designation: 'MD', role: 'MD' }
          ]
        });
      })
    );
  }

  getEPRequestsWithFilter(params: any = {}): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/ep-approval`, { headers: this.getAuthHeaders(), params }).pipe(
      catchError(this.handleError('Get Filtered EP Requests'))
    );
  }

  getAllEPApprovalRequests(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/request`, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      map(res => this.withId(this.asListResponse(res))),
      catchError(this.handleError('EP Approval Requests'))
    );
  }

  createEPRequest(data: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/request`, data, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError('Create EP Request'))
    );
  }

  updateEPRequest(id: string | number, data: any): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/request/${id}`, data, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError('Update EP Request'))
    );
  }

  deleteEPRequest(id: string | number): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/request/${id}`, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError('Delete EP Request'))
    );
  }

  approveEPRequest(id: string | number, comments = ''): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/request/${id}/approve`, { comments }, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError('Approve EP Request'))
    );
  }

  rejectEPRequest(id: string | number, comments = ''): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/request/${id}/reject`, { comments }, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError('Reject EP Request'))
    );
  }

  getVendors(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/vendor`, { headers: this.getAuthHeaders() }).pipe(
      timeout(8000),
      map(res => this.withId(this.asListResponse(res))),
      catchError(this.handleError('Get Vendors'))
    );
  }

  addVendor(data: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/vendor`, data, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError('Add Vendor'))
    );
  }

  updateVendor(id: string | number, data: any): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/vendor/${id}`, data, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError('Update Vendor'))
    );
  }

  deleteVendor(id: string | number): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/vendor/${id}`, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError('Delete Vendor'))
    );
  }

  getParts(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/part`, { headers: this.getAuthHeaders() }).pipe(
      timeout(8000),
      map(res => this.withId(this.asListResponse(res))),
      catchError(this.handleError('Get Parts'))
    );
  }

  addPart(data: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/part`, data, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError('Add Part'))
    );
  }

  updatePart(id: string | number, data: any): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/part/${id}`, data, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError('Update Part'))
    );
  }

  deletePart(id: string | number): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/part/${id}`, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError('Delete Part'))
    );
  }

  // ✅ UPDATED: Enhanced getRFQs with proper data mapping
  getRFQs(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/rfq`, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      map(res => {
        console.log('📥 Raw RFQ response:', res);
        
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

  // ✅ UPDATED: Enhanced createRFQ with better error handling
  createRFQ(data: any): Observable<any> {
    console.log('📤 Creating RFQ with payload:', JSON.stringify(data, null, 2));
    return this.http.post<any>(`${this.API_URL}/rfq`, data, { headers: this.getAuthHeaders() }).pipe(
      timeout(15000),
      map(res => {
        console.log('📥 Create RFQ response:', res);
        if (res?.data) {
          return {
            ...res,
            data: {
              ...res.data,
              id: res.data._id,
              title: res.data.titleOfActivity
            }
          };
        }
        return res;
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Create RFQ error:', error);
        let errorMessage = 'Failed to create RFQ.';
        if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.status === 400) {
          errorMessage = 'Invalid data. Please check all required fields.';
        } else if (error.status === 401) {
          errorMessage = 'Session expired. Please login again.';
        } else if (error.status === 403) {
          errorMessage = 'You do not have permission to create RFQs.';
        }
        return throwError(() => ({ message: errorMessage, status: error.status }));
      })
    );
  }

  updateRFQ(id: string | number, data: any): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/rfq/${id}`, data, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError('Update RFQ'))
    );
  }

  deleteRFQ(id: string | number): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/rfq/${id}`, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError('Delete RFQ'))
    );
  }

  approveRFQ(id: string | number, comments = ''): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/rfq/${id}/approve`, { comments }, { headers: this.getAuthHeaders() }).pipe(
      catchError(() => this.updateRFQ(id, { status: 'Approved', comments }))
    );
  }

  rejectRFQ(id: string | number, comments = ''): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/rfq/${id}/reject`, { comments }, { headers: this.getAuthHeaders() }).pipe(
      catchError(() => this.updateRFQ(id, { status: 'Rejected', comments }))
    );
  }

  // ==================== NPP PROCUREMENT METHODS ====================
  
  getNppRequests(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/pr-npp`, { headers: this.getAuthHeaders() }).pipe(
      timeout(8000),
      map(res => this.withId(this.asListResponse(res))),
      catchError(() =>
        this.http.get<any>(`${this.API_URL}/npp-procurement`, { headers: this.getAuthHeaders() }).pipe(
          timeout(8000),
          map(res => this.withId(this.asListResponse(res))),
          catchError(this.handleError('Get NPP Requests'))
        )
      )
    );
  }

  createNppRequest(data: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/pr-npp`, data, { headers: this.getAuthHeaders() }).pipe(
      catchError(() => this.http.post<any>(`${this.API_URL}/npp-procurement`, data, { headers: this.getAuthHeaders() })),
      catchError(this.handleError('Create NPP Request'))
    );
  }

  // ✅ PR NPP Request
  createNppPrRequest(data: any): Observable<any> {
    console.log('📤 Creating PR NPP request:', data);
    return this.http.post<any>(`${this.API_URL}/pr-npp`, data, { headers: this.getAuthHeaders() }).pipe(
      timeout(15000),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Create PR NPP error:', error);
        let errorMessage = 'Failed to create PR NPP request.';
        if (error.error?.message) errorMessage = error.error.message;
        else if (error.status === 400) errorMessage = 'Invalid data. Please check all required fields.';
        else if (error.status === 401) errorMessage = 'Session expired. Please login again.';
        return throwError(() => ({ message: errorMessage, status: error.status }));
      })
    );
  }

  // ✅ PO NPP Request
  createNppPoRequest(data: any): Observable<any> {
    console.log('📤 Creating PO NPP request:', data);
    return this.http.post<any>(`${this.API_URL}/po-npp`, data, { headers: this.getAuthHeaders() }).pipe(
      timeout(15000),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Create PO NPP error:', error);
        let errorMessage = 'Failed to create PO NPP request.';
        if (error.error?.message) errorMessage = error.error.message;
        else if (error.status === 400) errorMessage = 'Invalid data. Please check all required fields.';
        else if (error.status === 401) errorMessage = 'Session expired. Please login again.';
        return throwError(() => ({ message: errorMessage, status: error.status }));
      })
    );
  }

  // ✅ Payment Advice Request
  createPaymentAdviceRequest(data: any): Observable<any> {
    console.log('📤 Creating Payment Advice request:', data);
    return this.http.post<any>(`${this.API_URL}/payment-advice`, data, { headers: this.getAuthHeaders() }).pipe(
      timeout(15000),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Create Payment Advice error:', error);
        let errorMessage = 'Failed to create Payment Advice request.';
        if (error.error?.message) errorMessage = error.error.message;
        else if (error.status === 400) errorMessage = 'Invalid data. Please check all required fields.';
        else if (error.status === 401) errorMessage = 'Session expired. Please login again.';
        return throwError(() => ({ message: errorMessage, status: error.status }));
      })
    );
  }

  updateNppRequest(id: string | number, data: any): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/pr-npp/${id}`, data, { headers: this.getAuthHeaders() }).pipe(
      catchError(() => this.http.put<any>(`${this.API_URL}/npp-procurement/${id}`, data, { headers: this.getAuthHeaders() })),
      catchError(this.handleError('Update NPP Request'))
    );
  }

  approveNppRequest(id: string | number, comments = ''): Observable<any> {
    return this.http
      .patch<any>(`${this.API_URL}/pr-npp/${id}/approve`, { comments }, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(() =>
          this.http.patch<any>(`${this.API_URL}/npp-procurement/${id}/approve`, { comments }, { headers: this.getAuthHeaders() })
        ),
        catchError(() => this.updateNppRequest(id, { status: 'Approved', comments }))
      );
  }

  rejectNppRequest(id: string | number, comments = ''): Observable<any> {
    return this.http
      .patch<any>(`${this.API_URL}/pr-npp/${id}/reject`, { comments }, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(() =>
          this.http.patch<any>(`${this.API_URL}/npp-procurement/${id}/reject`, { comments }, { headers: this.getAuthHeaders() })
        ),
        catchError(() => this.updateNppRequest(id, { status: 'Rejected', comments }))
      );
  }

  createUser(userData: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/users`, userData, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError('Create User'))
    );
  }

  getAllUsers(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/users`, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError('Get Users'))
    );
  }

  updateUserRights(userId: string | number, rights: any): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/users/${userId}/rights`, { rights }, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError('Update User Rights'))
    );
  }

  getUserRightsRequests(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/user-rights`, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError('Get User Rights Requests'))
    );
  }

  // ==================== NEW METHODS FOR REPORTS ====================
  
  /**
   * Get reports data with date filtering
   * @param fromDate - Start date (YYYY-MM-DD)
   * @param toDate - End date (YYYY-MM-DD)
   * @param type - Report type (all, rfq, pr, po, payment)
   */
  getReports(fromDate?: string, toDate?: string, type?: string): Observable<any> {
    let params: any = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (type && type !== 'all') params.type = type;
    
    return this.http.get<any>(`${this.API_URL}/reports`, { headers: this.getAuthHeaders(), params }).pipe(
      timeout(15000),
      map(res => this.asListResponse(res)),
      catchError(() => {
        // Fallback to local data if API not available
        return of({ success: true, data: [], message: 'Using local data' });
      }),
      catchError(this.handleError('Get Reports'))
    );
  }

  /**
   * Export report to CSV
   * @param fromDate - Start date (YYYY-MM-DD)
   * @param toDate - End date (YYYY-MM-DD)
   * @param type - Report type
   */
  exportReportToCSV(fromDate?: string, toDate?: string, type?: string): Observable<Blob> {
    let params: any = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (type && type !== 'all') params.type = type;
    
    const headers = this.getAuthHeaders();
    headers.set('Accept', 'text/csv');
    
    return this.http.get(`${this.API_URL}/reports/export`, {
      headers,
      params,
      responseType: 'blob'
    }).pipe(
      timeout(30000),
      catchError(this.handleError('Export Report'))
    );
  }

  // ==================== NEW METHODS FOR ORDER HISTORY ====================
  
  /**
   * Get order history for a user
   * @param userId - Optional user ID filter
   * @param type - Optional type filter (rfq, pr, po, payment)
   */
  getOrderHistory(userId?: string, type?: string): Observable<any> {
    let params: any = {};
    if (userId) params.userId = userId;
    if (type) params.type = type;
    
    return this.http.get<any>(`${this.API_URL}/order-history`, { headers: this.getAuthHeaders(), params }).pipe(
      timeout(10000),
      map(res => this.asListResponse(res)),
      catchError(() => {
        // Return empty array if API not available
        return of({ success: true, data: [] });
      }),
      catchError(this.handleError('Get Order History'))
    );
  }

  /**
   * Save order history item
   * @param data - Order history data
   */
  saveOrderHistory(data: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/order-history`, data, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      catchError(() => {
        // Store in localStorage if API fails
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

  // ==================== NEW METHODS FOR RFQ ITEMS ====================
  
  /**
   * Get all RFQ items for a specific RFQ
   * @param rfqId - RFQ ID
   */
  getRfqItems(rfqId: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/rfq/${rfqId}/items`, { headers: this.getAuthHeaders() }).pipe(
      timeout(8000),
      map(res => this.asListResponse(res)),
      catchError(this.handleError('Get RFQ Items'))
    );
  }

  /**
   * Add item to RFQ
   * @param rfqId - RFQ ID
   * @param item - Item data
   */
  addRfqItem(rfqId: string, item: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/rfq/${rfqId}/items`, item, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      catchError(this.handleError('Add RFQ Item'))
    );
  }

  /**
   * Update RFQ item
   * @param rfqId - RFQ ID
   * @param itemId - Item ID
   * @param item - Updated item data
   */
  updateRfqItem(rfqId: string, itemId: string, item: any): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/rfq/${rfqId}/items/${itemId}`, item, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      catchError(this.handleError('Update RFQ Item'))
    );
  }

  /**
   * Delete RFQ item
   * @param rfqId - RFQ ID
   * @param itemId - Item ID
   */
  deleteRfqItem(rfqId: string, itemId: string): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/rfq/${rfqId}/items/${itemId}`, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      catchError(this.handleError('Delete RFQ Item'))
    );
  }

  // ==================== NEW METHODS FOR UPLOADING PICTURES ====================
  
  /**
   * Upload picture for RFQ item
   * @param rfqId - RFQ ID
   * @param itemId - Item ID
   * @param file - Image file
   */
  uploadRfqItemPicture(rfqId: string, itemId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('picture', file);
    
    return this.http.post<any>(`${this.API_URL}/rfq/${rfqId}/items/${itemId}/picture`, formData, { 
      headers: new HttpHeaders().set('Authorization', `Bearer ${this.getToken() || ''}`)
    }).pipe(
      timeout(30000),
      catchError(this.handleError('Upload Picture'))
    );
  }

  // ==================== NEW METHODS FOR EXCEL IMPORT/EXPORT ====================
  
  /**
   * Import RFQ data from Excel file
   * @param file - Excel file
   */
  importRfqFromExcel(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.http.post<any>(`${this.API_URL}/rfq/import-excel`, formData, { 
      headers: new HttpHeaders().set('Authorization', `Bearer ${this.getToken() || ''}`)
    }).pipe(
      timeout(60000),
      catchError(this.handleError('Import Excel'))
    );
  }

  /**
   * Export RFQ data to Excel
   * @param rfqId - Optional RFQ ID to export specific RFQ
   */
  exportRfqToExcel(rfqId?: string): Observable<Blob> {
    let url = `${this.API_URL}/rfq/export-excel`;
    if (rfqId) url += `?rfqId=${rfqId}`;
    
    const headers = this.getAuthHeaders();
    headers.set('Accept', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    return this.http.get(url, {
      headers,
      responseType: 'blob'
    }).pipe(
      timeout(30000),
      catchError(this.handleError('Export Excel'))
    );
  }

  /**
   * Download Excel template for RFQ import
   */
  downloadRfqExcelTemplate(): Observable<Blob> {
    const headers = this.getAuthHeaders();
    headers.set('Accept', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    return this.http.get(`${this.API_URL}/rfq/download-template`, {
      headers,
      responseType: 'blob'
    }).pipe(
      timeout(15000),
      catchError(() => {
        // Create a simple CSV template if API not available
        const csvContent = 'Item Description,UOM,Quantity,Make,Alternative,Vendor Ref,Remark\nSample Item 1,PCS,10,Make A,Alt B,REF001,Test remark\nSample Item 2,KG,5,Make C,Alt D,REF002,Test remark 2';
        return of(new Blob([csvContent], { type: 'text/csv' }));
      }),
      catchError(this.handleError('Download Template'))
    );
  }

  // ==================== NEW METHODS FOR PART MASTER ====================
  
  /**
   * Search parts by criteria
   * @param searchTerm - Search term
   * @param category - Category filter
   */
  searchParts(searchTerm: string, category?: string): Observable<any> {
    let params: any = { search: searchTerm };
    if (category) params.category = category;
    
    return this.http.get<any>(`${this.API_URL}/parts/search`, { headers: this.getAuthHeaders(), params }).pipe(
      timeout(8000),
      map(res => this.asListResponse(res)),
      catchError(this.handleError('Search Parts'))
    );
  }

  /**
   * Get part by code
   * @param partCode - Part code
   */
  getPartByCode(partCode: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/parts/code/${partCode}`, { headers: this.getAuthHeaders() }).pipe(
      timeout(8000),
      catchError(this.handleError('Get Part By Code'))
    );
  }

  // ==================== NEW METHODS FOR VENDOR MASTER ====================
  
  /**
   * Search vendors by criteria
   * @param searchTerm - Search term
   * @param category - Vendor category
   */
  searchVendors(searchTerm: string, category?: string): Observable<any> {
    let params: any = { search: searchTerm };
    if (category) params.category = category;
    
    return this.http.get<any>(`${this.API_URL}/vendors/search`, { headers: this.getAuthHeaders(), params }).pipe(
      timeout(8000),
      map(res => this.asListResponse(res)),
      catchError(this.handleError('Search Vendors'))
    );
  }

  /**
   * Get vendor by code
   * @param vendorCode - Vendor code
   */
  getVendorByCode(vendorCode: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/vendors/code/${vendorCode}`, { headers: this.getAuthHeaders() }).pipe(
      timeout(8000),
      catchError(this.handleError('Get Vendor By Code'))
    );
  }

  // ==================== NEW METHODS FOR APPROVAL WORKFLOW ====================
  
  /**
   * Get approval workflow for a request
   * @param requestId - Request ID
   * @param type - Request type (ep, rfq, npp)
   */
  getApprovalWorkflow(requestId: string, type: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/approvals/${type}/${requestId}/workflow`, { headers: this.getAuthHeaders() }).pipe(
      timeout(8000),
      map(res => this.asListResponse(res)),
      catchError(this.handleError('Get Approval Workflow'))
    );
  }

  /**
   * Update approval status
   * @param requestId - Request ID
   * @param type - Request type
   * @param approverId - Approver ID
   * @param status - New status
   * @param comments - Comments
   */
  updateApprovalStatus(requestId: string, type: string, approverId: string, status: string, comments?: string): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/approvals/${type}/${requestId}/approvers/${approverId}`, 
      { status, comments }, 
      { headers: this.getAuthHeaders() }
    ).pipe(
      timeout(10000),
      catchError(this.handleError('Update Approval Status'))
    );
  }

  // ==================== NEW METHODS FOR SERIAL NUMBER GENERATION ====================
  
  /**
   * Generate unique serial number for a request type
   * @param type - Request type (rfq, pr, po, payment)
   */
  generateSerialNumber(type: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/serial-number/${type}`, { headers: this.getAuthHeaders() }).pipe(
      timeout(5000),
      catchError(() => {
        // Generate local serial number if API not available
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

  /**
   * Validate serial number
   * @param serialNumber - Serial number to validate
   */
  validateSerialNumber(serialNumber: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/serial-number/validate/${serialNumber}`, { headers: this.getAuthHeaders() }).pipe(
      timeout(5000),
      catchError(() => {
        // Local validation
        const isValid = serialNumber.length > 5;
        return of({ success: true, isValid, exists: false });
      }),
      catchError(this.handleError('Validate Serial Number'))
    );
  }

  // ==================== NEW METHODS FOR SERIAL NUMBER SEARCH ====================

  /**
   * Search by serial number across all request types
   * @param serialNumber - Serial number to search
   */
  searchBySerialNumber(serialNumber: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/search/serial/${serialNumber}`, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Search by serial number error:', error);
        return of({ success: false, message: error.error?.message || 'Search failed' });
      })
    );
  }

  /**
   * Get all serial numbers for autocomplete
   * @param type - Optional type filter (rfq, pr, po, payment, ep, all)
   */
  getAllSerialNumbers(type?: string): Observable<any> {
    let url = `${this.API_URL}/search/serials`;
    if (type && type !== 'all') url += `?type=${type}`;
    return this.http.get<any>(url, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Get all serial numbers error:', error);
        return of({ success: true, data: [] });
      })
    );
  }

  /**
   * Get request by serial number and type
   * @param serialNumber - Serial number
   * @param type - Request type (rfq, pr, po, payment, ep)
   */
  getRequestBySerialNumber(serialNumber: string, type: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/${type}/serial/${serialNumber}`, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Get request by serial number error:', error);
        return of({ success: false, message: error.error?.message || 'Request failed' });
      })
    );
  }

  /**
   * Reuse existing request data
   * @param serialNumber - Source serial number
   * @param targetType - Target request type
   */
  reuseRequestData(serialNumber: string, targetType: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/reuse/serial/${serialNumber}`, { targetType }, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Reuse request data error:', error);
        return of({ success: false, message: error.error?.message || 'Reuse failed' });
      })
    );
  }

  /**
   * Get RFQ by serial number
   * @param serialNumber - RFQ serial number
   */
  getRFQBySerial(serialNumber: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/rfq/serial/${serialNumber}`, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Get RFQ by serial error:', error);
        return of({ success: false, message: error.error?.message || 'RFQ not found' });
      })
    );
  }

  /**
   * Get PR by serial number
   * @param serialNumber - PR serial number
   */
  getPRBySerial(serialNumber: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/pr-npp/serial/${serialNumber}`, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Get PR by serial error:', error);
        return of({ success: false, message: error.error?.message || 'PR not found' });
      })
    );
  }

  /**
   * Get PO by serial number
   * @param serialNumber - PO serial number
   */
  getPOBySerial(serialNumber: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/po-npp/serial/${serialNumber}`, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Get PO by serial error:', error);
        return of({ success: false, message: error.error?.message || 'PO not found' });
      })
    );
  }

  /**
   * Get Payment by serial number
   * @param serialNumber - Payment serial number
   */
  getPaymentBySerial(serialNumber: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/payment-npp/serial/${serialNumber}`, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Get Payment by serial error:', error);
        return of({ success: false, message: error.error?.message || 'Payment not found' });
      })
    );
  }

  /**
   * Get EP Request by serial number
   * @param serialNumber - EP serial number
   */
  getEPBySerial(serialNumber: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/request/serial/${serialNumber}`, { headers: this.getAuthHeaders() }).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('Get EP by serial error:', error);
        return of({ success: false, message: error.error?.message || 'EP request not found' });
      })
    );
  }

  // ==================== NEW METHOD FOR REQUEST TO VENDOR (PREFILL) ====================
  
  /**
   * Get approved RFQ data by serial number for vendor request
   * @param serialNumber - RFQ serial number
   */
  getApprovedRfqBySerial(serialNumber: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/rfq/serial/${serialNumber}`, { headers: this.getAuthHeaders() }).pipe(
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
        // Check in localStorage if API not available
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

  // ==================== NEW SOCIAL LOGIN METHODS ====================

  /**
   * Google Login - One Tap Sign In
   * @param credential - Google credential token
   */
  googleLogin(credential: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/google`, { credential }).pipe(
      timeout(15000),
      tap(res => {
        if (res?.success && res?.token) {
          this.storeAuthSession(res, true);
        }
      }),
      catchError(this.handleError('Google Login'))
    );
  }

  /**
   * Google Login with ID Token (alternative method)
   * @param idToken - Google ID token
   */
  googleLoginWithIdToken(idToken: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/google-idtoken`, { idToken }).pipe(
      timeout(15000),
      tap(res => {
        if (res?.success && res?.token) {
          this.storeAuthSession(res, true);
        }
      }),
      catchError(this.handleError('Google Login'))
    );
  }

  /**
   * Facebook Login
   * @param accessToken - Facebook access token
   * @param userID - Facebook user ID
   */
  facebookLogin(accessToken: string, userID: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/facebook`, { accessToken, userID }).pipe(
      timeout(15000),
      tap(res => {
        if (res?.success && res?.token) {
          this.storeAuthSession(res, true);
        }
      }),
      catchError(this.handleError('Facebook Login'))
    );
  }

  /**
   * Facebook Login with full user data
   * @param facebookData - Complete Facebook user data
   */
  facebookLoginWithData(facebookData: { id: string; email: string; name: string; picture?: string }): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/facebook-data`, facebookData).pipe(
      timeout(15000),
      tap(res => {
        if (res?.success && res?.token) {
          this.storeAuthSession(res, true);
        }
      }),
      catchError(this.handleError('Facebook Login'))
    );
  }

  /**
   * Twitter Login - OAuth 1.0a (Request Token)
   * Get request token for Twitter OAuth flow
   */
  getTwitterRequestToken(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/auth/twitter/request-token`).pipe(
      timeout(15000),
      catchError(this.handleError('Get Twitter Request Token'))
    );
  }

  /**
   * Twitter Login - OAuth 1.0a (Access Token)
   * Exchange request token for access token
   * @param oauthToken - OAuth token from callback
   * @param oauthVerifier - OAuth verifier from callback
   */
  twitterLogin(oauthToken: string, oauthVerifier: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/twitter`, { oauthToken, oauthVerifier }).pipe(
      timeout(15000),
      tap(res => {
        if (res?.success && res?.token) {
          this.storeAuthSession(res, true);
        }
      }),
      catchError(this.handleError('Twitter Login'))
    );
  }

  /**
   * Twitter OAuth 2.0 Login (Bearer Token)
   * @param accessToken - Twitter OAuth 2.0 access token
   */
  twitterOAuth2Login(accessToken: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/twitter-oauth2`, { accessToken }).pipe(
      timeout(15000),
      tap(res => {
        if (res?.success && res?.token) {
          this.storeAuthSession(res, true);
        }
      }),
      catchError(this.handleError('Twitter OAuth2 Login'))
    );
  }

  // ==================== END NEW SOCIAL LOGIN METHODS ====================

  private handleError(operation: string) {
    return (error: HttpErrorResponse) => {
      let message = `${operation} failed.`;

      if (error.error?.message) {
        message = error.error.message;
      } else if (error.status === 0) {
        message = 'Cannot connect to server. Check your internet connection.';
      } else if (error.status === 401) {
        message = 'Access denied. Please login again.';
      } else if (error.status === 404) {
        message = `${operation} endpoint was not found.`;
      } else if (error.status === 500) {
        message = `Server error while trying to ${operation.toLowerCase()}.`;
      }

      return throwError(() => ({
        message,
        status: error.status,
        originalError: error
      }));
    };
  }

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(this.TOKEN_KEY) || sessionStorage.getItem(this.TOKEN_KEY);
  }

  getUser(): any {
    if (!this.isBrowser) return null;
    const raw =
      localStorage.getItem(this.USER_KEY) ||
      sessionStorage.getItem(this.USER_KEY) ||
      localStorage.getItem(this.CURRENT_USER_KEY) ||
      sessionStorage.getItem(this.CURRENT_USER_KEY);

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

  logout(): void {
    if (!this.isBrowser) return;
    [this.TOKEN_KEY, this.USER_KEY, this.CURRENT_USER_KEY].forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }
}