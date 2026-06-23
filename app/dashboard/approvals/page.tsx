'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { apiClient } from '@/lib/api-client';
import { LoadingSpinner, LoadingButton } from '@/components/loading-spinner';
import { CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import type { Approval } from '@/lib/types';

export default function ApprovalsPage() {
  const router = useRouter();
  const { isAuthenticated, approvals, setApprovals, addToast } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [comments, setComments] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }

    const fetchApprovals = async () => {
      try {
        const response = await apiClient.getApprovalList({ status: 'pending' });
        if (response.data?.data) {
          setApprovals(response.data.data);
        }
      } catch (err) {
        addToast('Failed to load approvals', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchApprovals();
  }, [isAuthenticated, router, setApprovals, addToast]);

  const handleApprove = async (id: string) => {
    setIsProcessing(id);
    try {
      await apiClient.approveRequest(id, comments);
      setApprovals(approvals.map((a) => (a.id === id ? { ...a, status: 'approved' } : a)));
      setComments('');
      setSelectedApproval(null);
      addToast('Request approved successfully', 'success');
    } catch (err) {
      addToast('Failed to approve request', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    setIsProcessing(id);
    try {
      await apiClient.rejectRequest(id, comments || 'Rejected');
      setApprovals(approvals.map((a) => (a.id === id ? { ...a, status: 'rejected' } : a)));
      setComments('');
      setSelectedApproval(null);
      addToast('Request rejected', 'success');
    } catch (err) {
      addToast('Failed to reject request', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen size="lg" message="Loading approvals..." />;
  }

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const approvedApprovals = approvals.filter((a) => a.status === 'approved');
  const rejectedApprovals = approvals.filter((a) => a.status === 'rejected');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Pending Approvals</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">Review and approve requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Pending</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{pendingApprovals.length}</p>
            </div>
            <Clock className="w-12 h-12 text-amber-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Approved</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{approvedApprovals.length}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Rejected</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{rejectedApprovals.length}</p>
            </div>
            <XCircle className="w-12 h-12 text-red-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Pending Approvals List */}
      <div className="space-y-4">
        {pendingApprovals.length > 0 ? (
          pendingApprovals.map((approval) => (
            <div
              key={approval.id}
              className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="inline-block px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-full text-xs font-semibold">
                      {approval.referenceType.toUpperCase()}
                    </span>
                    <span className="text-sm text-slate-600 dark:text-slate-400">ID: {approval.referenceId}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Created on {new Date(approval.createdAt).toLocaleDateString()}
                  </p>

                  {/* Approval Steps */}
                  <div className="mt-4 space-y-2">
                    {approval.steps.map((step, index) => (
                      <div key={index} className="flex items-center gap-3 text-sm">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-semibold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900 dark:text-white">{step.approverName || step.approverRole}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {step.status === 'approved' && `Approved on ${new Date(step.approvedAt || '').toLocaleDateString()}`}
                            {step.status === 'rejected' && `Rejected on ${new Date(step.approvedAt || '').toLocaleDateString()}`}
                            {step.status === 'pending' && 'Awaiting approval'}
                          </p>
                        </div>
                        <div className="flex justify-center">
                          {step.status === 'approved' && <CheckCircle className="w-5 h-5 text-green-500" />}
                          {step.status === 'rejected' && <XCircle className="w-5 h-5 text-red-500" />}
                          {step.status === 'pending' && <Clock className="w-5 h-5 text-amber-500" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedApproval(approval)}
                    className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors font-medium text-sm flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Review
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4 opacity-20" />
            <p className="text-slate-900 dark:text-white font-semibold mb-2">All caught up!</p>
            <p className="text-slate-600 dark:text-slate-400">No pending approvals at the moment</p>
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {selectedApproval && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              {selectedApproval.referenceType.toUpperCase()} Approval
            </h3>

            <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Reference ID</p>
              <p className="font-semibold text-slate-900 dark:text-white text-sm">{selectedApproval.referenceId}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Comments (Optional)</label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add your comments..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <LoadingButton
                onClick={() => handleApprove(selectedApproval.id)}
                isLoading={isProcessing === selectedApproval.id}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg transition-all"
              >
                Approve
              </LoadingButton>
              <LoadingButton
                onClick={() => handleReject(selectedApproval.id)}
                isLoading={isProcessing === selectedApproval.id}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg transition-all"
              >
                Reject
              </LoadingButton>
              <button
                onClick={() => {
                  setSelectedApproval(null);
                  setComments('');
                }}
                className="flex-1 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium py-2 rounded-lg transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
