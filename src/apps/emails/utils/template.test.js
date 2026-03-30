import { extractVariables, createPlaceholderData } from './template';

describe('extractVariables', () => {
  test('extracts simple variables', () => {
    expect(extractVariables('Hello {{ name }}')).toEqual(['name']);
  });

  test('extracts multiple unique variables, sorted', () => {
    expect(
      extractVariables('{{ appName }} — {{ displayName }} ({{ appName }})'),
    ).toEqual(['appName', 'displayName']);
  });

  test('extracts dotted paths', () => {
    expect(extractVariables('{{ user.profile }}')).toEqual(['user.profile']);
  });

  test('extracts variable before filter pipe', () => {
    expect(extractVariables('{{ name | upcase }}')).toEqual(['name']);
  });

  test('skips string literals', () => {
    expect(extractVariables('{{ "now" | date: "%Y" }}')).toEqual([]);
  });

  test('skips single-quoted string literals', () => {
    expect(extractVariables("{{ 'hello' | upcase }}")).toEqual([]);
  });

  test('skips numeric literals', () => {
    expect(extractVariables('{{ 42 | plus: 1 }}')).toEqual([]);
  });

  test('skips boolean literals', () => {
    expect(extractVariables('{{ true }}')).toEqual([]);
    expect(extractVariables('{{ false }}')).toEqual([]);
  });

  test('skips nil/null/empty/blank', () => {
    expect(extractVariables('{{ nil }}')).toEqual([]);
    expect(extractVariables('{{ null }}')).toEqual([]);
    expect(extractVariables('{{ empty }}')).toEqual([]);
    expect(extractVariables('{{ blank }}')).toEqual([]);
  });

  test('handles mixed content — variables and literals together', () => {
    const text = `
      {{ appName }} — {{ "now" | date: "%Y" }}
      Hi {{ displayName }}, welcome to {{ appName }}.
      {{ 42 | plus: 1 }}
    `;
    expect(extractVariables(text)).toEqual(['appName', 'displayName']);
  });

  test('ignores Liquid tags ({% %})', () => {
    expect(
      extractVariables(
        '{% unless is_active %}blocked{% endunless %} {{ status }}',
      ),
    ).toEqual(['status']);
  });

  test('returns empty array for null/empty input', () => {
    expect(extractVariables(null)).toEqual([]);
    expect(extractVariables('')).toEqual([]);
    expect(extractVariables(undefined)).toEqual([]);
  });

  test('handles real-world email template wrapper', () => {
    const wrapper = `
      <title>{{ subject }}</title>
      <h1>{{ appName }}</h1>
      <p>&copy; {{ "now" | date: "%Y" }} {{ appName }}.</p>
      <p>{{ displayName }}</p>
    `;
    expect(extractVariables(wrapper)).toEqual([
      'appName',
      'displayName',
      'subject',
    ]);
  });
});

describe('createPlaceholderData', () => {
  test('creates placeholder object', () => {
    expect(createPlaceholderData(['name', 'email'])).toEqual({
      name: '{{ name }}',
      email: '{{ email }}',
    });
  });

  test('handles empty array', () => {
    expect(createPlaceholderData([])).toEqual({});
  });

  test('handles null/undefined', () => {
    expect(createPlaceholderData(null)).toEqual({});
    expect(createPlaceholderData(undefined)).toEqual({});
  });
});
