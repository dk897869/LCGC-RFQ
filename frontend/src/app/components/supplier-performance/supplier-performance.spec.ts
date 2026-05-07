import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupplierPerformance } from './supplier-performance';

describe('SupplierPerformance', () => {
  let component: SupplierPerformance;
  let fixture: ComponentFixture<SupplierPerformance>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupplierPerformance],
    }).compileComponents();

    fixture = TestBed.createComponent(SupplierPerformance);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
