import { describe, expect, it } from 'vitest';
import { decide } from './decision';

describe('decide', () => {
  it('approves and saves the new bank details when the vendor confirmed', () => {
    expect(decide('confirmed')).toEqual({ status: 'approved', saveBank: true, blocklist: false });
  });

  it('blocks and blocklists when the vendor denied', () => {
    expect(decide('denied')).toEqual({ status: 'blocked', saveBank: false, blocklist: true });
  });

  it('treats an unclear call the same as a denial', () => {
    expect(decide('unclear')).toEqual({ status: 'blocked', saveBank: false, blocklist: true });
  });

  it('returns a failed call to frozen so the owner can retry', () => {
    expect(decide('failed')).toEqual({ status: 'frozen', saveBank: false, blocklist: false });
  });
});
