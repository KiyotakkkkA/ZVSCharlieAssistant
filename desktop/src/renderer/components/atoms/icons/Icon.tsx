import type { PropsWithChildren, SVGProps } from "react";

export type IconProps = PropsWithChildren<
  SVGProps<SVGSVGElement> & {
    size?: number | string;
    title?: string;
  }
>;

export function Icon({
  children,
  className,
  size = 20,
  title,
  ...props
}: IconProps) {
  const labelled = Boolean(title);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`block shrink-0 ${className ?? ""}`}
      aria-hidden={labelled ? undefined : true}
      role={labelled ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** Wrapper for icon sets such as Material Design Icons whose paths are fills. */
export function FilledIcon({
  children,
  className,
  size = 20,
  title,
  ...props
}: IconProps) {
  const labelled = Boolean(title);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      stroke="none"
      className={`block shrink-0 ${className ?? ""}`}
      aria-hidden={labelled ? undefined : true}
      role={labelled ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}
