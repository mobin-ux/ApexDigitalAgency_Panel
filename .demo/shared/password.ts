/**
 * The one password minimum for every customer-facing password field: sign-up,
 * reset, staff invite acceptance and Settings (Panel v2 asks for 12; V2 Phase 8
 * set one shared figure so the four could not disagree). The APIs still accept
 * shorter passwords so existing accounts keep signing in; a stricter client is
 * always compatible.
 */
export const PASSWORD_MIN = 12
