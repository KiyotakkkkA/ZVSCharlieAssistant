import { Fragment } from "react";
import { Text } from "ink";
import { tuiColors } from "../theme";

export function InlineMarkup({ children }: { children: string }) {
  const tokens = children.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <Text>
      {tokens.map((token, index) => {
        if (token.startsWith("**") && token.endsWith("**"))
          return (
            <Text key={index} bold>
              {token.slice(2, -2)}
            </Text>
          );
        if (token.startsWith("`") && token.endsWith("`"))
          return (
            <Text key={index} color={tuiColors.cyan}>
              {token.slice(1, -1)}
            </Text>
          );
        return <Fragment key={index}>{token}</Fragment>;
      })}
    </Text>
  );
}
