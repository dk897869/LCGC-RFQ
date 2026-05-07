import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Dqms } from './dqms';

describe('Dqms', () => {
  let component: Dqms;
  let fixture: ComponentFixture<Dqms>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dqms],
    }).compileComponents();

    fixture = TestBed.createComponent(Dqms);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
