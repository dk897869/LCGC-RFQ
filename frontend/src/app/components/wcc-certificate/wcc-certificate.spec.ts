import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WccCertificate } from './wcc-certificate';

describe('WccCertificate', () => {
  let component: WccCertificate;
  let fixture: ComponentFixture<WccCertificate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WccCertificate],
    }).compileComponents();

    fixture = TestBed.createComponent(WccCertificate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
