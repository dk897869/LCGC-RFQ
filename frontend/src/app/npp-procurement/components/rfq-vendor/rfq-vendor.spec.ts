import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RfqVendor } from './rfq-vendor';

describe('RfqVendor', () => {
  let component: RfqVendor;
  let fixture: ComponentFixture<RfqVendor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RfqVendor],
    }).compileComponents();

    fixture = TestBed.createComponent(RfqVendor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
