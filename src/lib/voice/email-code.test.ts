import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  codeMatches, decideWithCode, digitsFromSpeech, emailCodeEnabled, generateCode, maskEmail,
  resolveEmailRecipient, sendCodeEmail,
} from './email-code';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('emailCodeEnabled', () => {
  it('is off unless EMAIL_CODE_CHECK=1', () => {
    expect(emailCodeEnabled({})).toBe(false);
    expect(emailCodeEnabled({ EMAIL_CODE_CHECK: '0' })).toBe(false);
    expect(emailCodeEnabled({ EMAIL_CODE_CHECK: '1' })).toBe(true);
  });
});

describe('generateCode', () => {
  it('makes a six-digit code', () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
});

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('customer.service@uline.com')).toBe('c***@uline.com');
    expect(maskEmail('not-an-email')).toBe('the vendor\'s public email address');
  });
});

describe('resolveEmailRecipient', () => {
  const env = { ALLOWED_EMAIL_RECIPIENTS: 'demo@team.dev, ap@test.dev', DEMO_EMAIL_TO: 'demo@team.dev' };

  it('needs a public address from the web check', () => {
    expect(resolveEmailRecipient(null, env)).toEqual({ error: 'No public email address is known for this vendor.' });
  });

  it('redirects to the demo inbox, which must be on the allow-list', () => {
    expect(resolveEmailRecipient('customer.service@uline.com', env)).toEqual({ sendTo: 'demo@team.dev' });
    expect(resolveEmailRecipient('customer.service@uline.com', { ...env, ALLOWED_EMAIL_RECIPIENTS: 'ap@test.dev' }))
      .toEqual({ error: 'Refusing to email demo@team.dev: it is not in ALLOWED_EMAIL_RECIPIENTS.' });
  });

  it('never emails an address that is not on the allow-list, even with no redirect', () => {
    expect(resolveEmailRecipient('customer.service@uline.com', { ALLOWED_EMAIL_RECIPIENTS: 'demo@team.dev' }))
      .toEqual({ error: 'Refusing to email customer.service@uline.com: it is not in ALLOWED_EMAIL_RECIPIENTS.' });
    expect(resolveEmailRecipient('AP@Test.dev', { ALLOWED_EMAIL_RECIPIENTS: 'ap@test.dev' })).toEqual({ sendTo: 'ap@test.dev' });
  });
});

describe('digitsFromSpeech and codeMatches', () => {
  it('reads digits, spoken digit words and "oh"', () => {
    expect(digitsFromSpeech('4 2 9 1 1 7')).toBe('429117');
    expect(digitsFromSpeech('four two nine, one one seven')).toBe('429117');
    expect(digitsFromSpeech('Sure, it is oh eight 3 five nine zero')).toBe('083590');
  });

  it('matches only the exact six digits', () => {
    expect(codeMatches('429117', 'four two nine one one seven')).toBe(true);
    expect(codeMatches('429117', '429118')).toBe(false);
    expect(codeMatches('429117', '')).toBe(false);
    expect(codeMatches('429117', null)).toBe(false);
  });
});

describe('decideWithCode', () => {
  it('changes nothing when no code was sent', () => {
    expect(decideWithCode('confirmed', null, null)).toEqual({ decision: 'confirmed', codeCheck: null });
    expect(decideWithCode('denied', null, '123456')).toEqual({ decision: 'denied', codeCheck: null });
  });

  it('confirms a "yes" only when the code read back matches', () => {
    expect(decideWithCode('confirmed', '429117', '4 2 9 1 1 7')).toEqual({ decision: 'confirmed', codeCheck: 'passed' });
  });

  it('escalates a "yes" with a wrong or missing code instead of approving or blocking', () => {
    expect(decideWithCode('confirmed', '429117', '111111')).toEqual({ decision: 'escalate', codeCheck: 'failed' });
    expect(decideWithCode('confirmed', '429117', null)).toEqual({ decision: 'escalate', codeCheck: 'failed' });
  });

  it('leaves denied and unclear calls as they are', () => {
    expect(decideWithCode('denied', '429117', null)).toEqual({ decision: 'denied', codeCheck: null });
    expect(decideWithCode('unclear', '429117', '000000')).toEqual({ decision: 'unclear', codeCheck: null });
  });
});

describe('sendCodeEmail', () => {
  it('sends nothing in mock mode', async () => {
    vi.stubEnv('MOCK_EMAIL', '1');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await sendCodeEmail('demo@team.dev', '429117', { businessName: 'Harbor', vendorName: 'Uline' })).toEqual({ mocked: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends the code through Resend', async () => {
    vi.stubEnv('MOCK_EMAIL', '0');
    vi.stubEnv('RESEND_API_KEY', 're_test');
    const fetchSpy = vi.fn().mockResolvedValue(Response.json({ id: 'email_1' }));
    vi.stubGlobal('fetch', fetchSpy);
    await sendCodeEmail('demo@team.dev', '429117', { businessName: 'Harbor', vendorName: 'Uline' });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(['demo@team.dev']);
    expect(body.text).toContain('429117');
    expect(body.subject).toContain('Uline');
  });

  it('throws when Resend refuses, and when no key is set', async () => {
    vi.stubEnv('MOCK_EMAIL', '0');
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"message":"domain not verified"}', { status: 403 })));
    await expect(sendCodeEmail('x@y.dev', '1', { businessName: 'H', vendorName: 'U' })).rejects.toThrow('403');
    vi.stubEnv('RESEND_API_KEY', '');
    await expect(sendCodeEmail('x@y.dev', '1', { businessName: 'H', vendorName: 'U' })).rejects.toThrow('RESEND_API_KEY');
  });
});
