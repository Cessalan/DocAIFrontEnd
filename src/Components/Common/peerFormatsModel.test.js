import {
  PEER_FORMATS, MIN_ANSWERS, MIN_STUDENTS, IN_QUIZ_FORMATS, peerFormat, peerKey, quizPeerLine,
} from './peerFormatsModel';

describe('peerFormat', () => {
  test('quotes the measured average for a known type', () => {
    expect(peerFormat('sata')).toEqual({ key: 'sata', percent: 45, answers: 2799, students: 574 });
    expect(peerFormat('mcq').percent).toBe(84);
    expect(peerFormat('casestudy').percent).toBe(30);
  });

  test('the chat exam ordering question is the plan casestudy type', () => {
    expect(peerKey('ordering')).toBe('casestudy');
    expect(peerFormat('ordering').percent).toBe(30);
  });

  test('an unknown type has no average', () => {
    expect(peerFormat('bowtie')).toBeNull();
  });

  test('a type with too few answers or students is not quoted', () => {
    const thin = { formats: { sata: { correct: 10, total: MIN_ANSWERS - 1, students: 400 } } };
    const few = { formats: { sata: { correct: 300, total: 900, students: MIN_STUDENTS - 1 } } };
    expect(peerFormat('sata', thin)).toBeNull();
    expect(peerFormat('sata', few)).toBeNull();
  });

  test('every shipped type clears the thresholds', () => {
    Object.keys(PEER_FORMATS.formats).forEach((key) => expect(peerFormat(key)).not.toBeNull());
  });
});

describe('quizPeerLine', () => {
  test('a right answer on a hard type gets the win line', () => {
    expect(quizPeerLine({ format: 'sata', correct: true })).toEqual({ kind: 'right', key: 'sata', percent: 45 });
    expect(quizPeerLine({ format: 'matrix', correct: true }).percent).toBe(44);
  });

  test('a miss gets the line that most students miss these', () => {
    expect(quizPeerLine({ format: 'sata', correct: false })).toEqual({ kind: 'missed', key: 'sata', percent: 45 });
  });

  test('multiple choice never gets a line', () => {
    expect(quizPeerLine({ format: 'mcq', correct: false })).toBeNull();
    expect(quizPeerLine({ correct: true })).toBeNull();
  });

  test('ordering is held back until its answer keys are audited', () => {
    expect(IN_QUIZ_FORMATS).not.toContain('casestudy');
    expect(quizPeerLine({ format: 'ordering', correct: true })).toBeNull();
    expect(quizPeerLine({ format: 'casestudy', correct: false })).toBeNull();
  });

  test('nothing before she answers, and nothing for a type that is no longer hard', () => {
    expect(quizPeerLine({ format: 'sata' })).toBeNull();
    const easy = { formats: { sata: { correct: 700, total: 1000, students: 300 } } };
    expect(quizPeerLine({ format: 'sata', correct: true }, easy)).toBeNull();
  });
});
