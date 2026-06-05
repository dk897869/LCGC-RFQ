import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewVendor } from './new-vendor';

describe('NewVendor', () => {
  let component: NewVendor;
  let fixture: ComponentFixture<NewVendor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewVendor],
    }).compileComponents();

    fixture = TestBed.createComponent(NewVendor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
