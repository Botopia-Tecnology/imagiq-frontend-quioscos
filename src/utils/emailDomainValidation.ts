const ALLOWED_DOMAINS = ["lumintik.com", "imagiq.com", "imagiq.co"];

export function isAllowedEmailDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && ALLOWED_DOMAINS.includes(domain);
}

export const DOMAIN_ERROR_MESSAGE =
  "Solo se permiten correos con dominio @lumintik.com, @imagiq.com o @imagiq.co";
