# Redux Review Checklist

Quick-reference for reviewing Redux slice, thunk, and selector changes.

## Slice

- [ ] `SLICE_NAME` constant exported and used consistently
- [ ] Initial state uses `normalizeState()` pattern:
  ```
  data: { items: [], pagination: null, initialized: { list: false } }
  operations: { list: { loading: false, error: null }, create: { ... } }
  ```
- [ ] Synchronous actions clear errors (`clearXxxError`)
- [ ] Reset action restores full initial state
- [ ] Extra reducers handle `.pending`, `.fulfilled`, `.rejected` for each thunk
- [ ] `pending` → sets `loading: true`, clears `error`
- [ ] `fulfilled` → sets `loading: false`, updates data
- [ ] `rejected` → sets `loading: false`, sets `error` from `action.payload`

## Thunks

- [ ] Created with `createAsyncThunk(SLICE_NAME + '/actionName', ...)`
- [ ] Uses `extra.fetch` from thunk API (not global fetch)
- [ ] Error handling uses `rejectWithValue(error.message)`
- [ ] API path matches backend route
- [ ] HTTP method correct (GET/POST/PUT/DELETE)

```javascript
// Correct pattern:
export const fetchItems = createAsyncThunk(
  SLICE_NAME + '/fetchItems',
  async (params, { extra, rejectWithValue }) => {
    try {
      const { data } = await extra.fetch('/api/items', { query: params });
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);
```

## Selectors

- [ ] Null-safe: handle `state[SLICE_NAME]` being `null`/`undefined`
- [ ] Return sensible defaults (empty array, `false`, `null`)
- [ ] Use `createSelector` from RTK for computed/derived data
- [ ] Named exports match pattern: `getXxx`, `isXxxLoading`, `getXxxError`

```javascript
// Correct pattern:
export const getItems = (state) => {
  const slice = state[SLICE_NAME];
  return slice && slice.data ? slice.data.items : [];
};
```

## Route Integration (`_route.js`)

- [ ] `init()` injects reducer: `store.injectReducer(SLICE_NAME, reducer)`
- [ ] `setup()` registers sidebar menu item
- [ ] `teardown()` unregisters sidebar menu item
- [ ] `mount()` dispatches breadcrumbs
- [ ] `unmount()` cleans up (cancels pending thunks if needed)
- [ ] Redux injection in `_route.js` `init()`, NOT in `views/index.js`

## Testing

- [ ] Initial state tested with `reducer(undefined, { type: '@@INIT' })`
- [ ] Synchronous actions tested with mock state
- [ ] Thunk `.pending`, `.fulfilled`, `.rejected` tested via action creators
- [ ] Selectors tested with `createState()` helper
- [ ] Store integration tested with real `configureStore` + `injectReducer`
