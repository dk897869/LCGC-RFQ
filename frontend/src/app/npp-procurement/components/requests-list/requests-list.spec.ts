import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestsList } from './requests-list';

describe('RequestsList', () => {
  let component: RequestsList;
  let fixture: ComponentFixture<RequestsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestsList],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestsList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
