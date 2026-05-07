import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentRequest } from './payment-request';

describe('PaymentRequest', () => {
  let component: PaymentRequest;
  let fixture: ComponentFixture<PaymentRequest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentRequest],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentRequest);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
