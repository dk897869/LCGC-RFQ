import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-payment-request',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-request.html',
  styleUrl: './payment-request.scss',
})
export class PaymentRequest {
  activePaymentMenu = 'payment-advice';

  paymentMenus = [
    { id: 'payment-advice', label: 'Payment Advice (4)' },
    { id: 'wcc', label: 'WCC-NPP' },
    { id: 'payment-approval', label: 'Payment Approval' },
    { id: 'payment-status', label: 'Payment Status' },
    { id: 'payment-drafts', label: 'Save & Draft' }
  ];

  setPaymentMenu(id: string) {
    this.activePaymentMenu = id;
  }

  get activePaymentLabel(): string {
    return this.paymentMenus.find(menu => menu.id === this.activePaymentMenu)?.label || 'Payment';
  }
}
