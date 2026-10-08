import { store, save } from "./store";
import {
  isLoginBlocked,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/login-throttle";
export async function signIn(_: string, { email, password }: any) {
  email = email.trim().toLowerCase();
  if (isLoginBlocked(email, "demo-browser"))
    return { error: "CredentialsSignin" };
  const user = store.users.find(
    (u: any) => u.email.toLowerCase() === email && u.isActive,
  );
  if (!user || password !== store.passwords[user.id]) {
    recordLoginFailure(email, "demo-browser");
    return { error: "CredentialsSignin" };
  }
  recordLoginSuccess(email);
  store.userId = user.id;
  save();
  return { ok: true };
}
export async function signOut() {
  store.userId = null;
  save();
  window.location.hash = "/login";
}
