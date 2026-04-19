import { describe, expect, it } from 'vitest';
import { useMutation, useNode, useNodes, useTopology, useTopologyEvent } from '../src/index';

describe('react package exports', () => {
  it('exports hooks', () => {
    expect(useNode).toBeTypeOf('function');
    expect(useNodes).toBeTypeOf('function');
    expect(useTopology).toBeTypeOf('function');
    expect(useMutation).toBeTypeOf('function');
    expect(useTopologyEvent).toBeTypeOf('function');
  });
});
