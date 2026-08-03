import { Modal } from "@kiyotakkkka/zvs-uikit-lib";
import type { ComponentType, ReactNode } from "react";

interface FormModalFormProps<TModel> {
  model?: TModel;
  onConfirm: () => void;
  onCancel: () => void;
}

interface FormModalDefinition<TModel, TFormProps extends object> {
  component: ComponentType<FormModalFormProps<TModel> & TFormProps>;
  title: ReactNode;
  props: TFormProps;
  className?: string;
}

interface FormModalProps<TModel, TFormProps extends object> {
  open: boolean;
  form: FormModalDefinition<TModel, TFormProps>;
  model?: TModel;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FormModal<TModel, TFormProps extends object>({
  open,
  form,
  model,
  onConfirm,
  onCancel,
}: FormModalProps<TModel, TFormProps>) {
  const Form = form.component;

  return (
    <Modal
      open={open}
      rounded="rounded-4xl"
      onClose={onCancel}
      className={form.className ?? "max-w-xl"}
    >
      <Modal.Header>
        <h2 className="text-lg font-semibold text-main-50">{form.title}</h2>
      </Modal.Header>
      <Modal.Content>
        <Form
          {...form.props}
          model={model}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </Modal.Content>
    </Modal>
  );
}
