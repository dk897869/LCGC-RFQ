import { TestBed } from '@angular/core/testing';

import { RfqService } from './rfq.services';

describe('RfqService', () => {
  let service: RfqService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RfqService );
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
