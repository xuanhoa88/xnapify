/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState } from 'react';

import { ChevronUpIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { Card, Flex, Text, IconButton, Box } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import s from './WidgetCard.css';

function WidgetCard({ title, children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <Card size='1' variant='surface' className={s.card}>
      <Flex align='center' justify='between' className={s.header}>
        <Flex align='center' gap='2'>
          <Text size='3' weight='bold' className={s.title}>
            {title}
          </Text>
        </Flex>

        <Flex gap='1'>
          <IconButton
            size='1'
            variant='ghost'
            color='gray'
            onClick={() => setIsCollapsed(!isCollapsed)}
            title='Toggle panel'
          >
            {isCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
          </IconButton>
        </Flex>
      </Flex>

      {!isCollapsed && <Box className={s.body}>{children}</Box>}
    </Card>
  );
}

WidgetCard.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

export default WidgetCard;
