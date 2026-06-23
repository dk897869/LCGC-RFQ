'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { Check, X, Clock, AlertCircle, CheckCircle, Eye } from 'lucide-react';
import { useState } from 'react';

export default function ApprovalsPage() {
  const { pos, updatePO } = useStore();
  const [approvalFilter, setApprovalFilter] = useState<string>('pending');

  // Filter POs by approval status
  const filteredPOs = pos.filter((po) => {
    if (approvalFilter === 'pending') {
      return po.status === 'pending_approval' || po.approvals.some((a) => a.status === 'pending');
    } else if (approvalFilter === 'approved') {
      return po.status === 'approved' && po.approvals.every((a) => a.status === 'approved');
    } else if (approvalFilter === 'rejected') {
      return po.approvals.some((a) => a.status === 'rejected');
    }
    return true;
  });

  const stats = {
    pending: pos.filter((p) => p.status === 'pending_approval').length,
    approved: pos.filter((p) => p.status === 'approved').length,
    rejected: pos.filter((p) => p.approvals.some((a) => a.status === 'rejected')).length,
  };

  const handleApprove = (poId: string) => {
    const po = pos.find((p) => p.id === poId);
    if (po) {
      updatePO(poId, {
        status: 'approved',
        approvals: po.approvals.map((a) => ({
          ...a,
          status: 'approved' as const,
          approvedDate: new Date(),
        })),
      });
    }
  };

  const handleReject = (poId: string) => {
    const po = pos.find((p) => p.id === poId);
    if (po) {
      updatePO(poId, {
        status: 'cancelled',
        approvals: po.approvals.map((a) => ({
          ...a,
          status: 'rejected' as const,
          approvedDate: new Date(),
        })),
      });
    }
  };

  return (
    <div className="space-y-6 fade-in-up">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Approval Queue</h1>
        <p className="text-muted-foreground mt-1">Review and approve purchase orders</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<Clock size={24} />}
          label="Pending"
          value={stats.pending}
          color="warning"
        />
        <StatCard
          icon={<CheckCircle size={24} />}
          label="Approved"
          value={stats.approved}
          color="success"
        />
        <StatCard
          icon={<AlertCircle size={24} />}
          label="Rejected"
          value={stats.rejected}
          color="destructive"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            {(['pending', 'approved', 'rejected'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setApprovalFilter(filter)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  approvalFilter === filter
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Approval Cards */}
      <div className="space-y-4">
        {filteredPOs.map((po) => (
          <Card key={po.id}>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{po.number}</h3>
                    <p className="text-sm text-muted-foreground">{po.vendor}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge badge-${po.status === 'approved' ? 'success' : po.status === 'cancelled' ? 'destructive' : 'warning'}`}>
                      {po.status}
                    </span>
                  </div>
                </div>

                {/* Items Summary */}
                <div>
                  <p className="text-sm font-semibold text-foreground mb-3">Order Items</p>
                  <div className="space-y-2">
                    {po.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            Qty: {item.quantity} × {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(item.totalPrice)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="mt-4 pt-4 border-t border-border flex justify-end">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                      <p className="text-2xl font-bold text-primary">{formatCurrency(po.totalAmount)}</p>
                    </div>
                  </div>
                </div>

                {/* Approval Timeline */}
                <div>
                  <p className="text-sm font-semibold text-foreground mb-3">Approval Status</p>
                  <div className="space-y-3">
                    {po.approvals.map((approval, idx) => (
                      <div key={approval.id} className="flex items-start gap-4">
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                              approval.status === 'approved'
                                ? 'bg-success'
                                : approval.status === 'rejected'
                                  ? 'bg-destructive'
                                  : 'bg-warning'
                            }`}
                          >
                            {approval.status === 'approved' ? (
                              <Check size={16} />
                            ) : approval.status === 'rejected' ? (
                              <X size={16} />
                            ) : (
                              <Clock size={16} />
                            )}
                          </div>
                          {idx < po.approvals.length - 1 && (
                            <div className="w-0.5 h-12 bg-border my-2" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 pt-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-foreground">{approval.approver}</p>
                              <p
                                className={`text-sm font-medium ${
                                  approval.status === 'approved'
                                    ? 'text-success'
                                    : approval.status === 'rejected'
                                      ? 'text-destructive'
                                      : 'text-warning'
                                }`}
                              >
                                {approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}
                              </p>
                              {approval.approvedDate && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDateTime(approval.approvedDate)}
                                </p>
                              )}
                            </div>
                          </div>
                          {approval.comment && (
                            <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted/30 rounded">
                              {approval.comment}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Details */}
                <div className="border-t border-border pt-4 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Created Date</p>
                    <p className="text-sm font-semibold text-foreground">{formatDate(po.createdDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Delivery Date</p>
                    <p className="text-sm font-semibold text-foreground">{formatDate(po.deliveryDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Created By</p>
                    <p className="text-sm font-semibold text-foreground">{po.createdBy}</p>
                  </div>
                </div>

                {/* Actions */}
                {po.status === 'pending_approval' && (
                  <div className="border-t border-border pt-4 flex gap-3">
                    <button
                      onClick={() => handleApprove(po.id)}
                      className="flex-1 btn-primary flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={18} />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(po.id)}
                      className="flex-1 btn-outline text-destructive hover:bg-destructive/10 flex items-center justify-center gap-2"
                    >
                      <X size={18} />
                      Reject
                    </button>
                    <button className="px-4 btn-outline flex items-center justify-center gap-2">
                      <Eye size={18} />
                      View Details
                    </button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredPOs.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">
                No {approvalFilter} approvals at this time
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'warning' | 'success' | 'destructive';
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colorMap = {
    warning: 'from-warning to-warning/80',
    success: 'from-success to-success/80',
    destructive: 'from-destructive to-destructive/80',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-2">{label}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
          </div>
          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colorMap[color]} flex items-center justify-center text-white`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
