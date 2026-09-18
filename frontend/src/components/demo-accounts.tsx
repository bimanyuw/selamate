import { ShieldCheck, Truck } from 'lucide-react';
import './demo-accounts.css';

const accounts = [
  { role: 'Admin', description: 'Dashboard & pemantauan driver', email: 'admin@selamate.demo', password: 'BMsa9WScdZTH4_5C', Icon: ShieldCheck },
  { role: 'Driver', description: 'Kamera & notifikasi perjalanan', email: 'driver@selamate.demo', password: 'QYpOBx8sn6RTb0Wz', Icon: Truck },
];

export default function DemoAccounts() {
  return <section className="auth-demo-accounts" aria-labelledby="demo-accounts-heading">
    <header><h3 id="demo-accounts-heading">Akun demo</h3><p>Gunakan akun berikut untuk mencoba SelaMate tanpa mendaftar.</p></header>
    <div>{accounts.map(({ role, description, email, password, Icon }) => <article key={role}>
      <div className="auth-demo-role"><Icon size={18} /><span><strong>{role}</strong><small>{description}</small></span></div>
      <dl><div><dt>Email</dt><dd><code>{email}</code></dd></div><div><dt>Password</dt><dd><code>{password}</code></dd></div></dl>
    </article>)}</div>
  </section>;
}
