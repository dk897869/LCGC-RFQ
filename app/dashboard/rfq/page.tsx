'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { Plus, Search, Filter, Eye, Edit, Trash2, Download } from 'lucide-react';
import { useState } from 'react';

export default function RFQPage() {
  const { rfqs, deleteRFQ } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredRFQs = rfqs.filter((rfq) => {
    const matchesSearch =
      rfq.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rfq.number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || rfq.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 fade-in-up">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">RFQ Management</h1>
          <p className="text-muted-foreground mt-1">Manage requests for quotation</p>
        </div>
        <button className="btn-primary flex items-center justify-center gap-2 w-full md:w-auto">
          <Plus size={20} />
          Create RFQ
        </button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                type="text"
                placeholder="Search by title or RFQ number..."
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
                <option value="published">Published</option>
                <option value="closed">Closed</option>
                <option value="awarded">Awarded</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RFQ Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active RFQs</CardTitle>
              <CardDescription>{filteredRFQs.length} RFQ(s) found</CardDescription>
            </div>
            <Download size={20} className="text-muted-foreground cursor-pointer hover:text-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-semibold text-foreground">RFQ Number</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Title</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Budget</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Due Date</th>
                  <th className="px-4 py-3 text-right font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRFQs.map((rfq) => (
                  <tr key={rfq.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-primary">{rfq.number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-foreground truncate">{rfq.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{formatCurrency(rfq.budget)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge badge-${getStatusColor(rfq.status)}`}>
                        {rfq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-muted-foreground">{formatDate(rfq.dueDate)}</span>
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
                          onClick={() => deleteRFQ(rfq.id)}
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
            {filteredRFQs.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No RFQs found matching your criteria</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* RFQ Items Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredRFQs.slice(0, 3).map((rfq) => (
          <Card key={rfq.id}>
            <CardHeader>
              <CardTitle className="text-lg flex items-start justify-between">
                <span className="truncate">{rfq.title}</span>
                <span className={`badge badge-${getStatusColor(rfq.status)} text-xs ml-2`}>
                  {rfq.status}
                </span>
              </CardTitle>
              <CardDescription>{rfq.number}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Budget</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(rfq.budget)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Items</p>
                  <p className="text-lg font-semibold text-foreground">{rfq.items.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="text-lg font-semibold text-foreground">{formatDate(rfq.dueDate)}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Line Items:</p>
                <ul className="space-y-1">
                  {rfq.items.slice(0, 2).map((item) => (
                    <li key={item.id} className="text-sm text-foreground flex justify-between">
                      <span>{item.description}</span>
                      <span className="text-muted-foreground">x{item.quantity}</span>
                    </li>
                  ))}
                  {rfq.items.length > 2 && (
                    <li className="text-sm text-accent font-semibold">+{rfq.items.length - 2} more</li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
