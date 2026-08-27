import { useEffect, useState } from "react";
import { Text } from "ink";
import { tuiColors } from "../theme";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function Spinner({ color = tuiColors.accent }: { color?: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setFrame((value) => (value + 1) % FRAMES.length),
      80,
    );
    return () => clearInterval(id);
  }, []);
  return <Text color={color}>{FRAMES[frame]}</Text>;
}
