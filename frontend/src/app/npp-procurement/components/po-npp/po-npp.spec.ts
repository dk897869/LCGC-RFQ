import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PoNpp } from './po-npp';

describe('PoNpp', () => {
  let component: PoNpp;
  let fixture: ComponentFixture<PoNpp>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoNpp],
    }).compileComponents();

    fixture = TestBed.createComponent(PoNpp);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
