import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToastNotification } from './toast-notification';

describe('ToastNotification', () => {
  let component: ToastNotification;
  let fixture: ComponentFixture<ToastNotification>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastNotification],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastNotification);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
