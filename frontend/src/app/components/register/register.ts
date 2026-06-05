// register.component.ts (COMPLETE - No OTP, Direct Registration)
import { Component, OnDestroy, ChangeDetectorRef, OnInit } from '@angular/core';
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
export class RegisterComponent implements OnInit, OnDestroy {
  // Form fields
  fullName = '';
  email = '';
  password = '';
  confirmPassword = '';
  dateOfBirth = '';
  selectedRole = 'User';
  agreeTerms = false;
  
  // UI states
  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;
  
  // Toast notifications
  toasts: Toast[] = [];
  private toastIdCounter = 0;
  
  // Date validation
  currentDate = new Date().toISOString().split('T')[0];
  
  // Role options
  roles = [
    { value: 'Admin',   label: 'Admin',   desc: 'Full system access',          icon: '👑' },
    { value: 'Manager', label: 'Manager', desc: 'Manage approvals & vendors',  icon: '📊' },
    { value: 'User',    label: 'User',    desc: 'Standard access',             icon: '👤' },
    { value: 'Viewer',  label: 'Viewer',  desc: 'Read-only access',            icon: '👁️' }
  ];

  constructor(
    private authService: AuthService, 
    private router: Router, 
    private cdr: ChangeDetectorRef
  ) {
    console.log('RegisterComponent initialized');
  }

  ngOnInit() {
    // Check if already logged in
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  ngOnDestroy() { }

  // Toast methods
  showToast(type: 'success' | 'error' | 'info', message: string, duration = 4500) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const t: Toast = { id: ++this.toastIdCounter, type, message, icon: icons[type] };
    this.toasts.push(t);
    this.cdr.detectChanges();
    setTimeout(() => { 
      this.toasts = this.toasts.filter(x => x.id !== t.id); 
      this.cdr.detectChanges(); 
    }, duration);
  }

  dismissToast(id: number) { 
    this.toasts = this.toasts.filter(t => t.id !== id); 
  }

  // Password visibility toggles
  togglePassword() { 
    this.showPassword = !this.showPassword; 
  }
  
  toggleConfirmPassword() { 
    this.showConfirmPassword = !this.showConfirmPassword; 
  }

  // Validation methods
  isValidEmail(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
  }

  isValidDateOfBirth(): boolean {
    if (!this.dateOfBirth) return false;
    const birthDate = new Date(this.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18 && age <= 100;
  }

  isFormValid(): boolean {
    return this.fullName.trim().length >= 3
      && this.isValidEmail()
      && this.password.length >= 6
      && this.password === this.confirmPassword
      && this.isValidDateOfBirth()
      && this.agreeTerms;
  }

  // Password strength calculator
  getPasswordStrength(): { label: string; color: string; pct: number } {
    const p = this.password;
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

  passwordsMatch(): boolean { 
    return this.confirmPassword === '' || this.password === this.confirmPassword; 
  }

  // Age validation message
  getAgeError(): string {
    if (!this.dateOfBirth) return '';
    const birthDate = new Date(this.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 18) return 'You must be at least 18 years old';
    if (age > 100) return 'Please enter a valid date of birth';
    return '';
  }

  // MAIN REGISTRATION METHOD - Direct registration without OTP
  onRegister() {
    console.log('onRegister called');
    
    // Validate form
    if (!this.isFormValid()) {
      if (!this.fullName.trim() || this.fullName.trim().length < 3) {
        this.showToast('error', 'Please enter your full name (minimum 3 characters)');
      } else if (!this.isValidEmail()) {
        this.showToast('error', 'Please enter a valid email address');
      } else if (this.password.length < 6) {
        this.showToast('error', 'Password must be at least 6 characters');
      } else if (this.password !== this.confirmPassword) {
        this.showToast('error', 'Passwords do not match');
      } else if (!this.isValidDateOfBirth()) {
        this.showToast('error', this.getAgeError() || 'Please enter a valid date of birth');
      } else if (!this.agreeTerms) {
        this.showToast('error', 'Please agree to the Terms of Service');
      } else {
        this.showToast('error', 'Please fill all required fields correctly');
      }
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    // Prepare registration data
    const registrationData = {
      name: this.fullName.trim(),
      email: this.email.trim().toLowerCase(),
      password: this.password,
      role: this.selectedRole,
      dateOfBirth: this.dateOfBirth,
      mobile: '' // Optional - can be added later in profile
    };

    console.log('Sending registration request:', { ...registrationData, password: '***' });

    // Call registration API
    this.authService.register(
      registrationData.name,
      registrationData.email,
      registrationData.password,
      registrationData.role,
      registrationData.mobile,
      registrationData.dateOfBirth,
      false // mobileVerified
    ).subscribe({
      next: (response) => {
        console.log('Registration successful:', response);
        this.isLoading = false;
        this.cdr.detectChanges();
        
        this.showToast('success', '✅ Account created successfully! Please check your email for verification link.', 6000);
        
        // Reset form
        this.fullName = '';
        this.email = '';
        this.password = '';
        this.confirmPassword = '';
        this.dateOfBirth = '';
        this.agreeTerms = false;
        
        // Navigate to login after 3 seconds
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (error) => {
        console.error('Registration error:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
        
        const errorMessage = error?.error?.message || error?.message || 'Registration failed. Please try again.';
        this.showToast('error', errorMessage);
      }
    });
  }
}