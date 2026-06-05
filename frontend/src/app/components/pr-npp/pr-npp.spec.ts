import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrNpp } from './pr-npp';

describe('PrNpp', () => {
  let component: PrNpp;
  let fixture: ComponentFixture<PrNpp>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrNpp],
    }).compileComponents();

    fixture = TestBed.createComponent(PrNpp);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
