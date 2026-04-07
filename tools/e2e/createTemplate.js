/**
 * Generate the E2E test cases Excel template.
 *
 * Usage: node tools/e2e/createTemplate.js
 * Output: tools/e2e/test-cases-template.xlsx
 */

/* eslint-disable no-console */

const path = require('path');

const XLSX = require('xlsx');

const OUTPUT = path.join(__dirname, 'test-cases-template.xlsx');

// ── Headers ───────────────────────────────────────────────────────

const HEADERS = [
  'Test ID',
  'Module',
  'Type',
  'Category',
  'Title',
  'Description',
  'Prerequisites',
  'Steps',
  'Expected Results',
  'Priority',
  'Status',
];

// ── Sample Data ───────────────────────────────────────────────────

const SAMPLES = [
  {
    testId: 'TC-QA-001',
    module: 'quick-access-plugin',
    type: 'ui',
    category: 'login',
    title: 'Quick Access Buttons Visible on Login Page',
    description:
      'Verify that the quick access demo login buttons are rendered by the extension slot on the login page.',
    prerequisites: 'email=admin@example.com; password=admin123',
    steps: [
      'Navigate to the login page',
      'Wait for the page to fully load',
      'Verify the quick access login buttons are visible below the login form',
      'Verify there are demo account buttons rendered by the extension slot',
    ],
    expected: [
      'Login page loads with the standard login form',
      'Quick access buttons section is visible below the form',
      'At least one demo account button is displayed',
      'Buttons show user names (e.g., Admin User)',
      'Extension slot renders without errors',
    ],
    priority: 'High',
    status: 'Automated',
  },
  {
    testId: 'TC-QA-002',
    module: 'quick-access-plugin',
    type: 'ui',
    category: 'login',
    title: 'Quick Login via Demo Account Button',
    description:
      'Verify that clicking a quick access demo account button logs the user in.',
    prerequisites: 'email=admin@example.com; password=admin123',
    steps: [
      'Navigate to the login page',
      'Click the Admin User quick access demo account button',
      'Wait for the page to redirect after login',
      'Verify the user is logged in and sees the dashboard',
    ],
    expected: [
      'Clicking the button initiates login',
      'Page redirects to dashboard or home',
      'User profile shows Admin User',
      'No error messages displayed',
    ],
    priority: 'High',
    status: 'Automated',
  },
  {
    testId: 'TC-API-001',
    module: 'quick-access-plugin',
    type: 'api',
    category: 'auth',
    title: 'Login API Returns Valid JWT',
    description:
      'Verify the authentication endpoint returns a valid JWT token for valid credentials.',
    prerequisites: 'email=admin@example.com; password=admin123',
    steps: [
      'Send POST request to /api/auth/login with email and password from prerequisites',
      'Assert response status is 200',
      'Assert response body contains "accessToken" field',
      'Use the token to send GET request to /api/auth/profile',
      'Assert response status is 200',
      'Assert response body field "user.email" equals "admin@example.com"',
    ],
    expected: [
      'Login returns HTTP 200 with a JWT token',
      'Profile endpoint accepts the token and returns user data',
      'Email in profile matches the login credential',
    ],
    priority: 'High',
    status: 'Automated',
  },
  {
    testId: 'TC-API-002',
    module: 'quick-access-plugin',
    type: 'api',
    category: 'auth',
    title: 'Login API Rejects Invalid Credentials',
    description:
      'Verify the authentication endpoint rejects requests with wrong password.',
    prerequisites: 'email=admin@example.com; password=wrongpassword',
    steps: [
      'Send POST request to /api/auth/login with email and wrong password',
      'Assert response status is 401',
      'Assert response body contains error message',
    ],
    expected: [
      'Login returns HTTP 401 Unauthorized',
      'Response body contains an error description',
      'No token is returned',
    ],
    priority: 'High',
    status: 'Ready',
  },
  {
    testId: 'TC-SYS-001',
    module: 'quick-access-plugin',
    type: 'system',
    category: 'user-flow',
    title: 'Full Login and Profile Update Flow',
    description:
      'End-to-end system test: login via API, navigate to profile page, update name.',
    prerequisites: 'email=admin@example.com; password=admin123',
    steps: [
      'Send POST request to /api/auth/login to get JWT token',
      'Navigate to the profile page in the browser',
      'Verify the profile page shows the current user name',
      'Update the display name field to "Test Admin"',
      'Click the Save button',
      'Send GET request to /api/auth/profile to verify the change',
      'Assert response body field "user.display_name" equals "Test Admin"',
    ],
    expected: [
      'Login API returns valid token',
      'Profile page loads with user data',
      'Name update saves successfully',
      'API confirms the updated name',
    ],
    priority: 'Medium',
    status: 'Draft',
  },
];

// ── Build worksheet ───────────────────────────────────────────────

function buildRow(sample) {
  const row = [
    sample.testId,
    sample.module,
    sample.type,
    sample.category,
    sample.title,
    sample.description,
    sample.prerequisites,
  ];

  // Steps (multi-line string)
  row.push(sample.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'));

  // Expected results (multi-line string)
  row.push(sample.expected.map(e => `- ${e}`).join('\n'));

  row.push(sample.priority || '');
  row.push(sample.status || '');

  return row;
}

function main() {
  const data = [HEADERS, ...SAMPLES.map(buildRow)];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Test ID
    { wch: 25 }, // Module
    { wch: 8 }, // Type
    { wch: 15 }, // Category
    { wch: 40 }, // Title
    { wch: 50 }, // Description
    { wch: 50 }, // Prerequisites
    { wch: 80 }, // Steps
    { wch: 80 }, // Expected Results
    { wch: 10 }, // Priority
    { wch: 12 }, // Status
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'E2E Test Cases');

  // Add Instructions sheet
  const instructions = [
    ['E2E Test Cases — Excel Template'],
    [''],
    ['Column Reference:'],
    ['Column', 'Header', 'Required', 'Description'],
    ['A', 'Test ID', 'Yes', 'Unique identifier (e.g., TC-QA-001, TC-API-002)'],
    [
      'B',
      'Module',
      'Yes',
      'Module or extension name (e.g., quick-access-plugin, extensions)',
    ],
    ['C', 'Type', 'No', 'Test type: ui (default), api, or system'],
    ['D', 'Category', 'Yes', 'Test category (e.g., login, auth, install)'],
    ['E', 'Title', 'Yes', 'Test case title (becomes the H1 heading)'],
    ['F', 'Description', 'No', 'Paragraph describing what is tested'],
    [
      'G',
      'Prerequisites',
      'No',
      'Semicolon-separated key=value pairs (e.g., email=admin@example.com; password=admin123)',
    ],
    [
      'H',
      'Steps',
      'Yes',
      'Test steps in natural English, separated by newlines within the cell. You can use Alt+Enter (or Cmd+Option+Enter on Mac) to add a new line in Excel.',
    ],
    [
      'I',
      'Expected Results',
      'No',
      'Acceptance criteria, separated by newlines within the cell.',
    ],
    ['J', 'Priority', 'No', 'High, Medium, or Low (metadata only)'],
    ['K', 'Status', 'No', 'Draft, Ready, or Automated (metadata only)'],
    [''],
    ['Test Types:'],
    [
      'ui',
      '',
      '',
      'Browser tests via Puppeteer — navigate, click, type, assert_visible',
    ],
    [
      'api',
      '',
      '',
      'HTTP requests only — api_request, assert_status, assert_body (no browser, 25x faster)',
    ],
    ['system', '', '', 'Mixed browser + HTTP — uses both action types'],
    [''],
    ['Usage:'],
    ['', '', '', 'node tools/e2e/excelToMd.js test-cases.xlsx --dry-run'],
    ['', '', '', 'node tools/e2e/excelToMd.js test-cases.xlsx'],
    ['', '', '', 'node tools/e2e/excelToMd.js test-cases.xlsx --force'],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  wsInstructions['!cols'] = [
    { wch: 10 },
    { wch: 20 },
    { wch: 10 },
    { wch: 80 },
  ];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  XLSX.writeFile(wb, OUTPUT);
  console.log(`✅ Template created: ${OUTPUT}`);
  console.log(`   ${SAMPLES.length} sample test cases included`);
  console.log('');
  console.log('Sheets:');
  console.log('  1. E2E Test Cases — fill this with your test cases');
  console.log('  2. Instructions   — column reference and usage');
}

main();
