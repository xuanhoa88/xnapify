/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-env jest */

import renderer, { act } from 'react-test-renderer';

import ExtensionSlot from './ExtensionSlot';
import { registry } from './Registry';

// Mock AppContext
jest.mock('@shared/renderer/AppContext', () => ({
  useAppContext: () => ({ mockContext: true }),
}));

describe('ExtensionSlot', () => {
  let comp;

  beforeEach(() => {
    registry.clear(); // Ensure registry is clean
  });

  afterEach(() => {
    if (comp) {
      act(() => {
        comp.unmount();
      });
      comp = null;
    }
  });

  test('renders nothing when no components are registered', () => {
    act(() => {
      comp = renderer.create(<ExtensionSlot name='empty.slot' />);
    });
    // div wrapper is always rendered (for SSR hydration safety)
    const tree = comp.toJSON();
    expect(tree.type).toBe('div');
    expect(tree.props['data-slot']).toBe('empty.slot');
    expect(tree.children).toBeNull();
  });

  test('renders registered components with props and context', () => {
    const MockComponent1 = props => (
      <div
        className='mock1'
        // eslint-disable-next-line react/prop-types
        title={JSON.stringify({ custom: props.customProp, ctx: props.context })}
      />
    );
    const MockComponent2 = props => (
      // eslint-disable-next-line react/prop-types
      <div className='mock2'>{props.customProp}</div>
    );

    registry.registerSlot('test.slot', MockComponent1, { order: 10 });
    registry.registerSlot('test.slot', MockComponent2, { order: 20 });

    act(() => {
      comp = renderer.create(
        <ExtensionSlot name='test.slot' customProp='hello' />,
      );
    });

    const tree = comp.toJSON();
    // div wrapper contains the rendered components
    expect(tree.type).toBe('div');
    expect(tree.props['data-slot']).toBe('test.slot');
    expect(tree.children).toHaveLength(2);

    expect(tree.children[0].props.className).toBe('mock1');
    expect(tree.children[0].props.title).toContain('"custom":"hello"');
    expect(tree.children[0].props.title).toContain(
      '"ctx":{"mockContext":true}',
    );

    expect(tree.children[1].props.className).toBe('mock2');
    expect(tree.children[1].children[0]).toBe('hello');
  });

  test('updates dynamically when registry changes', () => {
    const MockComponent = () => <span>Added dynamically</span>;

    act(() => {
      comp = renderer.create(<ExtensionSlot name='dynamic.slot' />);
    });

    // Empty wrapper initially
    expect(comp.toJSON().children).toBeNull();

    act(() => {
      // simulate registering a component after rendering
      registry.registerSlot('dynamic.slot', MockComponent);
    });

    const tree = comp.toJSON();
    expect(tree.type).toBe('div');
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].type).toBe('span');
    expect(tree.children[0].children[0]).toBe('Added dynamically');
  });
});
