import { Text } from "ink";

export function EditableText(props: { value: string; cursor: number }) {
  const before = props.value.slice(0, props.cursor);
  const current = props.value.slice(props.cursor, props.cursor + 1) || " ";
  const after = props.value.slice(props.cursor + 1);
  return (
    <>
      <Text>{before}</Text>
      <Text inverse>{current}</Text>
      <Text>{after}</Text>
    </>
  );
}
