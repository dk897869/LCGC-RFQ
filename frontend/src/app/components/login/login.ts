import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';

declare const google: any;
declare const FB: any;

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
  icon: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent implements OnInit, OnDestroy, AfterViewInit {
  loginMethod: 'email' | 'mobile' = 'email';
  emailLoginMode: 'password' | 'otp' = 'password';

  email = '';
  password = '';
  mobileNumber = '';
  rememberMe = false;
  isLoading = false;
  showPassword = false;

  showOTPModal = false;
  otpCode = '';
  otpMobile = '';
  otpChannel: 'mobile' | 'email' = 'mobile';
  otpEmail = '';
  otpLoading = false;
  otpError = '';
  otpSuccess = '';
  otpTimer = 60;
  otpTimerInterval: any = null;
  canResendOTP = false;

  toasts: Toast[] = [];
  private toastIdCounter = 0;

  serverReady = false;
  serverWarmupMessage = '';

  // Google Client ID - Your actual credentials
  private readonly GOOGLE_CLIENT_ID = '965877400039-isl9dli56jh3qqqeqt9of8gccneahs5o.apps.googleusercontent.com';

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    const remembered = this.authService.getRememberedEmail();
    if (remembered) { this.email = remembered; this.rememberMe = true; }

    this.serverWarmupMessage = 'Connecting to server...';
    setTimeout(() => { this.serverWarmupMessage = ''; this.serverReady = true; }, 8000);

    // Load Google Sign-In script
    this.loadGoogleScript();
    
    // Load Facebook SDK
    this.loadFacebookSDK();
  }

  ngAfterViewInit() {
    // Initialize Google button after view is ready
    setTimeout(() => {
      this.initGoogleButton();
    }, 500);
  }

  ngOnDestroy() {
    this.resetOTPTimer();
  }

  loadGoogleScript() {
    // Check if script already exists
    if (document.querySelector('#google-js')) return;
    
    const script = document.createElement('script');
    script.id = 'google-js';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('Google script loaded');
      this.initGoogleButton();
    };
    document.head.appendChild(script);
  }

  initGoogleButton() {
    if (typeof google !== 'undefined' && google.accounts) {
      console.log('Initializing Google button...');
      google.accounts.id.initialize({
        client_id: this.GOOGLE_CLIENT_ID,
        callback: this.handleGoogleCredentialResponse.bind(this),
        auto_select: false,
        cancel_on_tap_outside: true,
        // Important: Add these for local development
        context: 'signin',
        ux_mode: 'popup',
        itp_support: true
      });
      
      const buttonElement = document.getElementById('google-signin-btn');
      if (buttonElement) {
        google.accounts.id.renderButton(
          buttonElement,
          { 
            theme: 'outline', 
            size: 'large', 
            width: '100%',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'center',
            type: 'standard'
          }
        );
        console.log('Google button rendered');
      }
      
      // Optional: Also prompt one-tap login
      google.accounts.id.prompt();
    } else {
      console.log('Google accounts not available yet, retrying...');
      setTimeout(() => this.initGoogleButton(), 500);
    }
  }

  handleGoogleCredentialResponse(response: any) {
    console.log('Google response received:', response);
    this.isLoading = true;
    this.showToast('info', 'Logging in with Google...', 2000);
    
    this.authService.googleLogin(response.credential).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res?.success) {
          this.showToast('success', `Welcome ${res.user?.name || 'User'}! 🎉`);
          setTimeout(() => this.router.navigate(['/dashboard']), 1200);
        } else {
          this.showToast('error', res?.message || 'Google login failed');
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Google login error:', err);
        this.showToast('error', err?.message || 'Google login failed. Please try again.');
      }
    });
  }

  loadFacebookSDK() {
    if (document.querySelector('#facebook-js')) return;
    
    (window as any).fbAsyncInit = () => {
      FB.init({
        appId: 'YOUR_FACEBOOK_APP_ID',
        cookie: true,
        xfbml: true,
        version: 'v18.0'
      });
      console.log('Facebook SDK initialized');
    };
    
    const script = document.createElement('script');
    script.id = 'facebook-js';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  }

  facebookLogin() {
    if (typeof FB === 'undefined') {
      this.showToast('error', 'Facebook SDK not loaded. Please refresh the page.');
      return;
    }
    
    this.isLoading = true;
    this.showToast('info', 'Logging in with Facebook...', 2000);
    
    FB.login((response: any) => {
      if (response.authResponse) {
        const accessToken = response.authResponse.accessToken;
        const userID = response.authResponse.userID;
        
        FB.api('/me', { fields: 'id,name,email,picture' }, (userInfo: any) => {
          this.authService.facebookLogin(accessToken, userID).subscribe({
            next: (res) => {
              this.isLoading = false;
              if (res?.success) {
                this.showToast('success', `Welcome ${res.user?.name || userInfo.name || 'User'}! 🎉`);
                setTimeout(() => this.router.navigate(['/dashboard']), 1200);
              } else {
                this.showToast('error', res?.message || 'Facebook login failed');
              }
            },
            error: (err) => {
              this.isLoading = false;
              console.error('Facebook login error:', err);
              this.showToast('error', err?.message || 'Facebook login failed. Please try again.');
            }
          });
        });
      } else {
        this.isLoading = false;
        this.showToast('error', 'Facebook login cancelled or failed');
      }
    }, { scope: 'email,public_profile' });
  }

  twitterLogin() {
    this.isLoading = true;
    this.showToast('info', 'Redirecting to Twitter...', 2000);
    
    this.authService.getTwitterRequestToken().subscribe({
      next: (res) => {
        if (res?.success && res.authUrl) {
          sessionStorage.setItem('twitter_oauth_token', res.oauthToken);
          sessionStorage.setItem('twitter_oauth_token_secret', res.oauthTokenSecret);
          window.location.href = res.authUrl;
        } else {
          this.isLoading = false;
          this.showToast('error', 'Failed to initiate Twitter login');
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Twitter login error:', err);
        this.showToast('error', 'Twitter login failed. Please try again.');
      }
    });
  }

  showToast(type: 'success' | 'error' | 'info', message: string, duration = 4000) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const t: Toast = { id: ++this.toastIdCounter, type, message, icon: icons[type] };
    this.toasts.push(t);
    this.cdr.detectChanges();
    setTimeout(() => { this.toasts = this.toasts.filter(x => x.id !== t.id); this.cdr.detectChanges(); }, duration);
  }

  dismissToast(id: number) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  togglePassword() { this.showPassword = !this.showPassword; }
  
  setLoginMethod(method: 'email' | 'mobile') {
    this.loginMethod = method;
    if (method === 'email') this.emailLoginMode = 'password';
  }

  setEmailLoginMode(mode: 'password' | 'otp') {
    this.emailLoginMode = mode;
  }

  onEmailLogin() {
    if (this.emailLoginMode === 'otp') {
      this.sendEmailOTP();
      return;
    }
    if (!this.email || !this.password) {
      this.showToast('error', 'Please enter your email and password.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      this.showToast('error', 'Please enter a valid email address.');
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    this.authService.login(this.email, this.password, this.rememberMe).subscribe({
      next: res => {
        this.isLoading = false;
        this.cdr.detectChanges();
        if (res?.success) {
          this.showToast('success', `Welcome back, ${res.user?.name?.split(' ')[0] || 'User'}! 🎉`);
          setTimeout(() => this.router.navigate(['/dashboard']), 1200);
        } else {
          if (res?.needsVerification) {
            this.showToast('info', 'Please verify your email first. Check your inbox.');
          } else {
            this.showToast('error', res?.message || 'Login failed. Please check your credentials.');
          }
        }
      },
      error: err => {
        this.isLoading = false;
        this.cdr.detectChanges();
        this.showToast('error', err?.message || 'Login failed.');
      }
    });
  }

  sendMobileOTP() {
    if (!this.mobileNumber || !/^[0-9]{10}$/.test(this.mobileNumber)) {
      this.showToast('error', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    this.isLoading = true;
    this.cdr.detectChanges();

    this.authService.sendSMSOTP(this.mobileNumber, 'login').subscribe({
      next: () => {
        this.isLoading = false;
        this.otpChannel = 'mobile';
        this.otpMobile = this.mobileNumber;
        this.otpCode = ''; this.otpError = ''; this.otpSuccess = '';
        this.showOTPModal = true;
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

  sendEmailOTP() {
    if (!this.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      this.showToast('error', 'Please enter a valid email address.');
      return;
    }
    this.isLoading = true;
    this.cdr.detectChanges();
    this.authService.sendOTP(this.email).subscribe({
      next: () => {
        this.isLoading = false;
        this.otpChannel = 'email';
        this.otpEmail = this.email.trim().toLowerCase();
        this.otpCode = '';
        this.otpError = '';
        this.otpSuccess = '';
        this.showOTPModal = true;
        this.startOTPTimer();
        this.cdr.detectChanges();
        this.showToast('success', 'Check your inbox for the login code.');
      },
      error: err => {
        this.isLoading = false;
        this.cdr.detectChanges();
        this.showToast('error', err?.message || 'Failed to send email OTP.');
      }
    });
  }

  verifyOTP() {
    if (!this.otpCode || this.otpCode.length !== 6) {
      this.otpError = 'Please enter a valid 6-digit OTP.';
      this.cdr.detectChanges();
      return;
    }
    this.otpLoading = true; this.otpError = '';
    this.cdr.detectChanges();

    const identifier = this.otpChannel === 'email' ? this.otpEmail : this.otpMobile;
    const method = this.otpChannel === 'email' ? 'email' : 'mobile';

    this.authService.verifyOTP(identifier, this.otpCode, method, 'login').subscribe({
      next: res => {
        this.otpLoading = false;
        this.cdr.detectChanges();
        if (res?.success && res.token) {
          this.closeOTPModal();
          this.showToast('success', `Welcome back! 🎉`);
          setTimeout(() => this.router.navigate(['/dashboard']), 1200);
        } else {
          this.otpError = 'OTP verification failed. Please try again.';
          this.cdr.detectChanges();
        }
      },
      error: err => {
        this.otpLoading = false;
        this.otpError = err?.message || 'Invalid OTP. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  resendOTP() {
    if (!this.canResendOTP) return;
    this.otpLoading = true; this.otpError = ''; this.otpSuccess = '';
    const req$ =
      this.otpChannel === 'email'
        ? this.authService.sendOTP(this.otpEmail)
        : this.authService.sendSMSOTP(this.otpMobile, 'login');
    req$.subscribe({
      next: () => { this.otpLoading = false; this.otpSuccess = 'OTP resent!'; this.resetOTPTimer(); this.startOTPTimer(); this.cdr.detectChanges(); },
      error: err => { this.otpLoading = false; this.otpError = err?.message || 'Failed to resend.'; this.cdr.detectChanges(); }
    });
  }

  startOTPTimer() {
    this.otpTimer = 60; this.canResendOTP = false;
    if (this.otpTimerInterval) clearInterval(this.otpTimerInterval);
    this.otpTimerInterval = setInterval(() => {
      this.otpTimer--;
      if (this.otpTimer <= 0) { this.canResendOTP = true; clearInterval(this.otpTimerInterval); this.otpTimerInterval = null; }
      this.cdr.detectChanges();
    }, 1000);
  }

  resetOTPTimer() { if (this.otpTimerInterval) { clearInterval(this.otpTimerInterval); this.otpTimerInterval = null; } }

  closeOTPModal() {
    this.showOTPModal = false; this.otpCode = ''; this.otpError = '';
    this.otpSuccess = ''; this.otpLoading = false; this.resetOTPTimer();
    this.cdr.detectChanges();
  }

  onOTPInput(e: any) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    this.otpCode = val; e.target.value = val;
  }

  formatTimer(s: number): string {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  }
}