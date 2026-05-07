import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { forkJoin, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

interface UserRightsRow {
  userRight: string;
  code: string;
  moduleId: string;
  view: boolean;
  creationEdit: boolean;
  approval: boolean;
  action: string;
  status: string;
  reason?: string;
  updatedAt?: string;
  canRequest?: boolean;
}

@Component({
  selector: 'app-user-rights',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-rights.html',
  styleUrls: ['./user-rights.scss']
})
export class UserRightsComponent implements OnInit {
  userRights: UserRightsRow[] = [];
  isLoading = true;
  currentUserName = '';
  currentUserEmail = '';
  accessNotice = '';

  private readonly apiUrl = environment.apiUrl;
  private readonly rightsCatalog = [
    { userRight: 'EP Approval', code: 'EPA', moduleId: 'ep-approval', rightKey: 'epApproval' },
    { userRight: 'Vendors', code: 'VEN', moduleId: 'vendors', rightKey: 'vendors' },
    { userRight: 'Parts', code: 'PAR', moduleId: 'parts', rightKey: 'parts' },
    { userRight: 'RFQ', code: 'RFQ', moduleId: 'rfq', rightKey: 'rfq' },
    { userRight: 'NPP Procurement', code: 'NPP', moduleId: 'npp-procurement', rightKey: 'nppProcurement' },
    { userRight: 'Bidding: Scrap Material', code: 'BID', moduleId: 'bidding', rightKey: 'bidding' },
    { userRight: 'Payment Request', code: 'PAY', moduleId: 'payment-request', rightKey: 'paymentRequest' },
    { userRight: 'DQMS', code: 'DQM', moduleId: 'dqms', rightKey: 'dqms' },
    { userRight: 'NPI', code: 'NPI', moduleId: 'npi', rightKey: 'npi' },
    { userRight: 'System BOM', code: 'SBM', moduleId: 'system-bom', rightKey: 'systemBom' },
    { userRight: 'BOM Part Forecasting', code: 'BPF', moduleId: 'bom-forecast', rightKey: 'bomForecast' },
    { userRight: 'Price Approval', code: 'PRA', moduleId: 'price-approval', rightKey: 'priceApproval' },
    { userRight: 'Plan Vs Stock', code: 'PVS', moduleId: 'plan-stock', rightKey: 'planStock' },
    { userRight: 'Supplier Performance', code: 'SUP', moduleId: 'supplier-performance', rightKey: 'supplierPerformance' },
    { userRight: 'Vehicular - MS', code: 'VEH', moduleId: 'vehicular-ms', rightKey: 'vehicularMs' },
    { userRight: 'User Management', code: 'USR', moduleId: 'user-management', rightKey: 'userManagement' }
  ];

  constructor(private authService: AuthService, private http: HttpClient) {}

  ngOnInit() {
    this.loadUserRights();
  }

  loadUserRights() {
    this.isLoading = true;

    const sessionUser = this.authService.getUser();
    this.currentUserName = sessionUser?.name || 'User';
    this.currentUserEmail = sessionUser?.email || '';

    forkJoin({
      me: this.authService.refreshUserRights().pipe(catchError(() => of(null))),
      requests: this.http.get<any>(`${this.apiUrl}/user-rights`, { headers: this.getHeaders() }).pipe(
        timeout(5000), 
        catchError(() => of(null))
      )
    }).subscribe(({ requests }) => {
      const latestUser = this.authService.getUser();
      const rights = latestUser?.rights || sessionUser?.rights || {};
      const myEmail = (latestUser?.email || sessionUser?.email || '').toLowerCase();

      this.currentUserName = latestUser?.name || sessionUser?.name || 'User';
      this.currentUserEmail = latestUser?.email || sessionUser?.email || '';

      const allRequests = requests?.data || (Array.isArray(requests) ? requests : []);
      const latestByModule = allRequests
        .filter((item: any) => item?.requestedByEmail?.toLowerCase() === myEmail)
        .sort((a: any, b: any) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime()
        )
        .reduce((acc: Record<string, any>, item: any) => {
          if (!acc[item.code]) acc[item.code] = item;
          if (item?.userRight && !acc[item.userRight]) acc[item.userRight] = item;
          return acc;
        }, {});

      this.userRights = this.rightsCatalog.map((module: any) => {
        const granted = rights?.[module.rightKey] === true;
        const latestRequest = latestByModule[module.moduleId] || latestByModule[module.code] || latestByModule[module.userRight];
        const latestStatus = latestRequest?.status || '';

        return {
          userRight: module.userRight,
          code: module.code,
          moduleId: module.moduleId,
          view: true,
          creationEdit: true,
          approval: granted,
          action: granted ? 'Granted for Lifetime' : this.isPendingStatus(latestStatus) ? 'Pending Approval' : latestStatus === 'Rejected' ? 'Request Again' : 'Request Access',
          status: granted ? 'Approved' : latestStatus || 'Not Requested',
          reason: latestRequest?.reason || '',
          updatedAt: latestRequest?.updatedAt || latestRequest?.createdAt || '',
          canRequest: !granted && !this.isPendingStatus(latestStatus)
        };
      });

      const approvedRows = this.userRights.filter(row => row.status === 'Approved');
      this.accessNotice = approvedRows.length
        ? `You have now eligible access for ${approvedRows.map(row => row.userRight).join(', ')}. Approved rights stay active for lifetime use.`
        : '';

      this.isLoading = false;
    });
  }

  requestAccess(row: UserRightsRow) {
    if (!row.canRequest) return;
    this.http.post<any>(`${this.apiUrl}/user-rights`, {
      userRight: row.userRight,
      code: row.moduleId,
      reason: `Access requested by ${this.currentUserName} from User Rights page.`,
      requestedBy: this.currentUserName,
      requestedByEmail: this.currentUserEmail,
      requestedByUserId: this.authService.getUser()?._id || this.authService.getUser()?.id || '',
      action: 'Request',
      status: 'In-process'
    }, { headers: this.getHeaders() }).pipe(
      timeout(5000),
      catchError(() => of(null))
    ).subscribe(res => {
      if (res?.success || res) {
        row.status = 'In-process';
        row.action = 'Pending Approval';
        row.canRequest = false;
      }
    });
  }

  trackByModule(_: number, row: UserRightsRow) {
    return row.moduleId;
  }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    });
  }

  private isPendingStatus(status: string): boolean {
    const s = (status || '').toLowerCase().trim().replace(/\s+/g, '-');
    return s === 'in-process' || s === 'inprocess' || s === 'pending';
  }
}
