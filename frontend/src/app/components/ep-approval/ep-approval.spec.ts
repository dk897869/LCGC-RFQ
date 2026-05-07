import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EpApproval } from './ep-approval';

describe('EpApproval', () => {
  let component: EpApproval;
  let fixture: ComponentFixture<EpApproval>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EpApproval],
    }).compileComponents();

    fixture = TestBed.createComponent(EpApproval);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
