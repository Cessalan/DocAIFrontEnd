import { buildRoundOffer, LOW_QUESTIONS } from './roundOfferModel';

const round = (before, after, extra = {}) => ({
  n: 2, kind: 'skill', skill: 'sata', status: 'done', outcome: 'fixed',
  before: { correct: before[0], total: before[1] },
  after: { correct: after[0], total: after[1] },
  ...extra,
});

describe('buildRoundOffer', () => {
  it('offers on a round that measurably improved, with her own numbers', () => {
    const offer = buildRoundOffer({ round: round([0, 2], [4, 5]), isPro: false, remaining: 40 });
    expect(offer).toEqual({
      before: { correct: 0, total: 2 }, after: { correct: 4, total: 5 }, remaining: 40, low: false,
    });
  });

  it('marks the offer low when about two rounds of questions are left', () => {
    expect(buildRoundOffer({ round: round([1, 2], [4, 5]), isPro: false, remaining: LOW_QUESTIONS }).low).toBe(true);
    expect(buildRoundOffer({ round: round([1, 2], [4, 5]), isPro: false, remaining: LOW_QUESTIONS + 1 }).low).toBe(false);
  });

  it('never offers to Pro', () => {
    expect(buildRoundOffer({ round: round([0, 2], [4, 5]), isPro: true, remaining: Infinity })).toBeNull();
  });

  it('stays quiet at zero questions left: the limit screen speaks next', () => {
    expect(buildRoundOffer({ round: round([0, 2], [4, 5]), isPro: false, remaining: 0 })).toBeNull();
  });

  it('a strong round that was already strong is not an improvement', () => {
    // The 2026-11-14 mixed review: 16 of 20 before, 5 of 6 after.
    expect(buildRoundOffer({ round: round([16, 20], [5, 6], { kind: 'mixed' }), isPro: false, remaining: 30 })).toBeNull();
  });

  it('a round that did not move gets no offer', () => {
    expect(buildRoundOffer({ round: round([2, 3], [2, 3], { outcome: 'notYet' }), isPro: false, remaining: 30 })).toBeNull();
  });

  it('needs enough answers on both sides to compare', () => {
    expect(buildRoundOffer({ round: round([0, 1], [4, 5]), isPro: false, remaining: 30 })).toBeNull();
    expect(buildRoundOffer({ round: round([0, 2], [2, 2]), isPro: false, remaining: 30 })).toBeNull();
  });

  it('ignores a round still in progress, and missing input', () => {
    expect(buildRoundOffer({ round: round([0, 2], [4, 5], { status: 'active' }), isPro: false, remaining: 30 })).toBeNull();
    expect(buildRoundOffer({ round: null, isPro: false, remaining: 30 })).toBeNull();
    expect(buildRoundOffer()).toBeNull();
  });

  it('counts a rise of exactly the threshold', () => {
    expect(buildRoundOffer({ round: round([3, 5], [4, 5]), isPro: false, remaining: 30 })).not.toBeNull();
  });
});
