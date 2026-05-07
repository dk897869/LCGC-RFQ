import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VehicularMs } from './vehicular-ms';

describe('VehicularMs', () => {
  let component: VehicularMs;
  let fixture: ComponentFixture<VehicularMs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehicularMs],
    }).compileComponents();

    fixture = TestBed.createComponent(VehicularMs);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
