import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApprovalModal } from './approval-modal';

describe('ApprovalModal', () => {
  let component: ApprovalModal;
  let fixture: ComponentFixture<ApprovalModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApprovalModal],
    }).compileComponents();

    fixture = TestBed.createComponent(ApprovalModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
