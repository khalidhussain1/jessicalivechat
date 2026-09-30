export function MessageTicks({
  deliveredAt,
  readAt,
}: {
  deliveredAt: number | null;
  readAt: number | null;
}) {
  const state = readAt ? "read" : deliveredAt ? "delivered" : "sent";
  const color = state === "read" ? "#53bdeb" : "currentColor";

  return (
    <svg
      width="15"
      height="10"
      viewBox="0 0 16 11"
      fill="none"
      className="inline-block shrink-0 align-text-bottom"
      aria-label={state}
    >
      <path
        d="M1 5.5L4.5 9L11 1.5"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {state !== "sent" && (
        <path
          d="M5.5 5.5L9 9L15.5 1.5"
          stroke={color}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
