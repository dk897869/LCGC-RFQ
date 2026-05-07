import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BomForecast } from './bom-forecast';

describe('BomForecast', () => {
  let component: BomForecast;
  let fixture: ComponentFixture<BomForecast>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BomForecast],
    }).compileComponents();

    fixture = TestBed.createComponent(BomForecast);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
