import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-payment-advise',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-advise.html',
  styleUrls: ['./payment-advise.scss']
})
export class PaymentAdviseComponent implements OnInit {
  @Output() onSubmit = new EventEmitter<any>();

  form: any = {
    employeeName: '',
    designation: 'Dept. Manager',
    department: 'SCM-FG',
    purpose: 'For semi-automatic machine part replacement and service charges',
    expenseAmount: 3539,
    invoiceNo: '',
    invoiceDate: '',
    remarks: '100% Payment Against Invoice'
  };

  isSubmitting = false;

  constructor(private authService: AuthService) {}

  ngOnInit() {
    const user = this.authService.getUser();
    if (user) this.form.employeeName = user.name || 'Chandra Shekhar';
  }

  submitForm() {
    this.isSubmitting = true;
    const serialNo = `PAY-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2,'0')}${new Date().getDate().toString().padStart(2,'0')}-${Math.floor(Math.random()*10000)}`;

    setTimeout(() => {
      this.isSubmitting = false;
      this.onSubmit.emit({
        success: true,
        serialNo,
        type: 'payment-advise',
        data: this.form
      });
    }, 1000);
  }
}