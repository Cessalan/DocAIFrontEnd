import { paymentIssueFrom, isStripeUrl } from './paymentIssueModel';

const pro = (paymentIssue) => ({ usage: { tier: 'pro' }, billing: { status: 'pro', paymentIssue } });
const ts = (ms) => ({ toMillis: () => ms });

describe('paymentIssueFrom', () => {
  it('says nothing when there is no issue', () => {
    expect(paymentIssueFrom(pro(undefined))).toBeNull();
    expect(paymentIssueFrom({})).toBeNull();
    expect(paymentIssueFrom(null)).toBeNull();
  });

  it('says nothing to a free account, even with a stale issue', () => {
    expect(paymentIssueFrom({ usage: { tier: 'free' }, billing: { paymentIssue: { since: ts(1) } } })).toBeNull();
  });

  it('passes through a Stripe invoice link and future retry date', () => {
    const later = Date.now() + 86400000;
    const issue = paymentIssueFrom(pro({
      since: ts(1000), nextAttemptAt: ts(later), subscriptionId: 'sub_1',
      invoiceUrl: 'https://invoice.stripe.com/i/acct/abc',
    }));
    expect(issue).toEqual({
      invoiceUrl: 'https://invoice.stripe.com/i/acct/abc', since: 1000, nextAttemptAt: later, key: 'sub_1:1000',
    });
  });

  it('drops a link that is not Stripe, so the banner uses the portal', () => {
    const issue = paymentIssueFrom(pro({ since: ts(1), invoiceUrl: 'https://evil.example/pay' }));
    expect(issue.invoiceUrl).toBeNull();
  });

  it('hides a retry date that has passed', () => {
    expect(paymentIssueFrom(pro({ since: ts(1), nextAttemptAt: ts(5) })).nextAttemptAt).toBeNull();
  });

  it('gives each failure its own key', () => {
    const a = paymentIssueFrom(pro({ since: ts(1), subscriptionId: 'sub_1' }));
    const b = paymentIssueFrom(pro({ since: ts(2), subscriptionId: 'sub_1' }));
    expect(a.key).not.toEqual(b.key);
  });
});

describe('isStripeUrl', () => {
  it('accepts only https Stripe hosts', () => {
    expect(isStripeUrl('https://invoice.stripe.com/i/x')).toBe(true);
    expect(isStripeUrl('http://invoice.stripe.com/i/x')).toBe(false);
    expect(isStripeUrl('https://invoice.stripe.com.evil.io/x')).toBe(false);
    expect(isStripeUrl('javascript:alert(1)')).toBe(false);
    expect(isStripeUrl(null)).toBe(false);
  });
});
