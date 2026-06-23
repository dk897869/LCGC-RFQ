import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'user' | 'approver';
  department?: string;
}

export interface RFQ {
  id: string;
  number: string;
  title: string;
  description: string;
  status: 'draft' | 'published' | 'closed' | 'awarded';
  budget: number;
  createdDate: Date;
  dueDate: Date;
  vendor?: string;
  createdBy: string;
  items: RFQItem[];
}

export interface RFQItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  estimatedPrice?: number;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  rfqId?: string;
  vendor: string;
  totalAmount: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'received' | 'cancelled';
  createdDate: Date;
  deliveryDate: Date;
  approvals: ApprovalStep[];
  items: POItem[];
  createdBy: string;
}

export interface POItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ApprovalStep {
  id: string;
  approver: string;
  status: 'pending' | 'approved' | 'rejected';
  comment?: string;
  approvedDate?: Date;
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  rating: number;
  status: 'active' | 'inactive' | 'blocked';
  totalOrders: number;
}

interface AppStore {
  user: User | null;
  setUser: (user: User | null) => void;
  rfqs: RFQ[];
  addRFQ: (rfq: RFQ) => void;
  updateRFQ: (id: string, rfq: Partial<RFQ>) => void;
  deleteRFQ: (id: string) => void;
  pos: PurchaseOrder[];
  addPO: (po: PurchaseOrder) => void;
  updatePO: (id: string, po: Partial<PurchaseOrder>) => void;
  deletePO: (id: string) => void;
  vendors: Vendor[];
  addVendor: (vendor: Vendor) => void;
  updateVendor: (id: string, vendor: Partial<Vendor>) => void;
  deleteVendor: (id: string) => void;
}

const mockUser: User = {
  id: '1',
  name: 'John Developer',
  email: 'john@lcgc.com',
  role: 'admin',
  department: 'Procurement',
};

const mockRFQs: RFQ[] = [
  {
    id: '1',
    number: 'RFQ-2024-001',
    title: 'Office Supplies Procurement',
    description: 'Annual office supplies including stationery and equipment',
    status: 'published',
    budget: 50000,
    createdDate: new Date('2024-01-15'),
    dueDate: new Date('2024-02-15'),
    createdBy: '1',
    items: [
      { id: '1', description: 'Printer Paper A4', quantity: 100, unit: 'reams', estimatedPrice: 500 },
      { id: '2', description: 'Ink Cartridges', quantity: 50, unit: 'units', estimatedPrice: 2500 },
    ],
  },
  {
    id: '2',
    number: 'RFQ-2024-002',
    title: 'IT Equipment Bid',
    description: 'Desktop computers and monitors for office expansion',
    status: 'awarded',
    budget: 150000,
    createdDate: new Date('2024-01-20'),
    dueDate: new Date('2024-02-20'),
    vendor: 'TechSupplies Inc',
    createdBy: '1',
    items: [
      { id: '1', description: 'Desktop Computer', quantity: 30, unit: 'units', estimatedPrice: 90000 },
      { id: '2', description: 'Monitor 27inch', quantity: 30, unit: 'units', estimatedPrice: 45000 },
    ],
  },
];

const mockPOs: PurchaseOrder[] = [
  {
    id: '1',
    number: 'PO-2024-001',
    rfqId: '1',
    vendor: 'Office Depot',
    totalAmount: 3000,
    status: 'approved',
    createdDate: new Date('2024-01-20'),
    deliveryDate: new Date('2024-02-05'),
    approvals: [
      { id: '1', approver: 'Manager', status: 'approved', approvedDate: new Date('2024-01-21') },
    ],
    items: [
      { id: '1', description: 'Printer Paper A4', quantity: 100, unitPrice: 5, totalPrice: 500 },
    ],
    createdBy: '1',
  },
];

const mockVendors: Vendor[] = [
  {
    id: '1',
    name: 'TechSupplies Inc',
    email: 'sales@techsupplies.com',
    phone: '+1-555-0100',
    address: '123 Tech Street, Silicon Valley, CA',
    category: 'IT Equipment',
    rating: 4.8,
    status: 'active',
    totalOrders: 12,
  },
  {
    id: '2',
    name: 'Office Depot',
    email: 'business@officedepot.com',
    phone: '+1-555-0200',
    address: '456 Office Ave, New York, NY',
    category: 'Office Supplies',
    rating: 4.5,
    status: 'active',
    totalOrders: 8,
  },
];

export const useStore = create<AppStore>((set) => ({
  user: mockUser,
  setUser: (user) => set({ user }),

  rfqs: mockRFQs,
  addRFQ: (rfq) => set((state) => ({ rfqs: [...state.rfqs, rfq] })),
  updateRFQ: (id, updates) =>
    set((state) => ({
      rfqs: state.rfqs.map((rfq) => (rfq.id === id ? { ...rfq, ...updates } : rfq)),
    })),
  deleteRFQ: (id) => set((state) => ({ rfqs: state.rfqs.filter((rfq) => rfq.id !== id) })),

  pos: mockPOs,
  addPO: (po) => set((state) => ({ pos: [...state.pos, po] })),
  updatePO: (id, updates) =>
    set((state) => ({
      pos: state.pos.map((po) => (po.id === id ? { ...po, ...updates } : po)),
    })),
  deletePO: (id) => set((state) => ({ pos: state.pos.filter((po) => po.id !== id) })),

  vendors: mockVendors,
  addVendor: (vendor) => set((state) => ({ vendors: [...state.vendors, vendor] })),
  updateVendor: (id, updates) =>
    set((state) => ({
      vendors: state.vendors.map((vendor) => (vendor.id === id ? { ...vendor, ...updates } : vendor)),
    })),
  deleteVendor: (id) => set((state) => ({ vendors: state.vendors.filter((vendor) => vendor.id !== id) })),
}));
