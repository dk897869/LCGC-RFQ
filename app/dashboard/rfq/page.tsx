'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { apiClient } from '@/lib/api-client';
import { LoadingSpinner, LoadingButton } from '@/components/loading-spinner';
import { Search, Plus, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  approved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-200', icon: CheckCircle },
  rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-200', icon: XCircle },
  in_process: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-200', icon: Clock },
  submitted: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-200', icon: Clock },
  draft: { bg: 'bg-slate-100 dark:bg-slate-700/30', text: 'text-slate-800 dark:text-slate-200', icon: Clock },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  medium: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
  high: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20',
  urgent: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
};

export default function RFQPage() {
  const router = useRouter();
  const { isAuthenticated, rfqs, setRFQs, selectedRFQFilter, setSelectedRFQFilter, addToast } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isApproving, setIsApproving] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }

    const fetchRFQs = async () => {
      try {
        const response = await apiClient.getRFQList({ status: selectedRFQFilter === 'all' ? undefined : (selectedRFQFilter as any) });
        if (response.data?.data) {
          setRFQs(response.data.data);
        }
      } catch (err) {
        addToast('Failed to load RFQs', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRFQs();
  }, [isAuthenticated, router, selectedRFQFilter, setRFQs, addToast]);

  const filteredRFQs = rfqs.filter((rfq) =>
    rfq.rfqNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rfq.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rfq.requesterName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleApprove = async (id: string) => {
    setIsApproving(id);
    try {
      await apiClient.approveRequest(id);
      setRFQs(rfqs.map((r) => (r.id === id ? { ...r, status: 'approved' } : r)));
      addToast('RFQ approved successfully', 'success');
    } catch (err) {
      addToast('Failed to approve RFQ', 'error');
    } finally {
      setIsApproving(null);
    }
  };

  const handleReject = async (id: string) => {
    setIsApproving(id);
    try {
      await apiClient.rejectRequest(id, 'Rejected by admin');
      setRFQs(rfqs.map((r) => (r.id === id ? { ...r, status: 'rejected' } : r)));
      addToast('RFQ rejected', 'success');
    } catch (err) {
      addToast('Failed to reject RFQ', 'error');
    } finally {
      setIsApproving(null);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen size="lg" message="Loading RFQs..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">RFQ Management</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Manage all requests for quotation</p>
        </div>
        <Link
          href="/dashboard/rfq/create"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Create New RFQ
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by RFQ no, title, or requester..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Status Filter</label>
            <select
              value={selectedRFQFilter}
              onChange={(e) => setSelectedRFQFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="in_process">In Process</option>
              <option value="submitted">Submitted</option>
            </select>
          </div>
        </div>
      </div>

      {/* RFQ Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">RFQ No</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Title</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Requester</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Priority</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredRFQs.length > 0 ? (
                filteredRFQs.map((rfq) => {
                  const statusConfig = STATUS_COLORS[rfq.status] || STATUS_COLORS.submitted;
                  const StatusIcon = statusConfig.icon;

                  return (
                    <tr key={rfq.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{rfq.rfqNo}</td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{rfq.title}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{rfq.requesterName}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${PRIORITY_COLORS[rfq.priority] || PRIORITY_COLORS.medium}`}>
                          {rfq.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.bg} ${statusConfig.text}`}>
                          <StatusIcon className="w-4 h-4" />
                          {rfq.status}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{new Date(rfq.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <Link
                          href={`/dashboard/rfq/${rfq.id}`}
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Link>
                        {rfq.status === 'submitted' && (
                          <>
                            <LoadingButton
                              onClick={() => handleApprove(rfq.id)}
                              isLoading={isApproving === rfq.id}
                              className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline bg-transparent border-0 p-0"
                            >
                              Approve
                            </LoadingButton>
                            <LoadingButton
                              onClick={() => handleReject(rfq.id)}
                              isLoading={isApproving === rfq.id}
                              className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 hover:underline bg-transparent border-0 p-0"
                            >
                              Reject
                            </LoadingButton>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    <p className="font-medium">No RFQs found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Total Count */}
      <div className="text-sm text-slate-600 dark:text-slate-400">
        Total: <span className="font-semibold">{filteredRFQs.length}</span> RFQs
      </div>
    </div>
  );
}
