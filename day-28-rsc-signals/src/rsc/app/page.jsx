import Link from "next/link";

export default function Home() {
  return (
    <ul>
      <li><Link href="/server">/server (markdown in a Server Component)</Link></li>
      <li><Link href="/client">/client (markdown in a Client Component)</Link></li>
    </ul>
  );
}
