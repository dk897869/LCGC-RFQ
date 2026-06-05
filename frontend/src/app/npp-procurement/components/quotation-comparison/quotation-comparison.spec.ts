import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuotationComparison } from './quotation-comparison';

describe('QuotationComparison', () => {
  let component: QuotationComparison;
  let fixture: ComponentFixture<QuotationComparison>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuotationComparison],
    }).compileComponents();

    fixture = TestBed.createComponent(QuotationComparison);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
