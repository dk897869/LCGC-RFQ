import {
  ApiResponse,
  PaginatedResponse,
  User,
  RFQ,
  PurchaseOrder,
  Vendor,
  Approval,
  DashboardStats,
  RFQFilter,
  POFilter,
  ApprovalFilter,
  AuthResponse,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

class APIClient {
  private baseURL: string;
  private token: string | null = null;

  constructor() {
    this.baseURL = API_BASE_URL;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('accessToken');
    }
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  }

  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('accessToken', token);
  }

  clearToken(): void {
    this.token = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  // ============ AUTH ENDPOINTS ============

  async requestOTP(email: string): Promise<ApiResponse<{ message: string }>> {
    const response = await fetch(`${this.baseURL}/auth/otp-request`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email }),
    });
    return this.handleResponse(response);
  }

  async verifyOTP(email: string, otp: string): Promise<ApiResponse<AuthResponse>> {
    const response = await fetch(`${this.baseURL}/auth/verify-otp`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email, otp }),
    });
    const result = await this.handleResponse<AuthResponse>(response);
    if (result.data?.tokens.accessToken) {
      this.setToken(result.data.tokens.accessToken);
    }
    return result;
  }

  async googleLogin(googleToken: string): Promise<ApiResponse<AuthResponse>> {
    const response = await fetch(`${this.baseURL}/auth/google`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ token: googleToken }),
    });
    const result = await this.handleResponse<AuthResponse>(response);
    if (result.data?.tokens.accessToken) {
      this.setToken(result.data.tokens.accessToken);
    }
    return result;
  }

  async logout(): Promise<void> {
    this.clearToken();
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response = await fetch(`${this.baseURL}/auth/me`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============ RFQ ENDPOINTS ============

  async getRFQList(filters?: RFQFilter): Promise<ApiResponse<PaginatedResponse<RFQ>>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.department) params.append('department', filters.department);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${this.baseURL}/rfq?${params}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getRFQById(id: string): Promise<ApiResponse<RFQ>> {
    const response = await fetch(`${this.baseURL}/rfq/${id}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createRFQ(data: Partial<RFQ>): Promise<ApiResponse<RFQ>> {
    const response = await fetch(`${this.baseURL}/rfq`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateRFQ(id: string, data: Partial<RFQ>): Promise<ApiResponse<RFQ>> {
    const response = await fetch(`${this.baseURL}/rfq/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // ============ PURCHASE ORDER ENDPOINTS ============

  async getPOList(filters?: POFilter): Promise<ApiResponse<PaginatedResponse<PurchaseOrder>>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.vendorId) params.append('vendorId', filters.vendorId);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${this.baseURL}/po?${params}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getPOById(id: string): Promise<ApiResponse<PurchaseOrder>> {
    const response = await fetch(`${this.baseURL}/po/${id}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createPO(data: Partial<PurchaseOrder>): Promise<ApiResponse<PurchaseOrder>> {
    const response = await fetch(`${this.baseURL}/po`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // ============ VENDOR ENDPOINTS ============

  async getVendorList(): Promise<ApiResponse<Vendor[]>> {
    const response = await fetch(`${this.baseURL}/vendor`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getVendorById(id: string): Promise<ApiResponse<Vendor>> {
    const response = await fetch(`${this.baseURL}/vendor/${id}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============ APPROVAL ENDPOINTS ============

  async getApprovalList(filters?: ApprovalFilter): Promise<ApiResponse<PaginatedResponse<Approval>>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${this.baseURL}/approval?${params}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async approveRequest(id: string, comments?: string): Promise<ApiResponse<Approval>> {
    const response = await fetch(`${this.baseURL}/approval/${id}/approve`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ comments }),
    });
    return this.handleResponse(response);
  }

  async rejectRequest(id: string, comments: string): Promise<ApiResponse<Approval>> {
    const response = await fetch(`${this.baseURL}/approval/${id}/reject`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ comments }),
    });
    return this.handleResponse(response);
  }

  // ============ DASHBOARD ENDPOINTS ============

  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    const response = await fetch(`${this.baseURL}/dashboard/stats`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============ ERROR HANDLER ============

  async handleError(error: unknown): Promise<string> {
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }
}

export const apiClient = new APIClient();
