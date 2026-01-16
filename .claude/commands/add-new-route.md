Add a new page/route to the application.

## Structure

```
src/pages/{page-name}/
├── index.js          # Route definition + action
├── {PageName}.js     # Page component
├── {PageName}.css    # CSS Modules styles
└── {PageName}.test.js # Tests (optional)
```

## 1. Create Page Component

```javascript
// src/pages/my-page/MyPage.js
import s from './MyPage.css';

function MyPage() {
  return (
    <div className={s.container}>
      <h1 className={s.title}>My Page</h1>
      <p>Page content here</p>
    </div>
  );
}

export default MyPage;
```

## 2. Create Styles

```css
/* src/pages/my-page/MyPage.css */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.title {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 1rem;
}
```

## 3. Create Route Definition

```javascript
// src/pages/my-page/index.js
import Layout from '@/components/Layout';
import MyPage from './MyPage';

/**
 * Route configuration
 */
const route = {
  path: '/my-page',
};

/**
 * Route action
 */
function action(context) {
  const title = context.i18n.t('myPage.title', 'My Page');

  return {
    title,
    component: (
      <Layout>
        <MyPage />
      </Layout>
    ),
  };
}

export default [route, action];
```

## 4. Add Navigation Link

```javascript
import { Link } from '@/components/History/Link';

<Link to='/my-page'>My Page</Link>;
```

## Dynamic Routes

```javascript
// src/pages/users/:id/index.js
import Layout from '@/components/Layout';
import UserProfile from './UserProfile';

const route = {
  path: '/users/:id',
};

function action(context) {
  const userId = context.params.id;

  return {
    title: `User ${userId}`,
    component: (
      <Layout>
        <UserProfile userId={userId} />
      </Layout>
    ),
  };
}

export default [route, action];
```

## Protected Routes

```javascript
// src/pages/dashboard/index.js
import Layout from '@/components/Layout';
import Dashboard from './Dashboard';
import { isAuthenticated } from '@/shared/renderer/redux/features/user/selector';

const route = { path: '/dashboard' };

function action(context) {
  const state = context.store.getState();

  // Redirect if not authenticated
  if (!isAuthenticated(state)) {
    return { redirect: '/login' };
  }

  return {
    title: 'Dashboard',
    component: (
      <Layout>
        <Dashboard />
      </Layout>
    ),
  };
}

export default [route, action];
```

## Routes with Form Validation

```javascript
// src/pages/contact/index.js
import Layout from '@/components/Layout';
import ContactForm from './ContactForm';

const route = { path: '/contact' };

function action(context) {
  return {
    title: 'Contact Us',
    description: 'Get in touch with us',
    component: (
      <Layout>
        <ContactForm />
      </Layout>
    ),
  };
}

export default [route, action];
```

```javascript
// src/pages/contact/ContactForm.js
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

function ContactForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async data => {
    // Handle form submission
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <input {...register('name')} placeholder='Name' />
        {errors.name && <span>{errors.name.message}</span>}
      </div>

      <div>
        <input {...register('email')} placeholder='Email' />
        {errors.email && <span>{errors.email.message}</span>}
      </div>

      <div>
        <textarea {...register('message')} placeholder='Message' />
        {errors.message && <span>{errors.message.message}</span>}
      </div>

      <button type='submit'>Send</button>
    </form>
  );
}

export default ContactForm;
```

## Parent Routes with Children

```javascript
// src/pages/admin/index.js
import Layout from '@/components/Layout';
import { isAuthenticated } from '@/shared/renderer/redux/features/user/selector';

const pagesContext = require.context('./', true, /^\.\/[^/]+\/index\.js$/);

const route = async buildPages => {
  const children = await buildPages(pagesContext);
  return {
    path: '/admin',
    autoDelegate: false,
    children,
  };
};

async function action(context) {
  // Auth check
  if (!isAuthenticated(context.store.getState())) {
    return { redirect: '/login' };
  }

  // Delegate to children
  const childResult = await context.next();

  return {
    title: childResult?.title || 'Admin',
    component: <Layout>{childResult?.component}</Layout>,
  };
}

export default [route, action];
```
