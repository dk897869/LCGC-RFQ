import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { forkJoin, of, timer } from 'rxjs';
import { timeout, catchError, switchMap } from 'rxjs/operators';

interface UserRights {
  epApproval?: boolean; vendors?: boolean; parts?: boolean; rfq?: boolean;
  nppProcurement?: boolean; bidding?: boolean; paymentRequest?: boolean;
  dqms?: boolean; npi?: boolean; systemBom?: boolean; bomForecast?: boolean;
  priceApproval?: boolean; planStock?: boolean; supplierPerformance?: boolean;
  vehicularMs?: boolean; userManagement?: boolean;
  [key: string]: boolean | undefined;
}

interface User {
  id?: number; _id?: string;
  name: string; email: string; password?: string;
  role: string; department?: string; contactNo?: string;
  dateOfBirth?: string; organization?: string; rights?: UserRights;
}

interface RightsRequest {
  _id: string;
  id?: string;
  userRight: string;
  code: string;
  reason?: string;
  requestedBy?: string;
  requestedByEmail?: string;
  action: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

const USER_MGMT_CACHE = {
  users: 'lcgc_user_mgmt_users',
  requests: 'lcgc_user_mgmt_requests'
};
const USER_MGMT_CACHE_TTL = 5 * 60 * 1000;

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [DatePipe],
  templateUrl: './user-management.html',
  styleUrls: ['./user-management.scss']
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  isLoading = false;
  isLoadingRequests = false;
  successMessage = '';
  errorMessage = '';
  showCreateModal = false;
  showEditModal = false;
  showCredentialsModal = false;
  selectedUser: User | null = null;
  newUserCredentials = { email: '', password: '' };
  currentDate = new Date().toISOString().split('T')[0];
  activeTab: 'users' | 'requests' = 'users';
  rightsRequests: RightsRequest[] = [];

  private readonly apiUrl = `${environment.apiUrl}/users`;
  private readonly rightsUrl = `${environment.apiUrl}/user-rights`;

  actionLoading = false;
  topToast: { message: string; type: 'success' | 'error' | 'info' } | null = null;
  private topToastTimer: ReturnType<typeof setTimeout> | null = null;

  roleOptions = [
    { value: 'Admin', label: 'Admin' }, { value: 'User', label: 'User' },
    { value: 'Manager', label: 'Manager' }, { value: 'Viewer', label: 'Viewer' }
  ];

  moduleCategories = [
    { name: 'Procurement', modules: ['epApproval', 'vendors', 'parts', 'rfq', 'nppProcurement', 'bidding', 'paymentRequest'] },
    { name: 'Quality', modules: ['dqms', 'npi'] },
    { name: 'Engineering', modules: ['systemBom', 'bomForecast'] },
    { name: 'Finance', modules: ['priceApproval'] },
    { name: 'Inventory', modules: ['planStock'] },
    { name: 'Supplier', modules: ['supplierPerformance'] },
    { name: 'Logistics', modules: ['vehicularMs'] },
    { name: 'Administration', modules: ['userManagement'] }
  ];

  formData: User = {
    name: '', email: '', password: '', role: 'User',
    department: '', contactNo: '', dateOfBirth: '', organization: '', rights: {}
  };

  moduleDisplayNames: Record<string, string> = {
    epApproval: 'EP Approval', vendors: 'Vendors', parts: 'Parts', rfq: 'RFQ',
    nppProcurement: 'NPP Procurement', bidding: 'Bidding: Scrap Material',
    paymentRequest: 'Payment Request', dqms: 'DQMS', npi: 'NPI',
    systemBom: 'System BOM', bomForecast: 'BOM Part Forecasting',
    priceApproval: 'Price Approval', planStock: 'Plan Vs Stock',
    supplierPerformance: 'Supplier Performance', vehicularMs: 'Vehicular - MS',
    userManagement: 'User Management'
  };

  moduleIdToRightKey: Record<string, string> = {
    'ep-approval': 'epApproval', vendors: 'vendors', parts: 'parts', rfq: 'rfq',
    'npp-procurement': 'nppProcurement', bidding: 'bidding', 'payment-request': 'paymentRequest',
    dqms: 'dqms', npi: 'npi', 'system-bom': 'systemBom', 'bom-forecast': 'bomForecast',
    'price-approval': 'priceApproval', 'plan-stock': 'planStock',
    'supplier-performance': 'supplierPerformance', 'vehicular-ms': 'vehicularMs',
    'user-management': 'userManagement'
  };

  constructor(private http: HttpClient, private authService: AuthService) {}

  ngOnInit(): void {
    this.paintFromCache();
    this.loadUsersAndRequests();
  }

  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  }

  private getHeaders(): HttpHeaders {
    const t = this.getAuthToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(t ? { 'Authorization': `Bearer ${t}` } : {})
    });
  }

  loadUsersAndRequests(): void {
    this.isLoading = true;
    this.isLoadingRequests = true;
    const fallbackTimer = setTimeout(() => {
      this.isLoading = false;
      this.isLoadingRequests = false;
    }, 5200);

    forkJoin({
      users: this.http.get<any>(this.apiUrl, { headers: this.getHeaders() }).pipe(timeout(5000), catchError(() => of(null))),
      requests: this.http.get<any>(this.rightsUrl, { headers: this.getHeaders() }).pipe(timeout(5000), catchError(() => of(null)))
    }).subscribe(({ users, requests }) => {
      clearTimeout(fallbackTimer);

      if (users) {
        const arr = users?.data || users?.users || (Array.isArray(users) ? users : []);
        this.users = arr.map((u: any) => ({ ...u, id: u._id || u.id, rights: u.rights || {} }));
        this.writeCache(USER_MGMT_CACHE.users, this.users);
      }
      this.isLoading = false;

      if (requests) {
        this.rightsRequests = this.normalizeRightsRequests(requests?.data || []);
        this.writeCache(USER_MGMT_CACHE.requests, this.rightsRequests);
      }
      this.isLoadingRequests = false;
    });
  }

  private getNameByEmail(email: string): string {
    if (!email) return '';
    const user = this.users.find(u => u.email?.toLowerCase() === email?.toLowerCase());
    return user?.name || '';
  }

  loadUsers(): void {
    this.isLoading = true;
    this.http.get<any>(this.apiUrl, { headers: this.getHeaders() })
      .pipe(timeout(5000), catchError(() => of(null)))
      .subscribe(res => {
        if (res) {
          const arr = res?.data || res?.users || (Array.isArray(res) ? res : []);
          this.users = arr.map((u: any) => ({ ...u, id: u._id || u.id, rights: u.rights || {} }));
          this.writeCache(USER_MGMT_CACHE.users, this.users);
        }
        this.isLoading = false;
      });
  }

  loadRightsRequests(): void {
    const cachedRequests = this.readCache(USER_MGMT_CACHE.requests);
    if (cachedRequests?.length) {
      this.rightsRequests = this.normalizeRightsRequests(cachedRequests);
      this.isLoadingRequests = false;
    }

    this.isLoadingRequests = true;
    this.http.get<any>(this.rightsUrl, { headers: this.getHeaders() })
      .pipe(timeout(5000), catchError(() => of(null)))
      .subscribe(res => {
        if (res) {
          this.rightsRequests = this.normalizeRightsRequests(res?.data || []);
          this.writeCache(USER_MGMT_CACHE.requests, this.rightsRequests);
        }
        this.isLoadingRequests = false;
      });
  }

  isPendingRequestStatus(status: string | undefined): boolean {
    const s = (status || '').toLowerCase().trim().replace(/\s+/g, '-');
    return s === 'in-process' || s === 'pending' || s === 'inprocess';
  }

  get pendingRequests(): RightsRequest[] {
    return this.rightsRequests.filter(r => this.isPendingRequestStatus(r.status));
  }
  get pendingCount(): number { return this.pendingRequests.length; }

  showTopToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    if (this.topToastTimer) clearTimeout(this.topToastTimer);
    this.topToast = { message, type };
    this.topToastTimer = setTimeout(() => { this.topToast = null; }, 6000);
  }

  closeTopToast() {
    this.topToast = null;
    if (this.topToastTimer) clearTimeout(this.topToastTimer);
  }

  approveRequest(req: RightsRequest): void {
    const id = req._id || (req as any).id;
    if (!id) {
      this.showTopToast('Invalid request id.', 'error');
      return;
    }
    this.actionLoading = true;
    this.http
      .put<any>(`${this.rightsUrl}/${id}`, { status: 'Approved', action: 'Approved' }, { headers: this.getHeaders() })
      .pipe(
        switchMap(res => forkJoin([of(res), timer(5000)]))
      )
      .subscribe({
        next: ([res]) => {
          this.actionLoading = false;
          if (res && typeof res === 'object' && 'success' in res && (res as any).success === false) {
            this.showTopToast((res as any)?.message || 'Approval failed.', 'error');
            return;
          }
          req.status = 'Approved';
          req.action = 'Approved';
          this.successMessage = `"${req.userRight}" access granted to ${req.requestedBy || 'user'}. They have been notified by email.`;
          this.grantRightToUser(req);
          this.showTopToast(this.successMessage, 'success');

          const currentUser = this.authService.getUser();
          if (req.requestedByEmail && currentUser?.email?.toLowerCase() === req.requestedByEmail?.toLowerCase()) {
            this.authService.refreshUserRights().subscribe({ next: () => {}, error: () => {} });
          }
          setTimeout(() => this.clearMessages(), 5000);
        },
        error: () => {
          this.actionLoading = false;
          this.errorMessage = 'Failed to approve.';
          this.showTopToast(this.errorMessage, 'error');
          setTimeout(() => this.clearMessages(), 4000);
        }
      });
  }

  rejectRequest(req: RightsRequest): void {
    const id = req._id || (req as any).id;
    if (!id) return;
    this.actionLoading = true;
    this.http
      .put<any>(`${this.rightsUrl}/${id}`, { status: 'Rejected', action: 'Rejected' }, { headers: this.getHeaders() })
      .pipe(switchMap(res => forkJoin([of(res), timer(5000)])))
      .subscribe({
        next: ([res]) => {
          this.actionLoading = false;
          if (res && typeof res === 'object' && 'success' in res && (res as any).success === false) {
            this.showTopToast((res as any)?.message || 'Reject failed.', 'error');
            return;
          }
          req.status = 'Rejected';
          req.action = 'Rejected';
          this.successMessage = `Request for "${req.userRight}" rejected.`;
          this.writeCache(USER_MGMT_CACHE.requests, this.rightsRequests);
          this.showTopToast(this.successMessage, 'info');
          setTimeout(() => this.clearMessages(), 4000);
        },
        error: () => {
          this.actionLoading = false;
          this.errorMessage = 'Failed to reject.';
          this.showTopToast(this.errorMessage, 'error');
          setTimeout(() => this.clearMessages(), 4000);
        }
      });
  }

  private grantRightToUser(req: RightsRequest): void {
    if (!req.requestedByEmail) return;
    const user = this.users.find(u => u.email?.toLowerCase() === req.requestedByEmail?.toLowerCase());
    if (!user) return;
    const userId = user._id || user.id;
    const rightKey = this.moduleIdToRightKey[req.code] || req.code;
    if (!rightKey || !userId) return;

    const updatedRights = { ...(user.rights || {}), [rightKey]: true };
    this.http.patch<any>(`${this.apiUrl}/${userId}/rights`, { rights: updatedRights }, { headers: this.getHeaders() }).subscribe({
      next: () => {
        user.rights = { ...(user.rights || {}), [rightKey]: true };
        this.rightsRequests = this.rightsRequests.map(item => item._id === req._id ? { ...item, status: 'Approved', action: 'Approved' } : item);

        const currentUser = this.authService.getUser();
        if (currentUser?.email?.toLowerCase() === req.requestedByEmail?.toLowerCase()) {
          const updatedUser = { ...currentUser, rights: updatedRights };
          const storage = localStorage.getItem('auth_token') ? localStorage : sessionStorage;
          storage.setItem('user_data', JSON.stringify(updatedUser));
          storage.setItem('currentUser', JSON.stringify(updatedUser));
        }

        this.writeCache(USER_MGMT_CACHE.users, this.users);
        this.writeCache(USER_MGMT_CACHE.requests, this.rightsRequests);
        if (req.requestedByEmail) {
          this.authService.refreshAnyUserSession(req.requestedByEmail).subscribe({ next: () => {}, error: () => {} });
        }
      }
    });
  }

  getRequestStatusClass(status: string): string {
    const s = (status || '').toLowerCase().replace(/\s+/g, '-');
    if (s === 'approved') return 'status-approved';
    if (s === 'rejected') return 'status-rejected';
    if (s === 'in-process' || s === 'pending') return 'status-inprocess';
    return 'status-pending';
  }

  hasAnyRight(rights?: UserRights): boolean {
    return rights ? Object.values(rights).some(v => v === true) : false;
  }

  getModuleDisplayName(key: string): string { return this.moduleDisplayNames[key] || key; }

  areAllRightsSelected(): boolean {
    const all = this.moduleCategories.flatMap(c => c.modules);
    return all.every(m => this.formData.rights?.[m] === true);
  }

  toggleAllRights(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    if (!this.formData.rights) this.formData.rights = {};
    this.moduleCategories.flatMap(c => c.modules).forEach(m => {
      if (this.formData.rights) this.formData.rights[m] = checked;
    });
  }

  openCreateModal(): void { this.resetForm(); this.showCreateModal = true; }

  openEditModal(user: User): void {
    this.selectedUser = user;
    this.formData = { ...user, password: '', rights: { ...(user.rights || {}) } };
    this.showEditModal = true;
  }

  closeModal(): void { this.showCreateModal = false; this.showEditModal = false; this.resetForm(); }

  resetForm(): void {
    this.formData = {
      name: '', email: '', password: '', role: 'User',
      department: '', contactNo: '', dateOfBirth: '', organization: '', rights: {}
    };
    this.selectedUser = null;
  }

  createUser(): void {
    if (!this.formData.name?.trim()) { this.errorMessage = 'Please enter full name.'; setTimeout(() => this.clearMessages(), 3000); return; }
    if (!this.formData.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formData.email)) { this.errorMessage = 'Please enter a valid email.'; setTimeout(() => this.clearMessages(), 3000); return; }
    if (!this.formData.password?.trim() || (this.formData.password?.length || 0) < 6) { this.errorMessage = 'Password must be at least 6 characters.'; setTimeout(() => this.clearMessages(), 3000); return; }

    this.isLoading = true;
    const originalPassword = this.formData.password!;
    const body = {
      name: this.formData.name.trim(),
      email: this.formData.email.trim().toLowerCase(),
      password: this.formData.password,
      role: this.formData.role,
      department: this.formData.department || '',
      contactNo: this.formData.contactNo || '',
      dateOfBirth: this.formData.dateOfBirth || '',
      organization: this.formData.organization || 'Radiant Appliances',
      rights: this.formData.rights || {}
    };

    this.http.post<any>(this.apiUrl, body, { headers: this.getHeaders() }).subscribe({
      next: res => {
        const newUser = res?.data || res;
        this.newUserCredentials = { email: this.formData.email || '', password: originalPassword };
        this.users.push(newUser);
        this.writeCache(USER_MGMT_CACHE.users, this.users);
        this.isLoading = false;
        this.showCreateModal = false;
        this.showCredentialsModal = true;
        this.successMessage = 'User created successfully!';
        this.resetForm();
        setTimeout(() => this.clearMessages(), 5000);
      },
      error: err => {
        this.errorMessage = err.status === 401 ? 'Unauthorized.' : err.error?.message || 'Failed to create user.';
        this.isLoading = false;
        setTimeout(() => this.clearMessages(), 5000);
      }
    });
  }

  updateUser(): void {
    const userId = this.selectedUser?._id || this.selectedUser?.id;
    if (!userId) { this.errorMessage = 'No user selected.'; return; }
    this.isLoading = true;

    this.http.patch<any>(`${this.apiUrl}/${userId}/rights`, { rights: this.formData.rights }, { headers: this.getHeaders() }).subscribe({
      next: () => {
        this.isLoading = false;
        this.showEditModal = false;
        this.successMessage = 'Permissions updated!';
        this.loadUsers();
        this.resetForm();

        const currentUser = this.authService.getUser();
        if (currentUser?.email?.toLowerCase() === this.selectedUser?.email?.toLowerCase()) {
          const updatedUser = { ...currentUser, rights: this.formData.rights };
          const storage = localStorage.getItem('auth_token') ? localStorage : sessionStorage;
          storage.setItem('user_data', JSON.stringify(updatedUser));
          storage.setItem('currentUser', JSON.stringify(updatedUser));
          this.authService.refreshUserRights().subscribe({ next: () => {}, error: () => {} });
        }
        setTimeout(() => this.clearMessages(), 3000);
      },
      error: err => {
        this.errorMessage = err.status === 401 ? 'Unauthorized.' : 'Failed to update.';
        this.isLoading = false;
        setTimeout(() => this.clearMessages(), 5000);
      }
    });
  }

  closeCredentialsModal(): void { this.showCredentialsModal = false; this.newUserCredentials = { email: '', password: '' }; }

  copyToClipboard(text: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => { this.successMessage = 'Copied!'; setTimeout(() => this.clearMessages(), 2000); },
      () => { this.errorMessage = 'Failed to copy.'; setTimeout(() => this.clearMessages(), 2000); }
    );
  }

  clearMessages(): void { this.successMessage = ''; this.errorMessage = ''; }
  getUserId(u: User): string { return u._id || u.id?.toString() || ''; }

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  private normalizeRightsRequests(requests: any[]): RightsRequest[] {
    return (requests || [])
      .map((r: any) => ({
        ...r,
        _id: r._id || r.id,
        requestedBy: this.resolveRequestUserName(r),
        requestedByEmail: this.resolveRequestUserEmail(r)
      }))
      .sort((a: any, b: any) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
  }

  private resolveRequestUserName(request: any): string {
    const directName = request?.requestedBy || request?.name || request?.user?.name || request?.requestedByUser?.name;
    if (directName && String(directName).trim()) return String(directName).trim();
    const email = this.resolveRequestUserEmail(request);
    const userName = this.getNameByEmail(email);
    if (userName) return userName;
    return this.buildNameFromEmail(email) || 'Unknown User';
  }

  private resolveRequestUserEmail(request: any): string {
    return request?.requestedByEmail || request?.email || request?.user?.email || request?.requestedByUser?.email || '';
  }

  private buildNameFromEmail(email: string): string {
    if (!email) return '';
    const localPart = email.split('@')[0] || '';
    return localPart.split(/[._-]+/).filter(Boolean).map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1)).join(' ');
  }

  private paintFromCache(): void {
    const cachedUsers = this.readCache(USER_MGMT_CACHE.users);
    const cachedRequests = this.readCache(USER_MGMT_CACHE.requests);
    if (cachedUsers?.length) {
      this.users = cachedUsers;
      this.isLoading = false;
    }
    if (cachedRequests?.length) {
      this.rightsRequests = this.normalizeRightsRequests(cachedRequests);
      this.isLoadingRequests = false;
    }
  }

  private writeCache(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify({ v: value, t: Date.now() }));
    } catch {}
  }

  private readCache(key: string): any {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return (Date.now() - parsed.t) > USER_MGMT_CACHE_TTL ? null : parsed.v;
    } catch {
      return null;
    }
  }
}
