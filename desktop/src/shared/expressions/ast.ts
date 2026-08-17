export type Node =
  | { kind: "literal"; value: string | number | boolean | null | undefined }
  | { kind: "variable"; name: string; start: number }
  | { kind: "identifier"; name: string; start: number }
  | { kind: "array"; elements: Node[] }
  | {
      kind: "object";
      entries: Array<{ key: Node; computed: boolean; value: Node }>;
    }
  | {
      kind: "member";
      object: Node;
      property: Node;
      computed: boolean;
      optional: boolean;
      start: number;
    }
  | {
      kind: "call";
      callee: Node;
      args: Node[];
      optional: boolean;
      start: number;
    }
  | { kind: "unary"; operator: "!" | "-" | "+"; argument: Node }
  | { kind: "binary"; operator: BinaryOperator; left: Node; right: Node }
  | { kind: "logical"; operator: "&&" | "||" | "??"; left: Node; right: Node }
  | { kind: "conditional"; test: Node; consequent: Node; alternate: Node }
  | { kind: "arrow"; params: string[]; body: Node };

export type BinaryOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "=="
  | "!="
  | "==="
  | "!=="
  | "<"
  | ">"
  | "<="
  | ">=";
