import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';
import { of } from 'rxjs';
import { finalize, switchMap, catchError } from 'rxjs/operators';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './Profile.component.html',
  styleUrls: ['./Profile.component.scss']
})
export class ProfileComponent implements OnInit, OnChanges {
  @Output() close = new EventEmitter<void>();
  @Input() initialTab: 'profile' | 'password' = 'profile';

  activeTab: 'profile' | 'password' = 'profile';
  isLoading = false;
  toasts: Toast[] = [];
  private toastIdCounter = 0;

  user: any = {};
  avatarUrl     = '';
  avatarFile: File | null = null;
  avatarPreview = '';
  avatarRemoved = false;

  profileForm = { name: '', email: '', contactNo: '', department: '', organization: '', dateOfBirth: '' };
  passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

  showCurrentPw = false;
  showNewPw     = false;
  showConfirmPw = false;

  constructor(private authService: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.activeTab = this.initialTab;
    this.user = this.authService.getUser() || {};
    this.profileForm = {
      name:         this.user.name         || '',
      email:        this.user.email        || '',
      contactNo:    this.user.contactNo    || '',
      department:   this.user.department   || '',
      organization: this.user.organization || '',
      dateOfBirth:  this.user.dateOfBirth ? this.user.dateOfBirth.split('T')[0] : ''
    };
    this.avatarUrl    = this.user.avatar || this.user.profileImage || '';
    this.avatarRemoved = false;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['initialTab']?.currentValue) {
      this.activeTab = changes['initialTab'].currentValue;
    }
  }

  get isAdmin():   boolean { return this.user?.role === 'Admin'; }
  get isManager(): boolean { return this.user?.role === 'Manager'; }

  getInitials(): string {
    return (this.user.name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getCurrentAvatarSrc(): string {
    if (this.avatarPreview) return this.avatarPreview;
    if (this.avatarUrl) {
      // If it's a server path, prepend API base
      if (this.avatarUrl.startsWith('/uploads')) {
        return `${this.authService.API_URL.replace('/api', '')}${this.avatarUrl}`;
      }
      return this.avatarUrl; // base64 or full URL
    }
    return '';
  }

  showToast(type: 'success' | 'error' | 'info', message: string) {
    const t: Toast = { id: ++this.toastIdCounter, type, message };
    this.toasts.push(t);
    this.cdr.detectChanges();
    setTimeout(() => { this.toasts = this.toasts.filter(x => x.id !== t.id); this.cdr.detectChanges(); }, 4500);
  }

  triggerAvatarUpload() { document.getElementById('avatarInput')?.click(); }

  onAvatarSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { this.showToast('error', 'Please select an image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { this.showToast('error', 'Image must be under 2MB.'); return; }
    this.avatarFile = file;
    const reader = new FileReader();
    reader.onload = (e) => { this.avatarPreview = e.target?.result as string; this.cdr.detectChanges(); };
    reader.readAsDataURL(file);
  }

  removeAvatar() {
    this.avatarFile    = null;
    this.avatarPreview = '';
    this.avatarUrl     = '';
    this.avatarRemoved = true;
  }

  // ── Update Profile ────────────────────────────────────────
  updateProfile() {
    if (!this.profileForm.name?.trim())  { this.showToast('error', 'Name is required.');  return; }
    if (!this.profileForm.email?.trim()) { this.showToast('error', 'Email is required.'); return; }

    const userId = this.user._id || this.user.id;
    if (!userId) { this.showToast('error', 'Session invalid. Please log in again.'); return; }

    this.isLoading = true;

    const updatePayload: Record<string, any> = {
      name:         this.profileForm.name.trim(),
      email:        this.profileForm.email.trim().toLowerCase(),
      contactNo:    this.profileForm.contactNo    || '',
      department:   this.profileForm.department   || '',
      organization: this.profileForm.organization || '',
      dateOfBirth:  this.profileForm.dateOfBirth  || ''
    };

    // Step 1: Persist avatar through the profile JSON update so it works without multipart middleware.
    let avatarStep$ = of(null as any);
    if (this.avatarFile) {
      if (this.avatarPreview) {
        updatePayload['avatar'] = this.avatarPreview;
        updatePayload['profileImage'] = this.avatarPreview;
        updatePayload['photo'] = this.avatarPreview;
      }
    } else if (this.avatarRemoved) {
      avatarStep$ = this.authService.clearProfilePhoto(userId).pipe(catchError(() => of(null)));
    }

    // Step 2: Update profile fields
    avatarStep$.pipe(
      switchMap(() => this.authService.updateProfile(userId, updatePayload)),
      finalize(() => {
        this.isLoading = false;
        // Reload user from storage (it was updated by auth service)
        this.user = this.authService.getUser() || { ...this.user, ...updatePayload };
        this.avatarUrl = this.user.avatar || this.user.profileImage || this.avatarPreview || '';
        this.avatarFile = null;
        this.avatarPreview = '';
        this.avatarRemoved = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next:  (res) => {
        this.showToast('success', res?.message || 'Profile updated successfully!');
      },
      error: (err) => {
        this.showToast('error', err?.message || 'Could not update profile. Changes saved locally.');
        // Update locally so UX isn't broken
        // this.authService.updateLocalUser(updatePayload);
        this.user = this.authService.getUser() || { ...this.user, ...updatePayload };
        this.cdr.detectChanges();
      }
    });
  }

  // ── Reset Password ────────────────────────────────────────
  resetPassword() {
    if (!this.passwordForm.currentPassword)             { this.showToast('error', 'Enter your current password.'); return; }
    if (this.passwordForm.newPassword.length < 6)       { this.showToast('error', 'New password must be at least 6 characters.'); return; }
    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) { this.showToast('error', 'Passwords do not match.'); return; }

    this.isLoading = true;
    const userId = this.user._id || this.user.id;
    if (!userId) {
      this.isLoading = false;
      this.showToast('error', 'Session invalid. Please log in again.');
      return;
    }

    this.authService.updatePassword(userId, this.passwordForm.currentPassword, this.passwordForm.newPassword).subscribe({
      next: (data) => {
        this.isLoading = false;
        if (data?.success !== false) {
          this.showToast('success', 'Password changed successfully!');
          this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
        } else {
          this.showToast('error', data.message || 'Failed to change password.');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast('error', err?.message || 'Failed to change password.');
        this.cdr.detectChanges();
      }
    });
  }

  getPasswordStrength(): { label: string; color: string; pct: number } {
    const p = this.passwordForm.newPassword;
    if (!p) return { label: '', color: '#e2e8f0', pct: 0 };
    let s = 0;
    if (p.length >= 6)           s++;
    if (p.length >= 10)          s++;
    if (/[A-Z]/.test(p))         s++;
    if (/[0-9]/.test(p))         s++;
    if (/[^A-Za-z0-9]/.test(p))  s++;
    if (s <= 1) return { label: 'Weak',   color: '#ef4444', pct: 20 };
    if (s <= 2) return { label: 'Fair',   color: '#f59e0b', pct: 45 };
    if (s <= 3) return { label: 'Good',   color: '#3b82f6', pct: 70 };
    return             { label: 'Strong', color: '#10b981', pct: 100 };
  }

  onClose() { this.close.emit(); }
}
