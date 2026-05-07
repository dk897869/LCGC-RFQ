import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PriceApproval } from './price-approval';

describe('PriceApproval', () => {
  let component: PriceApproval;
  let fixture: ComponentFixture<PriceApproval>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PriceApproval],
    }).compileComponents();

    fixture = TestBed.createComponent(PriceApproval);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
