const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parse } = require('@babel/parser');

test('translation is initialized before the debrief callback evaluates its dependencies', () => {
  const source = fs.readFileSync(path.join(__dirname, 'ChatInterface.js'), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const component = ast.program.body.flatMap(node => node.declarations || []).find(node => node.id.name === 'ChatInterface');
  // Execute the actual declarations in their source order. Callback bodies are
  // deferred, but their dependency arrays execute immediately during rendering.
  const declarations = component.init.body.body.filter(node => node.type === 'VariableDeclaration' && node.declarations.some(item =>
    item.id.name === 'handleSessionComplete' || (item.init?.callee?.name === 'useTranslation')));
  expect(declarations).toHaveLength(2);
  expect(() => vm.runInNewContext(declarations.map(node => source.slice(node.start, node.end)).join('\n'), {
    useTranslation: () => ({ t: key => key, i18n: { language: 'en' } }),
    useCallback: callback => callback,
  })).not.toThrow();
});
