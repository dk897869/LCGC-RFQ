import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NppProcurement } from './npp-procurement';

describe('NppProcurement', () => {
  let component: NppProcurement;
  let fixture: ComponentFixture<NppProcurement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NppProcurement],
    }).compileComponents();

    fixture = TestBed.createComponent(NppProcurement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
