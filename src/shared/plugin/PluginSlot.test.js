/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-env jest */

import renderer, { act } from 'react-test-renderer';
import PluginSlot from './PluginSlot';
import { registry } from './Registry';

// Mock AppContext
jest.mock('../renderer/AppContext', () => ({
  useAppContext: () => ({ mockContext: true }),
}));

describe('PluginSlot', () => {
  beforeEach(() => {
    registry.clear(); // Ensure registry is clean
  });

  test('renders nothing when no components are registered', () => {
    let tree;
    act(() => {
      tree = renderer.create(<PluginSlot name='empty.slot' />).toJSON();
    });
    expect(tree).toBeNull();
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

    let tree;
    act(() => {
      tree = renderer
        .create(<PluginSlot name='test.slot' customProp='hello' />)
        .toJSON();
    });

    expect(tree).toHaveLength(2);
    expect(tree[0].props.className).toBe('mock1');
    expect(tree[0].props.title).toContain('"custom":"hello"');
    expect(tree[0].props.title).toContain('"ctx":{"mockContext":true}');

    expect(tree[1].props.className).toBe('mock2');
    expect(tree[1].children[0]).toBe('hello');
  });

  test('updates dynamically when registry changes', () => {
    const MockComponent = () => <span>Added dynamically</span>;

    let component;
    act(() => {
      component = renderer.create(<PluginSlot name='dynamic.slot' />);
    });

    expect(component.toJSON()).toBeNull();

    act(() => {
      // simulate registering a component after rendering
      registry.registerSlot('dynamic.slot', MockComponent);
    });

    const tree = component.toJSON();
    expect(tree).toBeDefined();
    expect(tree.type).toBe('span');
    expect(tree.children[0]).toBe('Added dynamically');
  });
});
