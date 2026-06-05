import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CashPurchase } from './cash-purchase';

describe('CashPurchase', () => {
  let component: CashPurchase;
  let fixture: ComponentFixture<CashPurchase>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CashPurchase],
    }).compileComponents();

    fixture = TestBed.createComponent(CashPurchase);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
