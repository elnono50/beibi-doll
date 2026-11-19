type Props = {
  children: React.ReactNode;
  className?: string;
  tagClassName?: string;
  swing?: boolean;
  as?: "div" | "section";
};

/**
 * Pase VIP colgado de una cadena de bolitas plateada: el sello visual de
 * Beibi Doll (login de clientas, panel y confirmación de pedido).
 * Cae desde arriba y se balancea hasta quedar quieto.
 */
export function HangTag({ children, className = "", tagClassName = "", swing, as: As = "div" }: Props) {
  return (
    <As className={`pass-hang${swing ? " pass-hang--drop" : ""} ${className}`}>
      <span className="pass-hang__chain" aria-hidden="true" />
      <div className={`pass ${tagClassName}`}>
        <span className="pass__slot" aria-hidden="true" />
        <span className="pass__sheen" aria-hidden="true" />
        {children}
      </div>
    </As>
  );
}

export const VipPass = HangTag;
