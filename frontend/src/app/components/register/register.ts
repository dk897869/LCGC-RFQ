import { Component, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
  icon: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrls: ['./register.scss']
})
export class RegisterComponent implements OnDestroy {
  registerMethod: 'email' | 'mobile' = 'email';

  fullName = '';
  dateOfBirth = '';
  password = '';
  confirmPassword = '';
  selectedRole = 'User';
  agreeTerms = false;
  email = '';
  mobileNumber = '';
  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;

  toasts: Toast[] = [];
  private toastIdCounter = 0;

  showOTPModal = false;
  otpCode = '';
  otpMobile = '';
  otpLoading = false;
  otpError = '';
  otpSuccess = '';
  otpTimer = 60;
  otpTimerInterval: any;
  canResendOTP = false;
  currentDate = new Date().toISOString().split('T')[0];
  registrationData: any = null;

  roles = [
    { value: 'Admin',   label: 'Admin',   desc: 'Full system access',          icon: '👑' },
    { value: 'Manager', label: 'Manager', desc: 'Manage approvals & vendors',  icon: '📊' },
    { value: 'User',    label: 'User',    desc: 'Standard access',             icon: '👤' },
    { value: 'Viewer',  label: 'Viewer',  desc: 'Read-only access',            icon: '👁️' }
  ];

  constructor(private authService: AuthService, private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnDestroy() { this.resetOTPTimer(); }

  showToast(type: 'success' | 'error' | 'info', message: string, duration = 4500) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const t: Toast = { id: ++this.toastIdCounter, type, message, icon: icons[type] };
    this.toasts.push(t);
    this.cdr.detectChanges();
    setTimeout(() => { this.toasts = this.toasts.filter(x => x.id !== t.id); this.cdr.detectChanges(); }, duration);
  }

  dismissToast(id: number) { this.toasts = this.toasts.filter(t => t.id !== id); }

  togglePassword()        { this.showPassword = !this.showPassword; }
  toggleConfirmPassword() { this.showConfirmPassword = !this.showConfirmPassword; }
  setRegisterMethod(m: 'email' | 'mobile') { this.registerMethod = m; }

  isFormValid(): boolean {
    const base = this.fullName.trim().length > 2
      && this.dateOfBirth !== ''
      && this.password.length >= 6
      && this.confirmPassword === this.password
      && this.agreeTerms;
    return this.registerMethod === 'email'
      ? base && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)
      : base && /^[0-9]{10}$/.test(this.mobileNumber);
  }

  getPasswordStrength(): { label: string; color: string; pct: number } {
    const p = this.password;
    if (!p) return { label: '', color: '#e2e8f0', pct: 0 };
    let s = 0;
    if (p.length >= 6)            s++;
    if (p.length >= 10)           s++;
    if (/[A-Z]/.test(p))          s++;
    if (/[0-9]/.test(p))          s++;
    if (/[^A-Za-z0-9]/.test(p))   s++;
    if (s <= 1) return { label: 'Weak',   color: '#ef4444', pct: 20 };
    if (s <= 2) return { label: 'Fair',   color: '#f59e0b', pct: 45 };
    if (s <= 3) return { label: 'Good',   color: '#3b82f6', pct: 70 };
    return             { label: 'Strong', color: '#10b981', pct: 100 };
  }

  passwordsMatch(): boolean { return this.confirmPassword === '' || this.password === this.confirmPassword; }

  onEmailRegister() {
    if (!this.isFormValid()) {
      this.showToast('error', 'Please fill all required fields correctly.');
      return;
    }
    this.isLoading = true;
    this.cdr.detectChanges();

    this.authService.sendRegistrationOTP(this.email).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.registrationData = {
          name: this.fullName.trim(),
          email: this.email.trim().toLowerCase(),
          password: this.password,
          role: this.selectedRole,
          mobile: this.mobileNumber,
          dateOfBirth: this.dateOfBirth
        };
        this.otpMobile = this.mobileNumber;
        this.showOTPModal = true;
        this.otpSuccess = res.message || 'OTP sent!';
        this.showToast('info', `OTP sent to ${this.email}`);
        this.startOTPTimer();
        this.cdr.detectChanges();
      },
      error: err => {
        this.isLoading = false;
        this.cdr.detectChanges();
        this.showToast('error', err?.message || 'Failed to send OTP. Please try again.');
      }
    });
  }

  verifyOTPAndRegister() {
    if (!this.otpCode || this.otpCode.length !== 6) {
      this.otpError = 'Please enter a valid 6-digit OTP.';
      return;
    }
    this.otpLoading = true; this.otpError = '';

    this.authService.verifyRegistrationOTP(this.registrationData.email, this.otpCode).subscribe({
      next: () => {
        this.authService.register(
          this.registrationData.name, this.registrationData.email,
          this.registrationData.password, this.registrationData.role,
          this.registrationData.mobile, this.registrationData.dateOfBirth
        ).subscribe({
          next: (res) => {
            this.otpLoading = false;
            this.closeOTPModal();
            this.showToast('success', '🎉 Account created! Please check your email to verify your account.', 6000);
            setTimeout(() => this.router.navigate(['/login']), 3000);
          },
          error: (err) => {
            this.otpLoading = false;
            this.closeOTPModal();
            this.showToast('error', err?.message || 'Registration failed.');
          }
        });
      },
      error: (err) => { 
        this.otpLoading = false; 
        this.otpError = err?.message || 'Invalid OTP.';
        this.cdr.detectChanges();
      }
    });
  }

  resendOTP() {
    if (!this.canResendOTP) return;
    this.otpLoading = true; this.otpError = ''; this.otpSuccess = '';
    this.authService.sendRegistrationOTP(this.registrationData.email).subscribe({
      next: () => { 
        this.otpLoading = false; 
        this.otpSuccess = 'OTP resent!'; 
        this.resetOTPTimer(); 
        this.startOTPTimer(); 
        this.cdr.detectChanges();
      },
      error: (err) => { 
        this.otpLoading = false; 
        this.otpError = err?.message || 'Failed to resend.';
        this.cdr.detectChanges();
      }
    });
  }

  startOTPTimer() {
    this.otpTimer = 60; this.canResendOTP = false;
    if (this.otpTimerInterval) clearInterval(this.otpTimerInterval);
    this.otpTimerInterval = setInterval(() => {
      if (this.otpTimer > 0) { this.otpTimer--; }
      else { this.canResendOTP = true; clearInterval(this.otpTimerInterval); }
      this.cdr.detectChanges();
    }, 1000);
  }

  resetOTPTimer() { if (this.otpTimerInterval) clearInterval(this.otpTimerInterval); }

  closeOTPModal() {
    this.showOTPModal = false; this.otpCode = ''; this.otpError = '';
    this.otpSuccess = ''; this.otpLoading = false; this.resetOTPTimer();
  }

  formatTimer(s: number): string {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  }
}