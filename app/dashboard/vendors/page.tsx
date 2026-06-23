'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { Plus, Search, Filter, Eye, Edit, Trash2, Star, MapPin, Mail, Phone, Zap } from 'lucide-react';
import { useState } from 'react';

export default function VendorsPage() {
  const { vendors, deleteVendor } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredVendors = vendors.filter((vendor) => {
    const matchesSearch =
      vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || vendor.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: vendors.length,
    active: vendors.filter((v) => v.status === 'active').length,
    avgRating:
      vendors.length > 0
        ? (vendors.reduce((sum, v) => sum + v.rating, 0) / vendors.length).toFixed(1)
        : 0,
    totalOrders: vendors.reduce((sum, v) => sum + v.totalOrders, 0),
  };

  return (
    <div className="space-y-6 fade-in-up">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Vendor Management</h1>
          <p className="text-muted-foreground mt-1">Manage and monitor vendor relationships</p>
        </div>
        <button className="btn-primary flex items-center justify-center gap-2 w-full md:w-auto">
          <Plus size={20} />
          Add Vendor
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatBox label="Total Vendors" value={stats.total} icon={<Users size={24} />} />
        <StatBox label="Active" value={stats.active} icon={<Zap size={24} />} />
        <StatBox label="Avg Rating" value={`${stats.avgRating} ⭐`} icon={<Star size={24} />} />
        <StatBox label="Total Orders" value={stats.totalOrders} icon={<Package size={24} />} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                type="text"
                placeholder="Search vendors by name or email..."
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
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vendors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVendors.map((vendor) => (
          <Card key={vendor.id} className="flex flex-col">
            <CardHeader className="border-b border-border">
              <div className="flex items-start justify-between mb-2">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg">
                  {vendor.name.charAt(0)}
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    vendor.status === 'active'
                      ? 'bg-success/10 text-success'
                      : vendor.status === 'blocked'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {vendor.status}
                </span>
              </div>
              <CardTitle className="text-lg">{vendor.name}</CardTitle>
              <CardDescription>{vendor.category}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pt-6 space-y-4">
              {/* Rating */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className={
                        i < Math.floor(vendor.rating)
                          ? 'fill-warning text-warning'
                          : 'text-muted'
                      }
                    />
                  ))}
                </div>
                <span className="text-sm font-semibold text-foreground">{vendor.rating}/5</span>
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={16} className="text-muted-foreground" />
                  <a href={`mailto:${vendor.email}`} className="text-accent hover:underline truncate">
                    {vendor.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={16} className="text-muted-foreground" />
                  <span className="text-foreground">{vendor.phone}</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-foreground text-xs">{vendor.address}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="pt-4 border-t border-border grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold text-primary">{vendor.totalOrders}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold text-success">
                    {Math.round((vendor.rating / 5) * 100)}%
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-border flex gap-2">
                <button className="flex-1 btn-outline flex items-center justify-center gap-2">
                  <Eye size={16} />
                  <span>View</span>
                </button>
                <button className="flex-1 btn-outline flex items-center justify-center gap-2">
                  <Edit size={16} />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => deleteVendor(vendor.id)}
                  className="btn-outline text-destructive hover:bg-destructive/10 flex items-center justify-center"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredVendors.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No vendors found matching your criteria</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface StatBoxProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

function StatBox({ label, value, icon }: StatBoxProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-2">{label}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Missing imports fix
import { Users, Package } from 'lucide-react';
