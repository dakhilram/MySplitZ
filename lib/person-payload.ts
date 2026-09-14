export type PersonSaveInput = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  archived?: boolean;
};

export function createPersonSavePayload(input: PersonSaveInput) {
  return {
    id: input.id,
    name: input.name.trim(),
    ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
    ...(input.email?.trim() ? { email: input.email.trim() } : {}),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    ...(input.archived ? { archived: true } : {}),
  };
}
