import React from 'react';

import { IconButton, Button } from '@radix-ui/themes';
import { renderToString } from 'react-dom/server';

console.log('Button:', renderToString(<Button ref={() => {}} />));
console.log('IconButton:', renderToString(<IconButton ref={() => {}} />));
