import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentAdvise } from './payment-advise';

describe('PaymentAdvise', () => {
  let component: PaymentAdvise;
  let fixture: ComponentFixture<PaymentAdvise>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentAdvise],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentAdvise);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
