'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { apiClient } from '@/lib/api-client';
import { LoadingSpinner } from '@/components/loading-spinner';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';

const chartData = [
  { name: 'Jan', requests: 40, approved: 32 },
  { name: 'Feb', requests: 45, approved: 38 },
  { name: 'Mar', requests: 52, approved: 45 },
  { name: 'Apr', requests: 48, approved: 42 },
  { name: 'May', requests: 61, approved: 55 },
  { name: 'Jun', requests: 55, approved: 49 },
];

const typeData = [
  { name: 'RFQ', value: 45 },
  { name: 'PO', value: 30 },
  { name: 'Invoice', value: 25 },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, dashboardStats, setDashboardStats, addToast } = useStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }

    const fetchData = async () => {
      try {
        const response = await apiClient.getDashboardStats();
        if (response.data) {
          setDashboardStats(response.data);
        }
      } catch (err) {
        addToast('Failed to load dashboard data', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, router, setDashboardStats, addToast]);

  if (isLoading) {
    return <LoadingSpinner fullScreen size="lg" message="Loading dashboard..." />;
  }

  const stats = dashboardStats || {
    totalRequests: 6,
    pendingApprovals: 4,
    approvedRequests: 2,
    rejectedRequests: 0,
    successRate: 33,
    totalSpend: 150000,
    pendingAmount: 45000,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg p-8 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Good evening, {user?.name}!</h1>
            <p className="text-blue-100">Welcome back to your dashboard. Here&apos;s what&apos;s happening today.</p>
            <span className="inline-block mt-3 px-3 py-1 bg-blue-500/30 rounded-full text-sm font-medium">{user?.role?.toUpperCase()}</span>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">{new Date().getHours().toString().padStart(2, '0')}:{new Date().getMinutes().toString().padStart(2, '0')}</div>
            <div className="text-sm text-blue-100">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Requests"
          value={stats.totalRequests}
          icon={TrendingUp}
          color="blue"
          subtext="All time requests"
        />
        <KPICard
          title="Pending"
          value={stats.pendingApprovals}
          icon={Clock}
          color="amber"
          subtext="Waiting for approval"
        />
        <KPICard
          title="Approved"
          value={stats.approvedRequests}
          icon={CheckCircle}
          color="green"
          subtext="Successfully approved"
        />
        <KPICard
          title="Success Rate"
          value={`${stats.successRate}%`}
          icon={TrendingUp}
          color="purple"
          subtext="Overall success rate"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request Trend */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Request Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
              <Legend />
              <Line type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
              <Line type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Request Types */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Request Types</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={typeData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#8884d8" dataKey="value">
                {typeData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickActionButton label="Create RFQ" href="/dashboard/rfq" color="blue" />
          <QuickActionButton label="Create PO" href="/dashboard/po" color="green" />
          <QuickActionButton label="Pending Approvals" href="/dashboard/approvals" color="amber" />
          <QuickActionButton label="View Reports" href="/dashboard/vendors" color="purple" />
        </div>
      </div>
    </div>
  );
}

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'amber' | 'green' | 'purple';
  subtext: string;
}

function KPICard({ title, value, icon: Icon, color, subtext }: KPICardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  };

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-6 shadow-sm transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <h3 className="text-3xl font-bold mt-1">{value}</h3>
          <p className="text-xs opacity-60 mt-2">{subtext}</p>
        </div>
        <Icon className="w-12 h-12 opacity-20" />
      </div>
    </div>
  );
}

interface QuickActionButtonProps {
  label: string;
  href: string;
  color: string;
}

function QuickActionButton({ label, href, color }: QuickActionButtonProps) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    green: 'bg-green-600 hover:bg-green-700 text-white',
    amber: 'bg-amber-600 hover:bg-amber-700 text-white',
    purple: 'bg-purple-600 hover:bg-purple-700 text-white',
  };

  return (
    <Link
      href={href}
      className={`${colorClasses[color] || 'bg-blue-600 hover:bg-blue-700 text-white'} font-medium py-2 px-4 rounded-lg transition-all transform hover:scale-105 active:scale-95 text-center block`}
    >
      {label}
    </Link>
  );
}
