import { describe, expect, it } from 'vitest';
import { resolveDialNumber } from './dial-guard';

const env = { ALLOWED_CALL_NUMBERS: '+16195550101, +16195550102', DEMO_CALL_NUMBER: '' };

describe('resolveDialNumber', () => {
  it('dials the found number when it is on the allow-list', () => {
    expect(resolveDialNumber('+16195550101', env)).toEqual({ dialed: '+16195550101' });
  });

  it('refuses a number that is not on the allow-list', () => {
    expect(resolveDialNumber('+18002955510', env)).toEqual({
      error: 'Refusing to dial +18002955510: it is not in ALLOWED_CALL_NUMBERS.',
    });
  });

  it('redirects to the demo number when one is set', () => {
    expect(resolveDialNumber('+18002955510', { ...env, DEMO_CALL_NUMBER: '+16195550102' }))
      .toEqual({ dialed: '+16195550102' });
  });

  it('refuses a demo number that is not on the allow-list', () => {
    expect(resolveDialNumber('+16195550101', { ...env, DEMO_CALL_NUMBER: '+19995550000' }))
      .toHaveProperty('error');
  });

  it('refuses when no number is known and the allow-list is empty', () => {
    expect(resolveDialNumber(null, env)).toEqual({ error: 'No verified phone number is known for this vendor.' });
    expect(resolveDialNumber('+16195550101', {})).toHaveProperty('error');
  });
});
