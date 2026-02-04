import { describe, it, expect } from 'vitest';
import { uuid } from './uuid';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('uuid', () => {
  it('retorna string no formato UUID v4', () => {
    const id = uuid();
    expect(id).toMatch(UUID_REGEX);
  });

  it('retorna valores únicos em chamadas sucessivas', () => {
    const a = uuid();
    const b = uuid();
    expect(a).not.toBe(b);
  });
});
