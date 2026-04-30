import { Box, Grid, Flex } from '@radix-ui/themes';

import ActivityWidget from './components/ActivityWidget';
import AtAGlanceWidget from './components/AtAGlanceWidget';
import QuickActionsWidget from './components/QuickActionsWidget';
import SiteHealthWidget from './components/SiteHealthWidget';
import SystemNewsWidget from './components/SystemNewsWidget';

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
