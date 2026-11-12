import { getSelectableAncestor, selectionSurface } from './selectionScope';

function mount(html) {
  document.body.innerHTML = html;
  return (id) => document.getElementById(id);
}

const textOf = (el) => el.firstChild;

describe('what can be highlighted and explained', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('text inside an AI answer is explainable', () => {
    const $ = mount('<div id="ai" data-selectable="true"><p id="p">Digoxin slows the heart.</p></div>');
    expect(getSelectableAncestor(textOf($('p')))).toBe($('ai'));
  });

  test("the student's own message is not", () => {
    const $ = mount('<div data-selectable="false"><p id="p">what is digoxin</p></div>');
    expect(getSelectableAncestor(textOf($('p')))).toBeNull();
  });

  test('text outside any opted-in surface is not', () => {
    const $ = mount('<nav><span id="s">My chats</span></nav>');
    expect(getSelectableAncestor(textOf($('s')))).toBeNull();
  });

  test('a button inside an AI surface is not, whatever its label says', () => {
    const $ = mount(`
      <div data-selectable="true">
        <p id="p">Which finding matters most?</p>
        <button><span id="b">Heart rate of 48</span></button>
        <div role="button"><span id="r">Show me how</span></div>
      </div>`);
    expect(getSelectableAncestor(textOf($('p')))).not.toBeNull();
    expect(getSelectableAncestor(textOf($('b')))).toBeNull();
    expect(getSelectableAncestor(textOf($('r')))).toBeNull();
  });

  test('a field she types into is not', () => {
    const $ = mount('<div data-selectable="true"><textarea id="t">my notes</textarea></div>');
    expect(getSelectableAncestor($('t'))).toBeNull();
  });

  test('an opted-out block inside an AI surface stays closed', () => {
    const $ = mount('<div data-selectable="true"><div data-selectable="false"><p id="p">quoted</p></div></div>');
    expect(getSelectableAncestor(textOf($('p')))).toBeNull();
  });

  test('a drag from an answer onto a button is not a selection', () => {
    const $ = mount(`
      <div data-selectable="true">
        <p id="p">Which finding matters most?</p>
        <button id="b">Heart rate of 48</button>
      </div>`);
    const range = document.createRange();
    range.setStart(textOf($('p')), 0);
    range.setEnd(textOf($('b')), 5);
    expect(selectionSurface(range)).toBeNull();
  });

  test('a drag across two different surfaces is not a selection', () => {
    const $ = mount(`
      <div data-selectable="true"><p id="a">first answer</p></div>
      <div data-selectable="true"><p id="b">second answer</p></div>`);
    const range = document.createRange();
    range.setStart(textOf($('a')), 0);
    range.setEnd(textOf($('b')), 3);
    expect(selectionSurface(range)).toBeNull();
  });

  test('a drag inside one answer is', () => {
    const $ = mount('<div id="ai" data-selectable="true"><p id="a">one</p><p id="b">two</p></div>');
    const range = document.createRange();
    range.setStart(textOf($('a')), 0);
    range.setEnd(textOf($('b')), 2);
    expect(selectionSurface(range)).toBe($('ai'));
  });
});
