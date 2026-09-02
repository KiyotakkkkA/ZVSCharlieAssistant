import {
  Select,
  type SelectMenuProps,
  type SelectOptionProps,
  type SelectProps,
  type SelectTriggerProps,
} from "@kiyotakkkka/zvs-uikit-lib";

export interface BasicSelectProps extends Omit<SelectProps, "children"> {
  triggerClassName?: SelectTriggerProps["className"];
  triggerRounded?: SelectTriggerProps["rounded"];
  menuClassName?: SelectMenuProps["className"];
  menuLabel?: SelectMenuProps["label"];
  menuRounded?: SelectMenuProps["rounded"];
  optionClassName?: SelectOptionProps["className"];
  optionRounded?: SelectOptionProps["rounded"];
}

export function BasicSelect({
  options,
  triggerClassName = "w-full",
  triggerRounded,
  menuClassName,
  menuLabel,
  menuRounded,
  optionClassName,
  optionRounded,
  ...props
}: BasicSelectProps) {
  return (
    <Select options={options} {...props}>
      <Select.Trigger
        className={triggerClassName}
        rounded={triggerRounded}
      />
      <Select.Menu
        className={menuClassName}
        label={menuLabel}
        rounded={menuRounded}
      >
        {options.map((option) => (
          <Select.Option
            key={option.value}
            {...option}
            className={optionClassName}
            rounded={optionRounded}
          />
        ))}
      </Select.Menu>
    </Select>
  );
}
