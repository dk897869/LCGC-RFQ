'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { apiClient } from '@/lib/api-client';
import { LoadingSpinner } from '@/components/loading-spinner';
import { Search, Plus, Eye, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
  draft: 'bg-slate-100 dark:bg-slate-700/30 text-slate-800 dark:text-slate-200',
  in_delivery: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
  received: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200',
  cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
  rejected: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
};

export default function POPage() {
  const router = useRouter();
  const { isAuthenticated, pos, setPOs, addToast } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }

    const fetchPOs = async () => {
      try {
        const response = await apiClient.getPOList({ status: statusFilter === 'all' ? undefined : (statusFilter as any) });
        if (response.data?.data) {
          setPOs(response.data.data);
        }
      } catch (err) {
        addToast('Failed to load purchase orders', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPOs();
  }, [isAuthenticated, router, statusFilter, setPOs, addToast]);

  const filteredPOs = pos.filter((po) => {
    const matchesSearch =
      po.poNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.vendorName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (isLoading) {
    return <LoadingSpinner fullScreen size="lg" message="Loading purchase orders..." />;
  }

  const stats = {
    total: pos.length,
    approved: pos.filter((p) => p.status === 'approved').length,
    pending: pos.filter((p) => p.status === 'draft').length,
    totalValue: pos.reduce((sum, p) => sum + p.totalAmount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Purchase Orders</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Manage and track purchase orders</p>
        </div>
        <Link
          href="/dashboard/po/create"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Create PO
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total POs</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Pending</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.pending}</p>
            </div>
            <Clock className="w-12 h-12 text-amber-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Approved</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.approved}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Value</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">${(stats.totalValue / 1000).toFixed(0)}K</p>
            </div>
            <CheckCircle className="w-12 h-12 text-purple-500 opacity-20" />
          </div>
        </div>
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
                placeholder="Search by PO number or vendor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Status Filter</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="in_delivery">In Delivery</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* POs Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">PO Number</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Vendor</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Items</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredPOs.length > 0 ? (
                filteredPOs.map((po) => {
                  const statusColor = STATUS_COLORS[po.status] || 'bg-slate-100 dark:bg-slate-700/30 text-slate-800 dark:text-slate-200';
                  return (
                    <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{po.poNo}</td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{po.vendorName || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">${po.totalAmount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{po.items.length} items</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{new Date(po.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm">
                        <Link
                          href={`/dashboard/po/${po.id}`}
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    <p className="font-medium">No purchase orders found</p>
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
        Total: <span className="font-semibold">{filteredPOs.length}</span> purchase orders
      </div>
    </div>
  );
}
