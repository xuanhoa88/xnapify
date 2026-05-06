/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Box, Grid, Flex } from '@radix-ui/themes';

import ActivityWidget from './components/ActivityWidget.js';
import AtAGlanceWidget from './components/AtAGlanceWidget.js';
import QuickActionsWidget from './components/QuickActionsWidget.js';
import SiteHealthWidget from './components/SiteHealthWidget.js';
import SystemNewsWidget from './components/SystemNewsWidget.js';

import s from './Dashboard.css';

function Dashboard() {
  return (
    <Box className={s.container}>
      <Grid columns={{ initial: '1', md: '2' }} gap='4' align='start'>
        <Flex direction='column' gap='4'>
          <SiteHealthWidget />
          <AtAGlanceWidget />
          <ActivityWidget />
        </Flex>

        <Flex direction='column' gap='4'>
          <QuickActionsWidget />
          <SystemNewsWidget />
        </Flex>
      </Grid>
    </Box>
  );
}

export default Dashboard;
