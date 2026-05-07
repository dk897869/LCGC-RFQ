import { Component } from '@angular/core';
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
export class ResetPasswordComponent {
  token = '';
  password = '';
  confirmPassword = '';
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
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

    this.authService.resetPasswordWithToken(this.token, this.password).subscribe({
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
        this.errorMessage = err?.message || 'Failed to reset password.';
      }
    });
  }
}
