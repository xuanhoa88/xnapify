/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  useState,
  useCallback,
  createContext,
  useContext,
  useMemo,
} from 'react';
import PropTypes from 'prop-types';
import s from './Tabs.css';

// Context for sharing tab state
const TabsContext = createContext(null);

/**
 * Hook to access tabs context
 */
export function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    const err = new Error(
      'Tabs components must be used within a Tabs provider',
    );
    err.name = 'TabsContextError';
    err.status = 400;
    throw err;
  }
  return context;
}

/**
 * Tabs Container Component
 *
 * @example
 * <Tabs defaultTab="profile">
 *   <Tabs.List>
 *     <Tabs.Tab id="profile">Profile</Tabs.Tab>
 *     <Tabs.Tab id="security">Security</Tabs.Tab>
 *   </Tabs.List>
 *   <Tabs.Panels>
 *     <Tabs.Panel id="profile">Profile content</Tabs.Panel>
 *     <Tabs.Panel id="security">Security content</Tabs.Panel>
 *   </Tabs.Panels>
 * </Tabs>
 */
function Tabs({ children, defaultTab, onChange, className }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleTabChange = useCallback(
    tabId => {
      setActiveTab(tabId);
      if (onChange) {
        onChange(tabId);
      }
    },
    [onChange],
  );

  const contextValue = useMemo(
    () => ({
      activeTab,
      setActiveTab: handleTabChange,
    }),
    [activeTab, handleTabChange],
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={`${s.tabs} ${className || ''}`}>{children}</div>
    </TabsContext.Provider>
  );
}

Tabs.propTypes = {
  children: PropTypes.node.isRequired,
  defaultTab: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  className: PropTypes.string,
};

/**
 * Tab List - Container for tab buttons
 */
function TabList({ children, className }) {
  return (
    <div className={`${s.tabList} ${className || ''}`} role='tablist'>
      {children}
    </div>
  );
}

TabList.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

/**
 * Tab Button - Individual tab trigger
 */
function Tab({ children, id, icon, disabled, className }) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === id;

  const handleClick = useCallback(() => {
    if (!disabled) {
      setActiveTab(id);
    }
  }, [disabled, id, setActiveTab]);

  const handleKeyDown = useCallback(
    event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  return (
    <button
      type='button'
      role='tab'
      aria-selected={isActive}
      aria-controls={`panel-${id}`}
      id={`tab-${id}`}
      tabIndex={isActive ? 0 : -1}
      className={`${s.tab} ${isActive ? s.tabActive : ''} ${disabled ? s.tabDisabled : ''} ${className || ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
    >
      {icon && <span className={s.tabIcon}>{icon}</span>}
      <span className={s.tabLabel}>{children}</span>
    </button>
  );
}

Tab.propTypes = {
  children: PropTypes.node.isRequired,
  id: PropTypes.string.isRequired,
  icon: PropTypes.node,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

/**
 * Tab Panels Container
 */
function TabPanels({ children, className }) {
  return <div className={`${s.tabPanels} ${className || ''}`}>{children}</div>;
}

TabPanels.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

/**
 * Tab Panel - Content for each tab
 */
function TabPanel({ children, id, className }) {
  const { activeTab } = useTabsContext();
  const isActive = activeTab === id;

  if (!isActive) {
    return null;
  }

  return (
    <div
      role='tabpanel'
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={`${s.tabPanel} ${className || ''}`}
    >
      {children}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node.isRequired,
  id: PropTypes.string.isRequired,
  className: PropTypes.string,
};

// Attach sub-components
Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panels = TabPanels;
Tabs.Panel = TabPanel;

export default Tabs;
