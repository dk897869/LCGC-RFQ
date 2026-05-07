import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss']
})
export class ForgotPasswordComponent {
  email = '';
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  constructor(private authService: AuthService) {}

  submit(): void {
    if (!this.email.trim()) {
      this.errorMessage = 'Please enter your email address.';
      this.successMessage = '';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.forgotPassword(this.email).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.success === false) {
          this.errorMessage = res.message || 'Could not send reset email.';
          return;
        }
        this.successMessage = res?.message || 'Reset instructions have been sent to your email.';
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.message || 'Failed to send reset instructions.';
      }
    });
  }
}
