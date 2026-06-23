'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { Save, Lock, Bell, Shield, LogOut } from 'lucide-react';
import { useState } from 'react';

export default function SettingsPage() {
  const user = useStore((state) => state.user);
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="space-y-6 fade-in-up">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border overflow-x-auto">
        {(['profile', 'security', 'notifications', 'preferences'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Profile Settings */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Full Name</label>
                <input
                  type="text"
                  defaultValue={user?.name || ''}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Email</label>
                <input
                  type="email"
                  defaultValue={user?.email || ''}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Department</label>
                <input
                  type="text"
                  defaultValue={user?.department || ''}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Role</label>
                <input
                  type="text"
                  defaultValue={user?.role || ''}
                  disabled
                  className="input-field opacity-50 cursor-not-allowed"
                />
              </div>
              <div className="pt-4 border-t border-border flex justify-end">
                <button className="btn-primary flex items-center gap-2">
                  <Save size={18} />
                  Save Changes
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Security Settings */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock size={20} />
                Password & Security
              </CardTitle>
              <CardDescription>Manage your password and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Current Password</label>
                <input
                  type="password"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">New Password</label>
                <input
                  type="password"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Confirm Password</label>
                <input
                  type="password"
                  className="input-field"
                />
              </div>
              <div className="pt-4 border-t border-border flex justify-end">
                <button className="btn-primary flex items-center gap-2">
                  <Save size={18} />
                  Update Password
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <Shield size={20} />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground mb-4">Sign out from all devices and sessions</p>
              <button className="btn-outline text-destructive hover:bg-destructive/10 flex items-center gap-2 w-full">
                <LogOut size={18} />
                Sign Out All Sessions
              </button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Notification Settings */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell size={20} />
                Notification Preferences
              </CardTitle>
              <CardDescription>Choose how you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'RFQ Updates', desc: 'Receive notifications about RFQ status changes' },
                { label: 'PO Approvals', desc: 'Get alerts when POs need your approval' },
                { label: 'Vendor Updates', desc: 'Notifications about vendor activities' },
                { label: 'System Alerts', desc: 'Important system and security notifications' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                  <div>
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-5 h-5 cursor-pointer" />
                </div>
              ))}
              <div className="pt-4 border-t border-border flex justify-end">
                <button className="btn-primary flex items-center gap-2">
                  <Save size={18} />
                  Save Preferences
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preferences */}
      {activeTab === 'preferences' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Preferences</CardTitle>
              <CardDescription>Customize your experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Theme</label>
                <select className="input-field">
                  <option>Light</option>
                  <option>Dark</option>
                  <option>Auto</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Language</label>
                <select className="input-field">
                  <option>English</option>
                  <option>Spanish</option>
                  <option>French</option>
                  <option>German</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Items Per Page</label>
                <select className="input-field">
                  <option>10</option>
                  <option>25</option>
                  <option>50</option>
                  <option>100</option>
                </select>
              </div>
              <div className="pt-4 border-t border-border flex justify-end">
                <button className="btn-primary flex items-center gap-2">
                  <Save size={18} />
                  Save Preferences
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
