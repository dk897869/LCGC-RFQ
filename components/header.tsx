'use client';

import { Bell, Search, ChevronDown } from 'lucide-react';
import { useStore } from '@/lib/store';

export function Header() {
  const user = useStore((state) => state.user);

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-card border-b border-border z-20">
      <div className="h-full px-4 lg:px-8 flex items-center justify-between">
        {/* Search */}
        <div className="hidden md:flex flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              type="text"
              placeholder="Search RFQs, POs, vendors..."
              className="input-field pl-10"
            />
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-4 ml-auto">
          {/* Notifications */}
          <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
            <Bell size={20} className="text-muted-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-warning rounded-full" />
          </button>

          {/* User menu */}
          <div className="flex items-center gap-3 pl-4 border-l border-border">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-foreground">{user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role || 'User'}</p>
            </div>
            <button className="w-10 h-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center font-bold hover:opacity-90 transition-opacity">
              {user?.name.charAt(0) || 'U'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
