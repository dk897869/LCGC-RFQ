import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Npi } from './npi';

describe('Npi', () => {
  let component: Npi;
  let fixture: ComponentFixture<Npi>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Npi],
    }).compileComponents();

    fixture = TestBed.createComponent(Npi);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
