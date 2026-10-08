import { useContext, createContext } from "react";
export const NavigationContext = createContext<any>(null);
export function useRouter() {
  return useContext(NavigationContext).router;
}
export function usePathname() {
  return useContext(NavigationContext).path;
}
export function useSearchParams() {
  return useContext(NavigationContext).params;
}
export function redirect(path: string) {
  useRouter().replace(path);
}
export function notFound() {
  throw new Error("Page not found");
}
