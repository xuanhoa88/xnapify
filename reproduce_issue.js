import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function run() {
  try {
    // 1. Login
    console.log('Logging in...');
    const loginRes = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123',
      }),
    });

    if (!loginRes.ok) {
      console.error('Login failed:', await loginRes.text());
      return;
    }

    const loginData = await loginRes.json();
    console.log('Login successful');

    // Extract cookies from response and parse them correctly
    const cookies = loginRes.headers.raw()['set-cookie'];

    // Parse cookies to extract only name=value pairs (not attributes)
    const cookiePairs = cookies.map(cookie => {
      // Split by semicolon and take only the first part (name=value)
      return cookie.split(';')[0];
    });

    const cookieHeader = cookiePairs.join('; ');

    console.log('Cookie header:', cookieHeader);

    // 2. Fetch Groups with cookies (NEW ENDPOINT: /admin/groups)
    console.log('Fetching groups...');
    const groupsRes = await fetch(`${BASE_URL}/api/admin/groups`, {
      headers: {
        Cookie: cookieHeader,
      },
    });

    if (!groupsRes.ok) {
      console.error(
        'Fetch groups failed:',
        groupsRes.status,
        groupsRes.statusText,
      );
      console.error(await groupsRes.text());
    } else {
      const groupsData = await groupsRes.json();
      console.log('✅ Fetch groups successful!');
      console.log(JSON.stringify(groupsData, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

run();
