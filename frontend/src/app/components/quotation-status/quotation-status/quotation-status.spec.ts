import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuotationStatus } from './quotation-status';

describe('QuotationStatus', () => {
  let component: QuotationStatus;
  let fixture: ComponentFixture<QuotationStatus>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuotationStatus],
    }).compileComponents();

    fixture = TestBed.createComponent(QuotationStatus);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
