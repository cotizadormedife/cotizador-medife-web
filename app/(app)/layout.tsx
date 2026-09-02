import Link from "next/link";
import { requireApprovedUser } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";

const LOGO_ORANGE = (
  <svg width="66" height="15" viewBox="0 0 82 19" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.5121 14.6095L21.1943 4.61038C21.0845 3.61599 21.0845 2.89782 21.4139 2.45587C21.6884 2.1244 22.1826 1.90343 22.9513 1.84818H23.0611V0.632812H17.5704L17.6253 0.798545C17.8998 2.01391 17.6802 3.22928 16.9115 5.05233C16.033 7.15161 14.5505 10.19 12.5738 14.1124C12.0796 12.6208 11.256 11.0187 10.4324 9.36137C9.00482 6.43343 7.46742 3.45026 7.30269 0.743301V0.632813H1.97667V1.84818H2.08648C2.80028 1.90343 3.23954 2.1244 3.56898 2.45587C3.95334 2.95306 4.06315 3.78172 3.84352 5.10758L2.41593 14.6095C2.14139 16.4326 1.53741 17.0955 0.164722 17.0955H0V18.3661H6.20454V17.1508H6.09473C5.21621 17.0955 4.61223 16.8746 4.28278 16.4326C3.84352 15.8802 3.73371 14.9963 3.95334 13.6152L5.21621 4.83136C5.93001 6.93063 7.08306 9.25088 8.18121 11.4606C9.49899 14.1124 10.707 16.5983 11.0364 18.2557V18.3661H12.464V18.2557C12.8483 16.5431 13.8367 14.4991 15.0446 12.1788C16.1428 10.0795 17.2959 7.70405 18.1744 5.21807L19.2725 14.5543C19.3823 15.4382 19.2176 16.0459 18.8333 16.4878C18.5038 16.8746 17.8998 17.0955 17.186 17.0955H17.2409V18.3661H25.2025V17.1508H25.0927C23.2259 16.8193 22.7317 15.9907 22.5121 14.6095Z" fill="#E35205" />
    <path d="M31.1406 6.33325C34.3577 6.33325 35.8591 9.34325 35.8594 11.3313V11.4456H27.9229C27.9229 13.0358 28.3522 14.3989 29.21 15.3645C29.9606 16.2164 30.9796 16.671 32.1055 16.6711C33.2315 16.6711 34.1968 16.2732 35.1084 15.4211L35.2158 15.2512L35.9131 15.9329L35.8594 16.0461C34.7869 17.9206 33.071 19.0002 31.1406 19.0002C28.0306 19.0002 25.8321 16.3872 25.832 12.8088C25.832 9.11677 28.0842 6.33327 31.1406 6.33325ZM30.6572 7.58228C29.3167 7.58228 28.3511 8.60512 28.083 10.1956H32.9629C32.7484 8.49159 31.9441 7.58235 30.6572 7.58228Z" fill="#E35205" />
    <path d="M49.8057 0V15.2783C49.8058 16.3258 50.298 16.4365 50.6807 16.4365C50.8994 16.4365 51.1182 16.3808 51.4463 16.2705H51.665V17.5947L48.2207 18.3662H47.4551V16.6016C46.1976 17.7598 44.7213 18.3662 43.3545 18.3662C40.5662 18.3662 38.4338 15.8849 38.4336 12.7412C38.4336 9.10097 41.2772 6.01172 44.7217 6.01172C45.487 6.01176 46.3071 6.12226 47.4004 6.45312V2.86816L45.541 1.82031V1.04785L49.041 0H49.8057ZM44.1748 7.33496C42.3159 7.33496 40.7843 9.15526 40.8389 11.3613C40.8389 13.2918 41.8239 16.3252 44.5576 16.3252C45.7056 16.3251 46.6897 15.8287 47.4004 14.9463V11.3613C47.4003 8.16292 45.3777 7.33514 44.1748 7.33496Z" fill="#E35205" />
    <path d="M57.0491 3.16667C57.9083 3.16667 58.5956 2.47576 58.5956 1.61212C58.5956 0.748485 57.9083 0 57.0491 0C56.1899 0 55.4453 0.690909 55.4453 1.61212C55.4453 2.47576 56.1327 3.16667 57.0491 3.16667Z" fill="#E35205" />
    <path d="M57.7055 15.2755V6.33325H56.9705L53.5576 7.60282V8.37561L55.3953 9.36918V15.441C55.3953 16.7106 54.5552 17.1522 53.7676 17.1522H53.6626V18.3666H59.2282V17.2074H59.1232C58.1781 17.1522 57.7055 16.4898 57.7055 15.2755Z" fill="#E35205" />
    <path d="M71.8271 2.06555C71.8271 0.893212 70.567 0 68.8685 0C65.8552 0 63.8828 2.06555 63.828 5.4151C63.828 6.30831 63.6637 6.41996 62.5679 6.41996H61.7461V7.92725H63.828V15.2404C63.828 16.5802 63.2802 17.1385 61.9105 17.1385H61.7461V18.3667H68.8685V17.1385H68.759C66.6222 17.1385 66.2387 16.6361 66.2387 15.0171V7.92725H69.2521V6.41996H66.2387V3.62867C66.2387 1.84225 67.2249 1.39564 67.8276 1.39564C68.3755 1.39564 68.759 1.84225 69.0877 2.28885C69.4712 2.79129 69.8547 3.29372 70.5122 3.29372C71.2792 3.29372 71.8271 2.79129 71.8271 2.06555Z" fill="#E35205" />
    <path d="M76.5049 6.33325C79.722 6.33325 81.2234 9.34325 81.2236 11.3313V11.4456H73.2871C73.2871 13.0358 73.7164 14.3989 74.5742 15.3645C75.3248 16.2164 76.3438 16.671 77.4697 16.6711C78.5958 16.6711 79.5611 16.2732 80.4727 15.4211L80.5801 15.3645L81.2773 15.9329L81.2236 16.0461C80.1512 17.9206 78.4353 19.0002 76.5049 19.0002C73.3949 19.0002 71.1964 16.3872 71.1963 12.8088C71.1963 9.11677 73.4484 6.33327 76.5049 6.33325ZM76.0752 7.58228C74.7346 7.58228 73.7691 8.60512 73.501 10.1956H78.3809C78.1664 8.4916 77.362 7.58236 76.0752 7.58228Z" fill="#E35205" />
    <path d="M81.2782 0H77.7021L74.9775 4.43333H76.1128L81.2782 0Z" fill="#E35205" />
  </svg>
);

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
      {children}
    </Link>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireApprovedUser();

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }}>
      <header
        className="print-hidden"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 32px",
          borderBottom: "1px solid var(--border-default)",
          background: "#fff",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <Link href="/quotes" aria-label="Volver a inicio" style={{ display: "flex" }}>
            {LOGO_ORANGE}
          </Link>
          <nav style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <NavLink href="/quotes">Cotizador</NavLink>
            <NavLink href="/quotes/history">Mi historial</NavLink>
            {(profile.role === "admin" || profile.role === "super_admin") && (
              <>
                <NavLink href="/admin/users">Usuarios</NavLink>
                <NavLink href="/admin/quotes">Todas las cotizaciones</NavLink>
                <NavLink href="/admin/roles">Roles</NavLink>
              </>
            )}
            {profile.role === "super_admin" && (
              <>
                <NavLink href="/super-admin/empresas">Empresas</NavLink>
                <NavLink href="/super-admin/price-lists">Precios</NavLink>
              </>
            )}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/account" style={{ fontSize: 13, color: "var(--text-neutral)", textDecoration: "none" }}>
            {profile.nombre} {profile.apellido} · {profile.role}
          </Link>
          <form action={signOutAction}>
            <button type="submit" style={{ background: "transparent", color: "var(--text-neutral)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-button)", padding: "8px 16px", fontWeight: 600, fontSize: 13 }}>
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>
      <main style={{ padding: "28px 32px", maxWidth: 1280, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
