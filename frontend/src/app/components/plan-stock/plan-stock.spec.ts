import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanStock } from './plan-stock';

describe('PlanStock', () => {
  let component: PlanStock;
  let fixture: ComponentFixture<PlanStock>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanStock],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanStock);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
