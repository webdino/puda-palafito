import { describe, expect, it } from 'vitest';

import { sum } from './example';

describe('sum', () => {
  it('adds two values', () => {
    expect(sum(2, 3)).toBe(5);
  });
});
