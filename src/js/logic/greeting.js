export const GREETING_NAME = "Josiel";

/** Saudação da Página Inicial conforme a hora local: 05h-11h59 dia, 12h-17h59 tarde, resto noite. */
export function getGreeting(date = new Date(), name = GREETING_NAME) {
  const hour = date.getHours();
  const salutation =
    hour >= 5 && hour < 12
      ? "Bom dia"
      : hour >= 12 && hour < 18
        ? "Boa tarde"
        : "Boa noite";
  return `${salutation}, ${name}`;
}
