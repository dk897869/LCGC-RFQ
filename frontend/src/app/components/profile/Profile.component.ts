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
  isUploading = false; // Added missing property
  toasts: Toast[] = [];
  private toastIdCounter = 0;

  user: any = {};
  avatarUrl = '';
  avatarFile: File | null = null;
  avatarPreview = '';
  avatarRemoved = false;

  profileForm = { name: '', email: '', contactNo: '', department: '', organization: '', dateOfBirth: '' };
  passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

  showCurrentPw = false;
  showNewPw = false;
  showConfirmPw = false;

  constructor(private authService: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadUserData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['initialTab']?.currentValue) {
      this.activeTab = changes['initialTab'].currentValue;
    }
    if (changes['initialTab']?.firstChange === false) {
      this.loadUserData();
    }
  }

  loadUserData() {
    // First get from local storage
    this.user = this.authService.getUser() || {};
    
    // Then fetch fresh data from server
    this.authService.getProfile().subscribe({
      next: (res) => {
        if (res?.success && res.user) {
          this.user = res.user;
          this.updateFormFromUser();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load profile:', err);
        this.updateFormFromUser();
        this.cdr.detectChanges();
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        this.showToast('error', 'Please select an image file.');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        this.showToast('error', 'Image must be under 2MB.');
        return;
      }
      
      this.isUploading = true;
      this.authService.uploadProfilePhoto(this.user.id, file).subscribe({
        next: (res) => {
          this.user.profileImage = res.profileImage;
          this.avatarUrl = res.profileImage;
          this.avatarPreview = '';
          this.avatarFile = null;
          this.isUploading = false;
          this.showToast('success', 'Photo uploaded successfully');
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isUploading = false;
          this.showToast('error', err.message || 'Upload failed');
          this.cdr.detectChanges();
        }
      });
    }
  }

  updateFormFromUser() {
    this.profileForm = {
      name: this.user.name || '',
      email: this.user.email || '',
      contactNo: this.user.contactNo || '',
      department: this.user.department || '',
      organization: this.user.organization || '',
      dateOfBirth: this.user.dateOfBirth ? this.user.dateOfBirth.split('T')[0] : ''
    };
    this.avatarUrl = this.user.avatar || this.user.profileImage || '';
    this.avatarRemoved = false;
    this.avatarFile = null;
    this.avatarPreview = '';
  }

  get isAdmin(): boolean { 
    return this.user?.role === 'Admin'; 
  }
  
  get isManager(): boolean { 
    return this.user?.role === 'Manager'; 
  }

  getInitials(): string {
    return (this.user.name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getCurrentAvatarSrc(): string {
    if (this.avatarPreview) return this.avatarPreview;
    if (this.avatarUrl) {
      if (this.avatarUrl.startsWith('/uploads')) {
        const baseUrl = this.authService.API_URL.replace('/api', '');
        return `${baseUrl}${this.avatarUrl}`;
      }
      if (this.avatarUrl.startsWith('http')) {
        return this.avatarUrl;
      }
      if (this.avatarUrl.startsWith('data:')) {
        return this.avatarUrl;
      }
      return this.avatarUrl;
    }
    return '';
  }

  showToast(type: 'success' | 'error' | 'info', message: string) {
    const t: Toast = { id: ++this.toastIdCounter, type, message };
    this.toasts.push(t);
    this.cdr.detectChanges();
    setTimeout(() => { 
      this.toasts = this.toasts.filter(x => x.id !== t.id); 
      this.cdr.detectChanges(); 
    }, 4500);
  }

  triggerAvatarUpload() { 
    document.getElementById('avatarInput')?.click(); 
  }

  onAvatarSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { 
      this.showToast('error', 'Please select an image file.'); 
      return; 
    }
    if (file.size > 2 * 1024 * 1024) { 
      this.showToast('error', 'Image must be under 2MB.'); 
      return; 
    }
    this.avatarFile = file;
    const reader = new FileReader();
    reader.onload = (e) => { 
      this.avatarPreview = e.target?.result as string; 
      this.cdr.detectChanges(); 
    };
    reader.readAsDataURL(file);
  }

  removeAvatar() {
    this.avatarFile = null;
    this.avatarPreview = '';
    this.avatarUrl = '';
    this.avatarRemoved = true;
  }

  // ✅ FIXED: Update Profile using PATCH /api/auth/profile
  updateProfile() {
    if (!this.profileForm.name?.trim()) { 
      this.showToast('error', 'Name is required.');  
      return; 
    }
    if (!this.profileForm.email?.trim()) { 
      this.showToast('error', 'Email is required.'); 
      return; 
    }

    this.isLoading = true;

    const updatePayload: Record<string, any> = {
      name: this.profileForm.name.trim(),
      email: this.profileForm.email.trim().toLowerCase(),
      contactNo: this.profileForm.contactNo || '',
      department: this.profileForm.department || '',
      organization: this.profileForm.organization || '',
      dateOfBirth: this.profileForm.dateOfBirth || ''
    };

    // Handle avatar upload/removal first
    let avatarStep$ = of(null as any);
    
    if (this.avatarFile) {
      // Upload new avatar
      avatarStep$ = this.authService.uploadProfilePhoto(this.user._id || this.user.id, this.avatarFile).pipe(
        catchError((err) => {
          console.error('Avatar upload failed:', err);
          this.showToast('error', 'Failed to upload photo. Please try again.');
          return of(null);
        })
      );
    } else if (this.avatarRemoved) {
      // Remove avatar
      avatarStep$ = this.authService.clearProfilePhoto(this.user._id || this.user.id).pipe(
        catchError((err) => {
          console.error('Avatar removal failed:', err);
          return of(null);
        })
      );
    }

    // Then update profile
    avatarStep$.pipe(
      switchMap(() => this.authService.updateProfile(this.user._id || this.user.id, updatePayload)),
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (res) => {
        if (res?.success !== false) {
          this.showToast('success', res?.message || 'Profile updated successfully!');
          // Reload user data
          this.authService.getProfile().subscribe({
            next: (profileRes) => {
              if (profileRes?.success && profileRes.user) {
                this.user = profileRes.user;
                this.updateFormFromUser();
              }
              this.cdr.detectChanges();
            }
          });
        } else {
          this.showToast('error', res?.message || 'Could not update profile.');
        }
      },
      error: (err) => {
        console.error('Update profile error:', err);
        this.showToast('error', err?.message || 'Could not update profile. Please try again.');
        // Update local data as fallback
        this.authService.updateLocalUser(updatePayload);
        this.user = this.authService.getUser() || { ...this.user, ...updatePayload };
        this.cdr.detectChanges();
      }
    });
  }

  // ✅ FIXED: Reset Password using POST /api/auth/change-password
  resetPassword() {
    if (!this.passwordForm.currentPassword) { 
      this.showToast('error', 'Enter your current password.'); 
      return; 
    }
    if (this.passwordForm.newPassword.length < 6) { 
      this.showToast('error', 'New password must be at least 6 characters.'); 
      return; 
    }
    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) { 
      this.showToast('error', 'Passwords do not match.'); 
      return; 
    }

    this.isLoading = true;

    this.authService.updatePassword(
      this.user._id || this.user.id, 
      this.passwordForm.currentPassword, 
      this.passwordForm.newPassword
    ).subscribe({
      next: (data) => {
        this.isLoading = false;
        if (data?.success !== false) {
          this.showToast('success', 'Password changed successfully!');
          this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
        } else {
          this.showToast('error', data?.message || 'Failed to change password.');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Password change error:', err);
        this.showToast('error', err?.message || 'Failed to change password. Please verify your current password.');
        this.cdr.detectChanges();
      }
    });
  }

  getPasswordStrength(): { label: string; color: string; pct: number } {
    const p = this.passwordForm.newPassword;
    if (!p) return { label: '', color: '#e2e8f0', pct: 0 };
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    if (s <= 1) return { label: 'Weak', color: '#ef4444', pct: 20 };
    if (s <= 2) return { label: 'Fair', color: '#f59e0b', pct: 45 };
    if (s <= 3) return { label: 'Good', color: '#3b82f6', pct: 70 };
    return { label: 'Strong', color: '#10b981', pct: 100 };
  }

  onClose() { 
    this.close.emit(); 
  }
}