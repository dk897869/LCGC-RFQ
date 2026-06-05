import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WccNpp } from './wcc-npp';

describe('WccNpp', () => {
  let component: WccNpp;
  let fixture: ComponentFixture<WccNpp>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WccNpp],
    }).compileComponents();

    fixture = TestBed.createComponent(WccNpp);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
