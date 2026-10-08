import { useRouter } from "./navigation";
export default function Link({ href, children, onClick, ...props }: any) {
  const router = useRouter();
  return (
    <a
      {...props}
      href={href.startsWith("/") ? "#" + href : href}
      onClick={(e) => {
        onClick?.(e);
        if (
          !e.defaultPrevented &&
          href.startsWith("/") &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey
        ) {
          e.preventDefault();
          router.push(href);
        }
      }}
    >
      {children}
    </a>
  );
}
