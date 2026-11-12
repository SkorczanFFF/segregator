type FormLike = {
  getValues: () => object
  validateField: (path: string) => unknown
  getInputNode: (path: string) => HTMLElement | null
}

// Validation failure handler for form.onSubmit: moves focus to the first field with an error.
export const focusFirstError = (form: FormLike) => (errors: Record<string, unknown>) =>
  form.getInputNode(Object.keys(errors)[0] ?? '')?.focus()

// For useForm's enhanceGetInputProps: checks a field when it loses focus, but only once something is typed,
// so leaving an empty field shows no error. Sending the form still checks every field.
// With field names, only those fields are checked this way.
export const validateFilledOnBlur =
  (...fields: string[]) =>
  ({ field, form }: { field: string; form: FormLike }) =>
    fields.length > 0 && !fields.includes(field)
      ? {}
      : {
          onBlur: () => {
            const value = (form.getValues() as Record<string, unknown>)[field]
            if (String(value ?? '').trim() !== '') form.validateField(field)
          },
        }
