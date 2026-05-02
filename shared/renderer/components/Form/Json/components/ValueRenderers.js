/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState } from 'react';

import { Box, Text } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import { DataTypeLabel } from './DataTypeLabel';

import s from './ValueRenderers.css';

function JsonString({ value, displayDataTypes, collapseStringsAfterLength }) {
  const [collapsed, setCollapsed] = useState(true);
  const collapsible =
    typeof collapseStringsAfterLength === 'number' &&
    value.length > collapseStringsAfterLength;

  const display =
    collapsible && collapsed
      ? `${value.substring(0, collapseStringsAfterLength)}...`
      : value;

  return (
    <Box className={s.stringValue}>
      <DataTypeLabel type='string' show={displayDataTypes} />
      <Text
        as='span'
        className={collapsible ? s.pointer : ''}
        onClick={() => collapsible && setCollapsed(prev => !prev)}
      >
        &quot;{display}&quot;
      </Text>
    </Box>
  );
}

JsonString.propTypes = {
  value: PropTypes.string.isRequired,
  displayDataTypes: PropTypes.bool.isRequired,
  collapseStringsAfterLength: PropTypes.number.isRequired,
};

function JsonInteger({ value, displayDataTypes }) {
  return (
    <Box className={s.integerValue}>
      <DataTypeLabel type='int' show={displayDataTypes} />
      {value}
    </Box>
  );
}

JsonInteger.propTypes = {
  value: PropTypes.number.isRequired,
  displayDataTypes: PropTypes.bool.isRequired,
};

function JsonFloat({ value, displayDataTypes }) {
  return (
    <Box className={s.floatValue}>
      <DataTypeLabel type='float' show={displayDataTypes} />
      {value}
    </Box>
  );
}

JsonFloat.propTypes = {
  value: PropTypes.number.isRequired,
  displayDataTypes: PropTypes.bool.isRequired,
};

function JsonBoolean({ value, displayDataTypes }) {
  return (
    <Box className={s.booleanValue}>
      <DataTypeLabel type='bool' show={displayDataTypes} />
      {value ? 'true' : 'false'}
    </Box>
  );
}

JsonBoolean.propTypes = {
  value: PropTypes.bool.isRequired,
  displayDataTypes: PropTypes.bool.isRequired,
};

function JsonNull({ displayDataTypes }) {
  return (
    <Box className={s.nullValue}>
      <DataTypeLabel type='null' show={displayDataTypes} />
      NULL
    </Box>
  );
}

JsonNull.propTypes = {
  displayDataTypes: PropTypes.bool.isRequired,
};

function JsonUndefined() {
  return <Box className={s.undefinedValue}>undefined</Box>;
}

function JsonNan() {
  return <Box className={s.nanValue}>NaN</Box>;
}

function JsonDate({ value, displayDataTypes }) {
  const display = value.toLocaleTimeString('en-us', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <Box className={s.dateValue}>
      <DataTypeLabel type='date' show={displayDataTypes} />
      {display}
    </Box>
  );
}

JsonDate.propTypes = {
  value: PropTypes.instanceOf(Date).isRequired,
  displayDataTypes: PropTypes.bool.isRequired,
};

function JsonRegexp({ value, displayDataTypes }) {
  return (
    <Box className={s.regexpValue}>
      <DataTypeLabel type='regexp' show={displayDataTypes} />
      {value.toString()}
    </Box>
  );
}

JsonRegexp.propTypes = {
  value: PropTypes.instanceOf(RegExp).isRequired,
  displayDataTypes: PropTypes.bool.isRequired,
};

function JsonFunction({ value, displayDataTypes }) {
  const [collapsed, setCollapsed] = useState(true);
  const str = value.toString().slice(9, -1);
  const header = str.replace(/\{[\s\S]+/, '');

  return (
    <Box className={s.functionValue}>
      <DataTypeLabel type='fn' show={displayDataTypes} />
      <Text as='span' onClick={() => setCollapsed(prev => !prev)}>
        {collapsed ? (
          <Text as='span'>
            {header}
            <Text as='span' className={s.functionValueCollapsed}>
              {'{'}
              <Text as='span' className={s.ellipsis}>
                ...
              </Text>
              {'}'}
            </Text>
          </Text>
        ) : (
          str
        )}
      </Text>
    </Box>
  );
}

JsonFunction.propTypes = {
  value: PropTypes.instanceOf(Function).isRequired,
  displayDataTypes: PropTypes.bool.isRequired,
};

/**
 * Renders the correct value component based on the variable type.
 */
export default function ValueRenderer({ value, type, ...props }) {
  switch (type) {
    case 'string':
      return <JsonString value={value} {...props} />;
    case 'integer':
      return <JsonInteger value={value} {...props} />;
    case 'float':
      return <JsonFloat value={value} {...props} />;
    case 'boolean':
      return <JsonBoolean value={value} {...props} />;
    case 'null':
      return <JsonNull {...props} />;
    case 'undefined':
      return <JsonUndefined />;
    case 'nan':
      return <JsonNan />;
    case 'date':
      return <JsonDate value={value} {...props} />;
    case 'regexp':
      return <JsonRegexp value={value} {...props} />;
    case 'function':
      return <JsonFunction value={value} {...props} />;
    default:
      return <Text as='span'>{JSON.stringify(value)}</Text>;
  }
}

ValueRenderer.propTypes = {
  value: PropTypes.any.isRequired,
  type: PropTypes.string.isRequired,
  displayDataTypes: PropTypes.bool.isRequired,
  collapseStringsAfterLength: PropTypes.number.isRequired,
};
