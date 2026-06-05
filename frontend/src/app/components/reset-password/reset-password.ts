import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.scss']
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  password = '';
  confirmPassword = '';
  isLoading = false;
  isValidatingToken = true;
  isTokenValid = false;
  successMessage = '';
  errorMessage = '';
  email = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (this.token) {
      this.validateToken();
    } else {
      this.isValidatingToken = false;
      this.errorMessage = 'Invalid or missing reset token. Please request a new password reset link.';
    }
  }

  validateToken(): void {
    this.authService.checkResetToken(this.token).subscribe({
      next: (res) => {
        this.isValidatingToken = false;
        if (res && res.success) {
          this.isTokenValid = true;
          this.email = res.email || '';
        } else {
          this.isTokenValid = false;
          this.errorMessage = res?.message || 'Invalid or expired reset token. Please request a new password reset link.';
        }
      },
      error: (err) => {
        this.isValidatingToken = false;
        this.isTokenValid = false;
        this.errorMessage = err?.message || 'Invalid or expired reset token. Please request a new password reset link.';
      }
    });
  }

  submit(): void {
    if (!this.token) {
      this.errorMessage = 'Reset token is missing.';
      return;
    }
    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters.';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Use the correct API endpoint
    this.authService.resetPasswordWithToken(this.token, this.password, this.confirmPassword).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.success === false) {
          this.errorMessage = res.message || 'Failed to reset password.';
          return;
        }
        this.successMessage = res?.message || 'Password reset successfully. Redirecting to login...';
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.message || 'Failed to reset password. Please try again.';
      }
    });
  }
getPasswordStrength(): { label: string; color: string; width: number } {
  const p = this.password;
  if (!p) return { label: '', color: '#e2e8f0', width: 0 };
  
  let score = 0;
  if (p.length >= 6) score++;
  if (p.length >= 10) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  
  if (score <= 1) return { label: 'Weak', color: '#ef4444', width: 20 };
  if (score <= 2) return { label: 'Fair', color: '#f59e0b', width: 45 };
  if (score <= 3) return { label: 'Good', color: '#3b82f6', width: 70 };
  return { label: 'Strong', color: '#10b981', width: 100 };
}
  resendResetLink(): void {
    if (!this.email) {
      // If email not available from token validation, ask user to enter email
      const userEmail = prompt('Please enter your email address to receive a new reset link:');
      if (!userEmail) return;
      this.authService.forgotPasswordLink(userEmail).subscribe({
        next: (res) => {
          if (res && res.success) {
            this.errorMessage = '';
            this.successMessage = 'A new password reset link has been sent to your email.';
            setTimeout(() => this.router.navigate(['/login']), 3000);
          } else {
            this.errorMessage = res?.message || 'Failed to send reset link. Please try again.';
          }
        },
        error: (err) => {
          this.errorMessage = err?.message || 'Failed to send reset link. Please try again.';
        }
      });
    } else {
      this.authService.forgotPasswordLink(this.email).subscribe({
        next: (res) => {
          if (res && res.success) {
            this.errorMessage = '';
            this.successMessage = 'A new password reset link has been sent to your email.';
            setTimeout(() => this.router.navigate(['/login']), 3000);
          } else {
            this.errorMessage = res?.message || 'Failed to send reset link. Please try again.';
          }
        },
        error: (err) => {
          this.errorMessage = err?.message || 'Failed to send reset link. Please try again.';
        }
      });
    }
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}