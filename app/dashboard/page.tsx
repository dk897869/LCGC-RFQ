'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { formatCurrency, formatDate } from '@/lib/utils';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, FileText, Package, AlertCircle, CheckCircle, Clock } from 'lucide-react';

const chartData = [
  { month: 'Jan', rfqs: 12, pos: 8, vendors: 15 },
  { month: 'Feb', rfqs: 19, pos: 12, vendors: 18 },
  { month: 'Mar', rfqs: 25, pos: 18, vendors: 22 },
  { month: 'Apr', rfqs: 22, pos: 15, vendors: 20 },
  { month: 'May', rfqs: 28, pos: 21, vendors: 25 },
  { month: 'Jun', rfqs: 32, pos: 25, vendors: 28 },
];

const spendData = [
  { name: 'IT Equipment', value: 150000 },
  { name: 'Office Supplies', value: 35000 },
  { name: 'Facilities', value: 42000 },
  { name: 'Services', value: 28000 },
];

const COLORS = ['hsl(200 45% 38%)', 'hsl(215 35% 45%)', 'hsl(190 70% 45%)', 'hsl(142 70% 45%)'];

export default function DashboardPage() {
  const { rfqs, pos, vendors } = useStore();

  // Calculate stats
  const totalRFQs = rfqs.length;
  const activeRFQs = rfqs.filter((r) => r.status === 'published').length;
  const totalPOs = pos.length;
  const pendingApprovals = pos.filter((p) => p.status === 'pending_approval').length;
  const activeVendors = vendors.filter((v) => v.status === 'active').length;
  const totalSpend = pos.reduce((sum, p) => sum + p.totalAmount, 0);

  return (
    <div className="space-y-8 fade-in-up">
      {/* Page Header */}
      <div>
        <h1 className="section-header">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here&apos;s your procurement overview.</p>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FileText}
          label="Active RFQs"
          value={activeRFQs}
          total={totalRFQs}
          trend="+12%"
          color="primary"
        />
        <StatCard
          icon={Package}
          label="Purchase Orders"
          value={totalPOs}
          total={totalPOs}
          trend="+8%"
          color="secondary"
        />
        <StatCard
          icon={Users}
          label="Active Vendors"
          value={activeVendors}
          total={vendors.length}
          trend="+5%"
          color="accent"
        />
        <StatCard
          icon={TrendingUp}
          label="Total Spend"
          value={formatCurrency(totalSpend)}
          total={formatCurrency(totalSpend)}
          trend="+24%"
          color="success"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Procurement Activity</CardTitle>
            <CardDescription>RFQ, PO, and Vendor trends over 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="rfqs" stroke="hsl(200 45% 38%)" strokeWidth={2} />
                  <Line type="monotone" dataKey="pos" stroke="hsl(215 35% 45%)" strokeWidth={2} />
                  <Line type="monotone" dataKey="vendors" stroke="hsl(190 70% 45%)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Spend Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Spend Distribution</CardTitle>
            <CardDescription>By Category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={spendData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name} $${(value / 1000).toFixed(0)}K`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {spendData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                    }}
                    formatter={(value) => formatCurrency(value as number)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent RFQs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent RFQs</CardTitle>
            <CardDescription>Latest requests for quotation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rfqs.slice(0, 4).map((rfq) => (
                <div
                  key={rfq.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{rfq.title}</p>
                    <p className="text-xs text-muted-foreground">{rfq.number}</p>
                  </div>
                  <span className={`badge badge-${rfq.status === 'published' ? 'warning' : 'success'}`}>
                    {rfq.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>{pendingApprovals} awaiting approval</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pos.filter((p) => p.status === 'pending_approval').map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-lg border-l-4 border-warning bg-warning/5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{p.number}</p>
                    <p className="text-xs text-muted-foreground">{p.vendor}</p>
                  </div>
                  <p className="font-semibold text-foreground">{formatCurrency(p.totalAmount)}</p>
                </div>
              ))}
              {pendingApprovals === 0 && (
                <p className="text-center py-8 text-muted-foreground">No pending approvals</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  total?: string | number;
  trend?: string;
  color?: 'primary' | 'secondary' | 'accent' | 'success';
}

function StatCard({ icon: Icon, label, value, total, trend, color = 'primary' }: StatCardProps) {
  const colorMap = {
    primary: 'from-primary to-primary/80',
    secondary: 'from-secondary to-secondary/80',
    accent: 'from-accent to-accent/80',
    success: 'from-success to-success/80',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-2">{label}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {trend && <p className="text-xs text-success mt-2 font-semibold">{trend} this month</p>}
          </div>
          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colorMap[color]} flex items-center justify-center`}>
            <Icon className="text-white" size={24} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
