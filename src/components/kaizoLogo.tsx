import Image from "next/image";

/** The Kaizo logo. In dark mode the lettering switches to white (public/kaizologo-dark.png); the icon keeps its colors. */
export default function KaizoLogo({ width = 104 }: { width?: number }) {
  const height = Math.round((width * 500) / 1508); // the artwork is 1508x500, cropped to the logo with no empty margin
  return (
    <>
      <Image src="/kaizologo.png" alt="Kaizo" width={width} height={height} priority className="dark:hidden" />
      <Image src="/kaizologo-dark.png" alt="Kaizo" width={width} height={height} priority className="hidden dark:block" />
    </>
  );
}
