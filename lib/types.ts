// User and Authentication Types
export type UserRole = 'admin' | 'user' | 'vendor';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  phone?: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: User;
  tokens: AuthToken;
  message: string;
}

// OTP Types
export interface OTPRequest {
  email: string;
  type: 'login' | 'verify';
}

export interface OTPVerify {
  email: string;
  otp: string;
}

// RFQ Types
export type RFQStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'in_process' | 'completed';
export type RFQPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface RFQItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  estimatedPrice?: number;
  specifications?: string;
}

export interface RFQ {
  id: string;
  rfqNo: string;
  title: string;
  description?: string;
  items: RFQItem[];
  requesterId: string;
  requesterName?: string;
  department: string;
  priority: RFQPriority;
  status: RFQStatus;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  approvals?: Approval[];
}

// Purchase Order Types
export type POStatus = 'draft' | 'approved' | 'rejected' | 'in_delivery' | 'received' | 'cancelled';

export interface POItem {
  id: string;
  rfqItemId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  rfqId?: string;
  vendorId: string;
  vendorName?: string;
  items: POItem[];
  totalAmount: number;
  status: POStatus;
  deliveryDate?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  approvals?: Approval[];
}

// Vendor Types
export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
  rating?: number;
  totalTransactions?: number;
  status: 'active' | 'inactive' | 'blocked';
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    ifscCode?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Approval Types
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'awaiting';
export type ApprovalType = 'rfq' | 'po' | 'invoice';

export interface ApprovalStep {
  stepNumber: number;
  approverRole: string;
  approverName?: string;
  status: ApprovalStatus;
  comments?: string;
  approvedAt?: string;
}

export interface Approval {
  id: string;
  referenceId: string;
  referenceType: ApprovalType;
  status: ApprovalStatus;
  steps: ApprovalStep[];
  createdAt: string;
  updatedAt: string;
}

// Dashboard Statistics
export interface DashboardStats {
  totalRequests: number;
  pendingApprovals: number;
  approvedRequests: number;
  rejectedRequests: number;
  successRate: number;
  totalSpend?: number;
  pendingAmount?: number;
}

// Form Response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message: string;
  error?: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Request Filter Types
export interface RFQFilter {
  status?: RFQStatus;
  priority?: RFQPriority;
  department?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface POFilter {
  status?: POStatus;
  vendorId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ApprovalFilter {
  status?: ApprovalStatus;
  type?: ApprovalType;
  page?: number;
  limit?: number;
}
