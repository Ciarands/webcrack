import { Binding, NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import * as m from '@codemod/matchers';

export function infiniteLoop(
  body?: m.Matcher<t.Statement>
): m.Matcher<t.ForStatement | t.WhileStatement> {
  return m.or(
    m.forStatement(undefined, null, undefined, body),
    m.forStatement(undefined, truthyMatcher, undefined, body),
    m.whileStatement(truthyMatcher, body)
  );
}

export function constKey(
  name?: string | m.Matcher<string>
): m.Matcher<t.Identifier | t.StringLiteral> {
  return m.or(m.identifier(name), m.stringLiteral(name));
}

export function constObjectProperty(
  value?: m.Matcher<t.Expression>
): m.Matcher<t.ObjectProperty> {
  return m.or(
    m.objectProperty(m.identifier(), value, false),
    m.objectProperty(m.or(m.stringLiteral(), m.numericLiteral()), value)
  );
}

export function matchIife(
  body?: m.Matcher<t.Statement[]> | m.Matcher<t.Statement>[]
): m.Matcher<t.CallExpression> {
  return m.callExpression(
    m.functionExpression(null, [], body ? m.blockStatement(body) : undefined),
    []
  );
}

export const iife = matchIife();
export const emptyIife = matchIife([]);

/**
 * Matches both identifier properties and string literal computed properties
 */
export function constMemberExpression(
  object: string | m.Matcher<t.Expression>,
  property?: string | m.Matcher<string>
): m.Matcher<t.MemberExpression> {
  if (typeof object === 'string') object = m.identifier(object);
  return m.or(
    m.memberExpression(object, m.identifier(property), false),
    m.memberExpression(object, m.stringLiteral(property), true)
  );
}

export const trueMatcher = m.or(
  m.booleanLiteral(true),
  m.unaryExpression('!', m.numericLiteral(0)),
  m.unaryExpression('!', m.unaryExpression('!', m.numericLiteral(1))),
  m.unaryExpression('!', m.unaryExpression('!', m.arrayExpression([])))
);

export const falseMatcher = m.or(
  m.booleanLiteral(false),
  m.unaryExpression('!', m.arrayExpression([]))
);

export const truthyMatcher = m.or(trueMatcher, m.arrayExpression([]));

/**
 * Starting at the parent path of the current `NodePath` and going up the
 * tree, return the first `NodePath` that causes the provided `matcher`
 * to return true, or `null` if the `matcher` never returns true.
 */
export function findParent<T extends t.Node>(
  path: NodePath,
  matcher: m.Matcher<T>
): NodePath<T> | null {
  return path.findParent(path =>
    matcher.match(path.node)
  ) as NodePath<T> | null;
}

/**
 * Starting at current `NodePath` and going up the tree, return the first
 * `NodePath` that causes the provided `matcher` to return true,
 * or `null` if the `matcher` never returns true.
 */
export function findPath<T extends t.Node>(
  path: NodePath,
  matcher: m.Matcher<T>
): NodePath<T> | null {
  return path.find(path => matcher.match(path.node)) as NodePath<T> | null;
}

/**
 * Function expression matcher that captures the parameters
 * and allows them to be referenced in the body.
 */
export function createFunctionMatcher(
  params: number,
  body: (
    ...captures: m.Matcher<t.Identifier>[]
  ) => m.Matcher<t.Statement[]> | m.Matcher<t.Statement>[]
): m.Matcher<t.FunctionExpression> {
  const captures = Array.from({ length: params }, () =>
    m.capture(m.anyString())
  );

  return m.functionExpression(
    undefined,
    captures.map(m.identifier),
    m.blockStatement(body(...captures.map(c => m.identifier(m.fromCapture(c)))))
  );
}

/**
 * Returns true if every reference is a member expression whose value is read
 */
export function isReadonlyObject(
  binding: Binding,
  memberAccess: m.Matcher<t.MemberExpression>
): boolean {
  // Workaround because sometimes babel treats the VariableDeclarator/binding itself as a violation
  if (!binding.constant && binding.constantViolations[0] !== binding.path)
    return false;

  return binding.referencePaths.every(
    path =>
      // obj.property
      memberAccess.match(path.parent) &&
      // obj.property = 1
      !path.parentPath?.parentPath?.isAssignmentExpression({
        left: path.parent,
      }) &&
      // obj.property++
      !path.parentPath?.parentPath?.isUpdateExpression({
        argument: path.parent,
      }) &&
      // delete obj.property
      !path.parentPath?.parentPath?.isUnaryExpression({
        argument: path.parent,
        operator: 'delete',
      }) &&
      // [obj.property] = [{}] or ({ property: obj.property } = {})
      !path.findParent(
        parentPath =>
          parentPath.isArrayPattern() || parentPath.isObjectPattern()
      )
  );
}
