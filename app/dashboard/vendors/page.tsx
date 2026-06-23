'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { apiClient } from '@/lib/api-client';
import { LoadingSpinner } from '@/components/loading-spinner';
import { Search, Plus, Eye, Mail, Phone, MapPin, Star, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
  inactive: 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200',
  blocked: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
};

export default function VendorsPage() {
  const router = useRouter();
  const { isAuthenticated, vendors, setVendors, addToast } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'blocked'>('all');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }

    const fetchVendors = async () => {
      try {
        const response = await apiClient.getVendorList();
        if (response.data) {
          setVendors(response.data);
        }
      } catch (err) {
        addToast('Failed to load vendors', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchVendors();
  }, [isAuthenticated, router, setVendors, addToast]);

  const filteredVendors = vendors.filter((vendor) => {
    const matchesSearch =
      vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || vendor.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return <LoadingSpinner fullScreen size="lg" message="Loading vendors..." />;
  }

  const activeVendors = vendors.filter((v) => v.status === 'active').length;
  const avgRating = vendors.length > 0
    ? (vendors.reduce((sum, v) => sum + (v.rating || 0), 0) / vendors.length).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Vendor Management</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Manage and monitor your vendor network</p>
        </div>
        <Link
          href="/dashboard/vendors/add"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Add Vendor
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Vendors</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{vendors.length}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Active</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{activeVendors}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <span className="text-green-600 dark:text-green-400 font-bold text-lg">✓</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Average Rating</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{avgRating}</p>
            </div>
            <Star className="w-12 h-12 text-yellow-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Transactions</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                {vendors.reduce((sum, v) => sum + (v.totalTransactions || 0), 0)}
              </p>
            </div>
            <TrendingUp className="w-12 h-12 text-purple-500 opacity-20" />
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
                placeholder="Search by vendor name, email, or phone..."
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
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>
      </div>

      {/* Vendors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVendors.length > 0 ? (
          filteredVendors.map((vendor) => (
            <div
              key={vendor.id}
              className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg transition-all"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{vendor.name}</h3>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[vendor.status]}`}>
                    {vendor.status}
                  </span>
                </div>
                {vendor.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span className="font-semibold text-slate-900 dark:text-white">{vendor.rating}</span>
                  </div>
                )}
              </div>

              {/* Contact Info */}
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Mail className="w-4 h-4" />
                  <a href={`mailto:${vendor.email}`} className="hover:text-blue-600 dark:hover:text-blue-400">
                    {vendor.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Phone className="w-4 h-4" />
                  <span>{vendor.phone}</span>
                </div>
                {vendor.city && (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <MapPin className="w-4 h-4" />
                    <span>
                      {vendor.city}
                      {vendor.country && `, ${vendor.country}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-200 dark:border-slate-700 mb-4">
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Transactions</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{vendor.totalTransactions || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Rating</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{vendor.rating || 'N/A'}</p>
                </div>
              </div>

              {/* Actions */}
              <Link
                href={`/dashboard/vendors/${vendor.id}`}
                className="w-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                View Details
              </Link>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
            <p className="text-slate-900 dark:text-white font-semibold mb-2">No vendors found</p>
            <p className="text-slate-600 dark:text-slate-400">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
