export const ROLES = ["owner", "admin", "operator", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Propietario",
  admin: "Administrador",
  operator: "Operador",
  viewer: "Lector",
};

const RANK: Record<Role, number> = { owner: 40, admin: 30, operator: 20, viewer: 10 };

export function hasMinRole(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

/** Matriz de permisos de la aplicación. RLS en la base de datos replica estas reglas. */
export const PERMISSIONS = {
  "models.read": "viewer",
  "models.create": "admin",
  "models.update": "operator",
  "models.change_status": "admin",
  "models.delete": "owner",
  "approvals.decide": "admin",
  "finance.write": "admin",
  "system.emergency_stop": "admin",
  "system.pause": "admin",
  "security.view_events": "admin",
  "users.manage": "owner",
  "demo.load": "owner",
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return hasMinRole(role, PERMISSIONS[permission]);
}
