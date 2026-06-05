import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrRequest } from './pr-request';

describe('PrRequest', () => {
  let component: PrRequest;
  let fixture: ComponentFixture<PrRequest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrRequest],
    }).compileComponents();

    fixture = TestBed.createComponent(PrRequest);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
