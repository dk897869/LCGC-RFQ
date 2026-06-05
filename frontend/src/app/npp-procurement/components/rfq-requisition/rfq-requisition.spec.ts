import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RfqRequisition } from './rfq-requisition';

describe('RfqRequisition', () => {
  let component: RfqRequisition;
  let fixture: ComponentFixture<RfqRequisition>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RfqRequisition],
    }).compileComponents();

    fixture = TestBed.createComponent(RfqRequisition);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
