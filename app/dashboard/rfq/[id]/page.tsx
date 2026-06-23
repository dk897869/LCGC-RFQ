'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { apiClient } from '@/lib/api-client';
import { LoadingSpinner, LoadingButton } from '@/components/loading-spinner';
import { ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { RFQ } from '@/lib/types';
import Link from 'next/link';

export default function RFQDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { isAuthenticated, addToast } = useStore();
  const [rfq, setRFQ] = useState<RFQ | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }

    const fetchRFQ = async () => {
      try {
        const response = await apiClient.getRFQById(id);
        if (response.data) {
          setRFQ(response.data);
        }
      } catch (err) {
        addToast('Failed to load RFQ', 'error');
        router.push('/dashboard/rfq');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRFQ();
  }, [id, isAuthenticated, router, addToast]);

  const handleApprove = async () => {
    if (!rfq) return;
    setIsApproving(true);
    try {
      await apiClient.approveRequest(rfq.id);
      setRFQ({ ...rfq, status: 'approved' });
      addToast('RFQ approved successfully', 'success');
    } catch (err) {
      addToast('Failed to approve RFQ', 'error');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rfq) return;
    setIsApproving(true);
    try {
      await apiClient.rejectRequest(rfq.id, 'Rejected by admin');
      setRFQ({ ...rfq, status: 'rejected' });
      addToast('RFQ rejected', 'success');
    } catch (err) {
      addToast('Failed to reject RFQ', 'error');
    } finally {
      setIsApproving(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen size="lg" message="Loading RFQ..." />;
  }

  if (!rfq) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-900 dark:text-white font-semibold mb-4">RFQ not found</p>
        <Link href="/dashboard/rfq" className="text-blue-600 dark:text-blue-400 hover:underline">
          Back to RFQs
        </Link>
      </div>
    );
  }

  const STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
    approved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-200', icon: CheckCircle },
    rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-200', icon: XCircle },
    submitted: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-200', icon: Clock },
    draft: { bg: 'bg-slate-100 dark:bg-slate-700/30', text: 'text-slate-800 dark:text-slate-200', icon: Clock },
  };

  const statusConfig = STATUS_COLORS[rfq.status] || STATUS_COLORS.draft;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/rfq"
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{rfq.title}</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">RFQ #{rfq.rfqNo}</p>
        </div>
      </div>

      {/* Status and Details */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Status</p>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${statusConfig.bg} ${statusConfig.text}`}>
              <StatusIcon className="w-4 h-4" />
              {rfq.status}
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Requester</p>
            <p className="font-semibold text-slate-900 dark:text-white">{rfq.requesterName}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Department</p>
            <p className="font-semibold text-slate-900 dark:text-white">{rfq.department}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Priority</p>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
              rfq.priority === 'urgent' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' :
              rfq.priority === 'high' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200' :
              rfq.priority === 'medium' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200' :
              'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
            }`}>
              {rfq.priority}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      {rfq.description && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Description</h3>
          <p className="text-slate-700 dark:text-slate-300">{rfq.description}</p>
        </div>
      )}

      {/* RFQ Items */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Items</h3>
        <div className="space-y-3">
          {rfq.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-slate-900 dark:text-white">{item.description}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Quantity: {item.quantity} {item.unit}</p>
                {item.specifications && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Specs: {item.specifications}</p>
                )}
              </div>
              {item.estimatedPrice && (
                <div className="text-right">
                  <p className="font-semibold text-slate-900 dark:text-white">${item.estimatedPrice}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Approvals Timeline */}
      {rfq.approvals && rfq.approvals.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Approval Timeline</h3>
          <div className="space-y-4">
            {rfq.approvals.map((approval, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                    approval.status === 'approved' ? 'bg-green-500' :
                    approval.status === 'rejected' ? 'bg-red-500' :
                    'bg-amber-500'
                  }`}>
                    {approval.status === 'approved' ? '✓' :
                     approval.status === 'rejected' ? '✗' : '⏳'}
                  </div>
                  {index < (rfq.approvals?.length || 0) - 1 && (
                    <div className="w-0.5 h-12 bg-slate-200 dark:bg-slate-600 my-2" />
                  )}
                </div>
                <div className="flex-1 pt-1">
                  <p className="font-semibold text-slate-900 dark:text-white">{approval.id}</p>
                  <p className={`text-sm font-medium ${
                    approval.status === 'approved' ? 'text-green-600 dark:text-green-400' :
                    approval.status === 'rejected' ? 'text-red-600 dark:text-red-400' :
                    'text-amber-600 dark:text-amber-400'
                  }`}>
                    {approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {rfq.status === 'submitted' && (
        <div className="flex gap-3">
          <LoadingButton
            onClick={handleApprove}
            isLoading={isApproving}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition-all"
          >
            Approve RFQ
          </LoadingButton>
          <LoadingButton
            onClick={handleReject}
            isLoading={isApproving}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-lg transition-all"
          >
            Reject RFQ
          </LoadingButton>
        </div>
      )}
    </div>
  );
}
