'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  FileText,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Package,
  ClipboardList,
} from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'RFQ Management', href: '/dashboard/rfq', icon: FileText, badge: 2 },
  { name: 'Purchase Orders', href: '/dashboard/po', icon: Package, badge: 1 },
  { name: 'Approvals', href: '/dashboard/approvals', icon: ClipboardList },
  { name: 'Vendors', href: '/dashboard/vendors', icon: Users },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const user = useStore((state) => state.user);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-40 lg:hidden p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 bg-card border-r border-border transition-transform duration-300 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full pt-20 lg:pt-0">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Package className="text-primary-foreground" size={24} />
              </div>
              <div>
                <h2 className="font-bold text-foreground">LCGC ERP</h2>
                <p className="text-xs text-muted-foreground">Procurement System</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-2 overflow-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-foreground hover:bg-muted'
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} />
                    <span className="font-medium">{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-warning text-warning-foreground">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-3 py-4 border-t border-border space-y-2">
            <Link
              href="/settings"
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-foreground hover:bg-muted transition-all duration-200"
              onClick={() => setIsOpen(false)}
            >
              <Settings size={20} />
              <span className="font-medium">Settings</span>
            </Link>
            <button className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-destructive hover:bg-destructive/10 transition-all duration-200">
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>
          </div>

          {/* User Info */}
          <div className="px-4 py-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold">
                {user?.name.charAt(0) || 'U'}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-foreground truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email || 'user@lcgc.com'}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
