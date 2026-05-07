import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SystemBom } from './system-bom';

describe('SystemBom', () => {
  let component: SystemBom;
  let fixture: ComponentFixture<SystemBom>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SystemBom],
    }).compileComponents();

    fixture = TestBed.createComponent(SystemBom);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
