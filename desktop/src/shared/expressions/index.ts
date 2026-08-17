export type { Node as ExpressionNode } from "./ast";
export { parseExpression, ExpressionSyntaxError } from "./parser";
export { tokenize, type Token } from "./tokenizer";
export {
  evaluateExpression,
  ExpressionRuntimeError,
  type ExpressionScope,
} from "./evaluate";
export {
  GLOBAL_FUNCTIONS,
  STRING_METHODS,
  ARRAY_METHODS,
  OBJECT_METHODS,
  NUMBER_METHODS,
  getPath,
  isEmpty,
  toNumber,
  toText,
} from "./functions";
export {
  parseTemplate,
  hasExpression,
  resolveTemplate,
  resolveDeep,
  collectExpressions,
  validateExpressions,
  ExpressionEvaluationError,
  type TemplateSegment,
  type ResolveOptions,
  type ExpressionErrorMode,
} from "./template";
export { EXPRESSION_COMPLETIONS, type CompletionEntry } from "./completions";
