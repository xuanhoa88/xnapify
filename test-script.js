import React from 'react';
import { renderToString } from 'react-dom/server';
import { IconButton, Button } from '@radix-ui/themes';

console.log("Button:", renderToString(<Button ref={() => {}} />));
console.log("IconButton:", renderToString(<IconButton ref={() => {}} />));
