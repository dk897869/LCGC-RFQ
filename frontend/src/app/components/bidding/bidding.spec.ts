import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Bidding } from './bidding';

describe('Bidding', () => {
  let component: Bidding;
  let fixture: ComponentFixture<Bidding>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Bidding],
    }).compileComponents();

    fixture = TestBed.createComponent(Bidding);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
