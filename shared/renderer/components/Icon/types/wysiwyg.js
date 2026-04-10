/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

export default {
  bold: [
    <>
      <path d='M6 4H14C15.1046 4 16.0818 4.42143 16.8284 5.17157C17.5786 5.92172 18 6.89543 18 8C18 9.10457 17.5786 10.0783 16.8284 10.8284C16.0818 11.5786 15.1046 12 14 12H6V4Z' />{' '}
      <path d='M6 12H15C16.1046 12 17.0818 12.4214 17.8284 13.1716C18.5786 13.9217 19 14.8954 19 16C19 17.1046 18.5786 18.0783 17.8284 18.8284C17.0818 19.5786 16.1046 20 15 20H6V12Z' />
    </>,
  ],
  italic: [
    <>
      <line x1='19' y1='4' x2='10' y2='4' />{' '}
      <line x1='14' y1='20' x2='5' y2='20' />{' '}
      <line x1='15' y1='4' x2='9' y2='20' />
    </>,
  ],
  underline: [
    <>
      <path d='M6 3V10C6 13.3137 8.68629 16 12 16C15.3137 16 18 13.3137 18 10V3' />{' '}
      <line x1='4' y1='21' x2='20' y2='21' />
    </>,
  ],
  strikethrough: [
    <>
      <path d='M17.3 4.9C16.2 3.7 14.4 3 12.2 3C9.5 3 6.9 4.6 6.9 7.5C6.9 8.8 7.5 9.9 8.4 10.7' />{' '}
      <line x1='4' y1='12' x2='20' y2='12' />{' '}
      <path d='M15.6 13.3C16.1 14 16.4 14.8 16.4 15.8C16.4 18.8 13.8 21 11 21C8.7 21 6.9 19.9 6 18.2' />
    </>,
  ],
  bulletList: [
    <>
      <line x1='9' y1='6' x2='20' y2='6' />{' '}
      <line x1='9' y1='12' x2='20' y2='12' />{' '}
      <line x1='9' y1='18' x2='20' y2='18' />{' '}
      <circle cx='4.5' cy='6' r='1' fill='currentColor' stroke='none' />{' '}
      <circle cx='4.5' cy='12' r='1' fill='currentColor' stroke='none' />{' '}
      <circle cx='4.5' cy='18' r='1' fill='currentColor' stroke='none' />
    </>,
  ],
  orderedList: [
    <>
      <line x1='10' y1='6' x2='21' y2='6' />{' '}
      <line x1='10' y1='12' x2='21' y2='12' />{' '}
      <line x1='10' y1='18' x2='21' y2='18' />{' '}
      <text
        x='3'
        y='8'
        fill='currentColor'
        stroke='none'
        fontSize='8'
        fontFamily='sans-serif'
        fontWeight='600'
      >
        {' '}
        1{' '}
      </text>{' '}
      <text
        x='3'
        y='14'
        fill='currentColor'
        stroke='none'
        fontSize='8'
        fontFamily='sans-serif'
        fontWeight='600'
      >
        {' '}
        2{' '}
      </text>{' '}
      <text
        x='3'
        y='20'
        fill='currentColor'
        stroke='none'
        fontSize='8'
        fontFamily='sans-serif'
        fontWeight='600'
      >
        {' '}
        3{' '}
      </text>
    </>,
  ],
  blockquote: [
    <>
      <path
        fill='currentColor'
        stroke='none'
        d='M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C9.591 11.68 11 13.168 11 15c0 1.933-1.567 3.5-3.5 3.5-1.204 0-2.34-.612-2.917-1.179zM14.583 17.321C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C19.591 11.68 21 13.168 21 15c0 1.933-1.567 3.5-3.5 3.5-1.204 0-2.34-.612-2.917-1.179z'
      />
    </>,
  ],
  horizontalRule: [
    <>
      <line x1='2' y1='12' x2='22' y2='12' />
    </>,
  ],
  undo: [
    <>
      <polyline points='1 4 1 10 7 10' />{' '}
      <path d='M3.51 15C4.15839 16.8404 5.38734 18.4202 7.01166 19.5014C8.63598 20.5826 10.5677 21.1066 12.5157 20.9945C14.4637 20.8823 16.3226 20.1402 17.8121 18.878C19.3017 17.6159 20.3413 15.9001 20.773 13.9945C21.2048 12.0888 21.0053 10.0975 20.2038 8.31469C19.4023 6.53191 18.0421 5.05296 16.3321 4.10423C14.6222 3.1555 12.6552 2.78808 10.7221 3.0558C8.78904 3.32353 6.99531 4.21163 5.64 5.58L1 10' />
    </>,
  ],
  redo: [
    <>
      <polyline points='23 4 23 10 17 10' />{' '}
      <path d='M20.49 15C19.8416 16.8404 18.6127 18.4202 16.9883 19.5014C15.364 20.5826 13.4323 21.1066 11.4843 20.9945C9.53634 20.8823 7.67737 20.1402 6.18786 18.878C4.69835 17.6159 3.65875 15.9001 3.22699 13.9945C2.79522 12.0888 2.99474 10.0975 3.79625 8.31469C4.59775 6.53191 5.95793 5.05296 7.66787 4.10423C9.37782 3.1555 11.3448 2.78808 13.2779 3.0558C15.211 3.32353 17.0047 4.21163 18.36 5.58L23 10' />
    </>,
  ],
  taskList: [
    <>
      <polyline points='9 11 12 14 22 4'></polyline>{' '}
      <path d='M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'></path>
    </>,
  ],
  table: [
    <>
      <rect x='3' y='3' width='18' height='18' rx='2' ry='2' />{' '}
      <line x1='3' y1='9' x2='21' y2='9' />{' '}
      <line x1='3' y1='15' x2='21' y2='15' />{' '}
      <line x1='9' y1='3' x2='9' y2='21' />{' '}
      <line x1='15' y1='3' x2='15' y2='21' />
    </>,
  ],
  tableRow: [
    <>
      <rect
        x='3'
        y='9'
        width='18'
        height='6'
        rx='1'
        ry='1'
        fill='currentColor'
        fillOpacity='0.3'
      />{' '}
      <rect x='3' y='3' width='18' height='18' rx='2' ry='2' />{' '}
      <line x1='9' y1='3' x2='9' y2='21' />
    </>,
  ],
  tableCol: [
    <>
      <rect
        x='9'
        y='3'
        width='6'
        height='18'
        rx='1'
        ry='1'
        fill='currentColor'
        fillOpacity='0.3'
      />{' '}
      <rect x='3' y='3' width='18' height='18' rx='2' ry='2' />{' '}
      <line x1='3' y1='9' x2='21' y2='9' />
    </>,
  ],
  tableDelete: [
    <>
      <rect x='3' y='3' width='18' height='18' rx='2' ry='2' />{' '}
      <line x1='3' y1='9' x2='21' y2='9' />{' '}
      <line x1='9' y1='3' x2='9' y2='21' />{' '}
      <line x1='8' y1='8' x2='16' y2='16' stroke='#ef4444' strokeWidth='3' />{' '}
      <line x1='16' y1='8' x2='8' y2='16' stroke='#ef4444' strokeWidth='3' />
    </>,
  ],
  tableMergeOrSplit: [
    <>
      <rect x='3' y='3' width='18' height='18' rx='2' ry='2' />{' '}
      <line x1='12' y1='3' x2='12' y2='9' />{' '}
      <line x1='12' y1='15' x2='12' y2='21' />{' '}
      <line x1='3' y1='9' x2='21' y2='9' />{' '}
      <line x1='3' y1='15' x2='21' y2='15' /> <path d='M8 12L12 10L16 12' />{' '}
      <path d='M8 12L12 14L16 12' />
    </>,
  ],
  tableAddRowBefore: [
    <>
      <rect
        x='3'
        y='3'
        width='18'
        height='6'
        rx='1'
        ry='1'
        fill='currentColor'
        fillOpacity='0.3'
      />{' '}
      <rect x='3' y='3' width='18' height='18' rx='2' ry='2' />{' '}
      <line x1='9' y1='3' x2='9' y2='21' />{' '}
      <line x1='3' y1='15' x2='21' y2='15' />
    </>,
  ],
  tableAddColBefore: [
    <>
      <rect
        x='3'
        y='3'
        width='6'
        height='18'
        rx='1'
        ry='1'
        fill='currentColor'
        fillOpacity='0.3'
      />{' '}
      <rect x='3' y='3' width='18' height='18' rx='2' ry='2' />{' '}
      <line x1='3' y1='9' x2='21' y2='9' />{' '}
      <line x1='15' y1='3' x2='15' y2='21' />
    </>,
  ],
  tableDeleteRow: [
    <>
      <rect x='3' y='3' width='18' height='18' rx='2' ry='2' />{' '}
      <line x1='3' y1='9' x2='21' y2='9' />{' '}
      <line x1='3' y1='15' x2='21' y2='15' />{' '}
      <line x1='9' y1='3' x2='9' y2='21' />{' '}
      <line x1='5' y1='12' x2='19' y2='12' stroke='#ef4444' strokeWidth='3' />
    </>,
  ],
  tableDeleteCol: [
    <>
      <rect x='3' y='3' width='18' height='18' rx='2' ry='2' />{' '}
      <line x1='3' y1='9' x2='21' y2='9' />{' '}
      <line x1='9' y1='3' x2='9' y2='21' />{' '}
      <line x1='15' y1='3' x2='15' y2='21' />{' '}
      <line x1='12' y1='5' x2='12' y2='19' stroke='#ef4444' strokeWidth='3' />
    </>,
  ],
  tableToggleHeader: [
    <>
      <rect
        x='3'
        y='3'
        width='18'
        height='6'
        rx='1'
        ry='1'
        fill='currentColor'
        fillOpacity='0.5'
      />{' '}
      <rect x='3' y='3' width='18' height='18' rx='2' ry='2' />{' '}
      <line x1='3' y1='15' x2='21' y2='15' />{' '}
      <line x1='9' y1='3' x2='9' y2='21' />{' '}
      <line x1='15' y1='3' x2='15' y2='21' />
    </>,
  ],
  details: [
    <>
      <line x1='8' y1='6' x2='21' y2='6'></line>{' '}
      <line x1='8' y1='12' x2='21' y2='12'></line>{' '}
      <line x1='8' y1='18' x2='21' y2='18'></line>{' '}
      <polyline points='3 4 5 6 3 8'></polyline>{' '}
      <polyline points='3 10 5 12 3 14'></polyline>{' '}
      <polyline points='3 16 5 18 3 20'></polyline>
    </>,
  ],
  link: [
    <>
      <path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'></path>{' '}
      <path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'></path>
    </>,
  ],
  unlink: [
    <>
      <path d='M18.84 12.25l1.72-1.71a5.002 5.002 0 0 0-7.07-7.07l-1.72 1.71'></path>{' '}
      <path d='M5.17 11.75l-1.71 1.71a5.004 5.004 0 0 0 7.07 7.07l1.71-1.71'></path>{' '}
      <line x1='8' y1='2' x2='8' y2='5'></line>{' '}
      <line x1='2' y1='8' x2='5' y2='8'></line>{' '}
      <line x1='16' y1='19' x2='16' y2='22'></line>{' '}
      <line x1='19' y1='16' x2='22' y2='16'></line>
    </>,
  ],
  video: [
    <>
      <polygon points='23 7 16 12 23 17 23 7'></polygon>{' '}
      <rect x='1' y='5' width='15' height='14' rx='2' ry='2'></rect>
    </>,
  ],
  audio: [
    <>
      <path d='M9 18V5l12-2v13'></path> <circle cx='6' cy='18' r='3'></circle>{' '}
      <circle cx='18' cy='16' r='3'></circle>
    </>,
  ],
  youtube: [
    <>
      <path d='M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z'></path>{' '}
      <polygon points='9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02'></polygon>
    </>,
  ],
  emoji: [
    <>
      <circle cx='12' cy='12' r='10'></circle>{' '}
      <path d='M8 14s1.5 2 4 2 4-2 4-2'></path>{' '}
      <line x1='9' y1='9' x2='9.01' y2='9'></line>{' '}
      <line x1='15' y1='9' x2='15.01' y2='9'></line>
    </>,
  ],
  fullscreen: [
    <>
      <path d='M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3'></path>
    </>,
  ],
  minimize: [
    <>
      <path d='M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3'></path>
    </>,
  ],
  textColor: [
    <>
      <path d='M4 20h16' /> <path d='M12 4l-8 12' /> <path d='M12 4l8 12' />{' '}
      <path d='M7 13h10' />
    </>,
  ],
  highlight: [
    <>
      <path d='M9 11l-6 6v3h9l3-3' />{' '}
      <path d='M22 12l-4.6 4.6a2 2 0 01-2.8 0l-5.2-5.2a2 2 0 010-2.8L14 4' />
    </>,
  ],
  comment: [
    <>
      <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'></path>
    </>,
  ],
  inlineMath: [
    <>
      <text
        x='4'
        y='18'
        fill='currentColor'
        stroke='none'
        fontSize='18'
        fontFamily='serif'
        fontStyle='italic'
      >
        {' '}
        Σ{' '}
      </text>
    </>,
  ],
  blockMath: [
    <>
      <rect x='2' y='2' width='20' height='20' rx='2' ry='2' />{' '}
      <text
        x='6'
        y='18'
        fill='currentColor'
        stroke='none'
        fontSize='16'
        fontFamily='serif'
        fontStyle='italic'
      >
        {' '}
        Σ{' '}
      </text>
    </>,
  ],
  dragHandle: [
    <>
      <line x1='9' y1='12' x2='15' y2='12'></line>{' '}
      <line x1='9' y1='6' x2='15' y2='6'></line>{' '}
      <line x1='9' y1='18' x2='15' y2='18'></line>
    </>,
  ],
  template: [
    <>
      <rect x='3' y='3' width='18' height='18' rx='2' ry='2'></rect>{' '}
      <line x1='3' y1='9' x2='21' y2='9'></line>{' '}
      <line x1='9' y1='21' x2='9' y2='9'></line>
    </>,
  ],
};
