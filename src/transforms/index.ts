import { TraverseOptions } from '@babel/traverse';
import blockStatement from './blockStatement';
import computedProperties from './computedProperties';
import literals from './literals';
import sequence from './sequence';
import splitVariableDeclarations from './splitVariableDeclarations';

export const transforms: Transform[] = [
  literals,
  blockStatement,
  computedProperties,
  sequence,
  splitVariableDeclarations,
];

export interface Transform {
  name: string;
  tags: Tag[];
  visitor: TraverseOptions<{ changes: number }>;
}

export type Tag = 'safe' | 'unsafe' | 'preprocess';