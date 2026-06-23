'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { Plus, Search, Filter, Eye, Edit, Trash2, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { useState } from 'react';

export default function POPage() {
  const { pos, deletePO } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredPOs = pos.filter((po) => {
    const matchesSearch =
      po.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.vendor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: pos.length,
    approved: pos.filter((p) => p.status === 'approved').length,
    pending: pos.filter((p) => p.status === 'pending_approval').length,
    totalValue: pos.reduce((sum, p) => sum + p.totalAmount, 0),
  };

  return (
    <div className="space-y-6 fade-in-up">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-muted-foreground mt-1">Manage and track purchase orders</p>
        </div>
        <button className="btn-primary flex items-center justify-center gap-2 w-full md:w-auto">
          <Plus size={20} />
          Create PO
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatBox label="Total POs" value={stats.total} color="primary" />
        <StatBox label="Pending Approvals" value={stats.pending} color="warning" />
        <StatBox label="Approved" value={stats.approved} color="success" />
        <StatBox label="Total Value" value={formatCurrency(stats.totalValue)} color="accent" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                type="text"
                placeholder="Search by PO number or vendor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={20} className="text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PO Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Purchase Orders</CardTitle>
              <CardDescription>{filteredPOs.length} PO(s) found</CardDescription>
            </div>
            <Download size={20} className="text-muted-foreground cursor-pointer hover:text-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-semibold text-foreground">PO Number</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Vendor</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Delivery</th>
                  <th className="px-4 py-3 text-right font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPOs.map((po) => (
                  <tr key={po.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-primary">{po.number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-foreground">{po.vendor}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{formatCurrency(po.totalAmount)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge badge-${getStatusColor(po.status)}`}>
                        {po.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-muted-foreground">{formatDate(po.deliveryDate)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="View">
                          <Eye size={18} className="text-muted-foreground" />
                        </button>
                        <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="Edit">
                          <Edit size={18} className="text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => deletePO(po.id)}
                          className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} className="text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredPOs.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No purchase orders found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* PO Detail Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredPOs.slice(0, 2).map((po) => (
          <Card key={po.id} className="overflow-hidden">
            <CardHeader className="border-b border-border">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{po.number}</CardTitle>
                  <CardDescription>{po.vendor}</CardDescription>
                </div>
                <span className={`badge badge-${getStatusColor(po.status)}`}>
                  {po.status}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Items */}
                <div>
                  <p className="text-sm font-semibold text-foreground mb-3">Items</p>
                  <div className="space-y-2">
                    {po.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} x {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(item.totalPrice)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Total Amount</span>
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(po.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Timeline */}
                <div className="pt-4 border-t border-border space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="text-sm font-medium text-foreground">{formatDate(po.createdDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        po.status === 'received' ? 'bg-success' : 'bg-warning'
                      }`}
                    />
                    <div>
                      <p className="text-xs text-muted-foreground">Delivery Expected</p>
                      <p className="text-sm font-medium text-foreground">{formatDate(po.deliveryDate)}</p>
                    </div>
                  </div>
                </div>

                {/* Approvals */}
                {po.approvals.length > 0 && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm font-semibold text-foreground mb-2">Approvals</p>
                    <div className="space-y-2">
                      {po.approvals.map((approval) => (
                        <div
                          key={approval.id}
                          className="flex items-center gap-2 p-2 bg-muted/30 rounded"
                        >
                          {approval.status === 'approved' ? (
                            <CheckCircle size={16} className="text-success" />
                          ) : (
                            <AlertCircle size={16} className="text-warning" />
                          )}
                          <span className="text-sm text-foreground flex-1">{approval.approver}</span>
                          <span
                            className={`text-xs font-semibold ${
                              approval.status === 'approved'
                                ? 'text-success'
                                : 'text-warning'
                            }`}
                          >
                            {approval.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface StatBoxProps {
  label: string;
  value: string | number;
  color: 'primary' | 'secondary' | 'accent' | 'success' | 'warning';
}

function StatBox({ label, value, color }: StatBoxProps) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    secondary: 'bg-secondary/10 text-secondary border-secondary/20',
    accent: 'bg-accent/10 text-accent border-accent/20',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorMap[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
